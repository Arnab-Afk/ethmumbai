/**
 * src/bot.js — D3PLOY Telegram Bot
 *
 * A chat-based deploy interface powered by OpenClaw + HeyElsa.
 * Lets users deploy directly from Telegram by either guided flow (/deploy)
 * or by pasting a GitHub URL for instant automated deployment.
 *
 * Conversation flow:
 *   /deploy → ask repo URL → ask domain → ask env (optional) → run pipeline → stream logs
 *   paste GitHub URL in chat → OpenClaw planner → auto deploy
 *   /status → show active deploy count
 *   /sites  → list deployed domains
 *   /help   → command reference
 *
 * Set TELEGRAM_BOT_TOKEN in .env to enable.
 */

const { Telegraf, Markup } = require("telegraf");
const { runPipeline }      = require("./pipeline");
const { resolveDeployIntent } = require("./openclaw");
const { buildAutoAssignedEnsName, DEFAULT_PARENT } = require("./ens");

// ── OpenRouter LLM setup ──────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-001";

const SYSTEM_PROMPT = `You are D3PLOY Bot — an AI assistant for the D3PLOY platform, a censorship-resistant Web3 deployment tool.
D3PLOY builds projects, uploads them to IPFS, resolves through ENS, and logs deploys on-chain.

You help users with:
- Deploying their GitHub repos to IPFS (tell them to use /deploy)
- Understanding how IPFS, ENS, and on-chain logging work
- Troubleshooting build errors and deploy failures
- Explaining Web3, decentralized hosting, and the D3PLOY architecture

Keep responses concise, friendly, and helpful. Use emoji sparingly.
If the user sends a GitHub URL, mention that OpenClaw + HeyElsa can auto-deploy it.
You are powered by D3PLOY + OpenClaw x HeyElsa x402.`;

// Per-chat conversation history (last 10 turns)
const chatHistories = new Map();

async function askAI(chatId, userMessage) {
  if (!OPENROUTER_API_KEY) return null;
  try {
    if (!chatHistories.has(chatId)) chatHistories.set(chatId, []);
    const history = chatHistories.get(chatId);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userMessage },
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://d3ploy.xyz",
        "X-Title":       "D3PLOY Bot",
      },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${err}`);
    }

    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty response from OpenRouter");

    // Update history (keep last 10 turns = 20 messages)
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: reply });
    if (history.length > 20) history.splice(0, 2);

    return reply;
  } catch (err) {
    console.error("[bot] OpenRouter error:", err.message);
    return null;
  }
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.log("[bot] TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.");
  module.exports = { launch: () => {}, stop: () => {} };
  return;
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ── Conversation state ────────────────────────────────────────────────────────
// Map<chatId, { step, repoUrl, domain, env }>
const sessions = new Map();

const STEPS = {
  IDLE:   "idle",
  REPO:   "awaiting_repo",
  DOMAIN: "awaiting_domain",
  ENV:    "awaiting_env",
  DEPLOY: "deploying",
};

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { step: STEPS.IDLE });
  return sessions.get(chatId);
}

function resetSession(chatId) {
  sessions.set(chatId, { step: STEPS.IDLE });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function isValidDomain(str) {
  // ENS domain (e.g. myapp.eth) or subdomain slug (e.g. myapp)
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(str.trim().toLowerCase());
}

/**
 * Send a batch of log lines as a single Telegram message.
 * Batches them to avoid Telegram rate limits during long builds.
 */
function makeLogBatcher(ctx, batchMs = 2000) {
  let buffer   = [];
  let timer    = null;
  let msgId    = null; // for editing the same message

  const flush = async () => {
    if (!buffer.length) return;
    const text = "```\n" + buffer.splice(0).join("\n") + "\n```";
    try {
      if (msgId) {
        await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, text, { parse_mode: "Markdown" });
      } else {
        const sent = await ctx.reply(text, { parse_mode: "Markdown" });
        msgId = sent.message_id;
      }
    } catch {
      // Editing can fail if message is too old or identical; just keep going
    }
    timer = null;
  };

  return {
    log: (line) => {
      // Skip empty heartbeat-style lines
      if (!line.trim()) return;
      buffer.push(line);
      // Flush immediately for key milestone lines
      if (line.includes("✅") || line.includes("🚀") || line.includes("CID") || line.includes("Error")) {
        clearTimeout(timer);
        flush();
        msgId = null; // start a fresh block after milestones
      } else {
        if (!timer) timer = setTimeout(flush, batchMs);
      }
    },
    flush,
  };
}

async function runDeployForSession(ctx, chatId, s, source = "guided", plannerReason = "") {
  s.step = STEPS.DEPLOY;

  const domainDisplay = s.domainMode === "auto"
    ? `\`${s.domain}\` (auto-assigned)`
    : `\`${s.domain}\``;

  await ctx.replyWithMarkdown(
    `✅ *Deploy Summary*\n\n` +
    `📦 Repo: \`${s.repoUrl}\`\n` +
    `🌐 Domain: ${domainDisplay}\n` +
    `🏷️  Env: \`${s.env}\`\n` +
    (plannerReason ? `🧠 Planner: ${plannerReason}\n` : "") +
    `\nLaunching pipeline... this usually takes 1–3 minutes ⏱️`,
    Markup.removeKeyboard()
  );

  const { log, flush } = makeLogBatcher(ctx);

  try {
    const receipt = await runPipeline(
      {
        repoUrl: s.repoUrl,
        domain: s.domain,
        env: s.env,
        meta: `telegram:${ctx.from.username || ctx.from.id},source:${source}`,
        ens: {
          mode: s.domainMode,
          fullName: s.domain,
          ipnsKey: null,
        },
      },
      log
    );

    await flush();

    const ensLine = receipt.ens?.name
      ? `🌐 ENS: \`${receipt.ens.name}\` → ${receipt.ens.contenthash || "update pending"}\n`
      : "";

    await ctx.replyWithMarkdown(
      `🎉 *Deploy Complete!*\n\n` +
      `📦 CID: \`${receipt.cid}\`\n` +
      ensLine +
      `⏱️  Elapsed: ${receipt.elapsed}\n\n` +
      `*Live URLs:*\n` +
      `• [ipfs.io](${receipt.gateways.ipfs_io})\n` +
      `• [dweb.link](${receipt.gateways.dweb})\n` +
      `• [w3s.link](${receipt.gateways.w3s})\n\n` +
      `_Logged on-chain via DeployRegistry_ ✅`
    );
  } catch (err) {
    await flush();
    await ctx.replyWithMarkdown(
      `❌ *Deploy failed*\n\n\`\`\`\n${err.message}\n\`\`\`\n\nFix the error and try /deploy again.`
    );
  } finally {
    resetSession(chatId);
  }
}

// ── /start & /help ────────────────────────────────────────────────────────────

const HELP_TEXT = `
*D3PLOY Bot* 🚀
_Deploy anything to IPFS + ENS from Telegram_

*Commands*
/deploy — start a new deploy
/cancel — cancel current operation
/status — active deploys running
/help   — show this message

*Fastest flow*
Paste a GitHub URL directly and OpenClaw + HeyElsa will auto-run deployment.

*How it works*
1. You give me a GitHub repo URL
2. I assign a free subdomain under \`${DEFAULT_PARENT}\` (or use guided custom mode)
3. I build it, upload to IPFS, update ENS, and log it on-chain
4. You get a live IPFS link — no servers, no Vercel, no censorship

Powered by *D3PLOY* + *OpenClaw x HeyElsa x402* ⚡
`;

bot.start((ctx) => ctx.replyWithMarkdown(HELP_TEXT));
bot.help((ctx)  => ctx.replyWithMarkdown(HELP_TEXT));

// ── /cancel ───────────────────────────────────────────────────────────────────

bot.command("cancel", (ctx) => {
  const s = getSession(ctx.chat.id);
  if (s.step === STEPS.DEPLOY) {
    return ctx.reply("⏳ A deploy is in progress — please wait for it to finish.");
  }
  resetSession(ctx.chat.id);
  ctx.reply("❌ Cancelled. Use /deploy to start again.");
});

// ── /status ───────────────────────────────────────────────────────────────────

bot.command("status", async (ctx) => {
  const s = getSession(ctx.chat.id);
  if (s.step !== STEPS.IDLE) {
    return ctx.reply(`⏳ You have an active deploy in progress (step: ${s.step}).`);
  }
  ctx.reply("✅ No active deploy. Use /deploy to start one.");
});

// ── /deploy ───────────────────────────────────────────────────────────────────

bot.command("deploy", (ctx) => {
  const s = getSession(ctx.chat.id);
  if (s.step === STEPS.DEPLOY) {
    return ctx.reply("⏳ Already deploying! Please wait for it to finish.");
  }
  // Clear previous state in-place so the same object reference stays in the Map
  s.step = STEPS.REPO;
  s.repoUrl = undefined;
  s.domain = undefined;
  s.domainMode = undefined;
  s.env = undefined;
  ctx.replyWithMarkdown(
    "🔗 *Step 1/3 — GitHub Repo*\n\nSend me the GitHub repository URL.\n\n_Examples:_\n`https://github.com/user/repo`\n`https://github.com/user/repo/tree/main/frontend`"
  );
});

// ── Message router ────────────────────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text   = ctx.message.text.trim();
  const s      = getSession(chatId);

  // Ignore commands (handled above)
  if (text.startsWith("/")) return;

  // ── Step 1: collect repo URL ───────────────────────────────

  if (s.step === STEPS.REPO) {
    if (!isValidUrl(text)) {
      return ctx.reply("❌ That doesn't look like a valid URL. Please send a full GitHub URL, e.g.:\n`https://github.com/user/repo`");
    }
    if (!text.includes("github.com")) {
      return ctx.reply("❌ Only GitHub repos are supported right now. Please send a `github.com` URL.");
    }
    s.repoUrl = text;
    s.step    = STEPS.DOMAIN;
    return ctx.replyWithMarkdown(
      `🌐 *Step 2/3 — ENS Domain*\n\nEnter your ENS domain, e.g. \`myapp.eth\`\n\nOR type \`auto\` and I'll assign you a free subdomain under \`${DEFAULT_PARENT}\` automatically.`
    );
  }

  // ── Step 2: collect domain ─────────────────────────────────

  if (s.step === STEPS.DOMAIN) {
    const input = text.toLowerCase().trim();

    if (input === "auto") {
      s.domainMode = "auto";
      s.domain = buildAutoAssignedEnsName(DEFAULT_PARENT);
    } else {
      if (!isValidDomain(input)) {
        return ctx.reply("❌ Invalid domain. Enter an ENS name like `myapp.eth` or type `auto`.");
      }
      s.domainMode = "custom";
      s.domain     = input;
    }

    s.step = STEPS.ENV;
    return ctx.reply(
      "🏷️ *Step 3/3 — Environment*\n\nWhich environment is this deploy for?",
      {
        parse_mode: "Markdown",
        ...Markup.keyboard([["production"], ["staging"], ["preview"]])
          .oneTime()
          .resize(),
      }
    );
  }

  // ── Step 3: collect env ────────────────────────────────────

  if (s.step === STEPS.ENV) {
    const validEnvs = ["production", "staging", "preview"];
    const env = text.toLowerCase().trim();

    if (!validEnvs.includes(env)) {
      return ctx.reply("❌ Please pick: production, staging, or preview.");
    }

    s.env  = env;
    await runDeployForSession(ctx, chatId, s, "guided");
    return;
  }

  // ── Idle — AI conversation ─────────────────────────────────

  if (s.step === STEPS.IDLE) {
    const deployIntent = await resolveDeployIntent(text, (line) => console.log(`[bot/openclaw] ${line}`));
    if (deployIntent?.repoUrl) {
      s.repoUrl = deployIntent.repoUrl;
      s.env = deployIntent.env || "production";

      // Keep one-message flow fully automated in chat.
      if (deployIntent.domainMode === "custom") {
        s.domainMode = "auto";
        s.domain = buildAutoAssignedEnsName(DEFAULT_PARENT);
        await ctx.replyWithMarkdown(
          `🧠 OpenClaw understood your deploy intent, but custom ENS needs pre-verified IPNS setup.\n` +
          `Using auto ENS for full automation: \`${s.domain}\``
        );
      } else {
        s.domainMode = "auto";
        s.domain = deployIntent.domain || buildAutoAssignedEnsName(DEFAULT_PARENT);
      }

      await runDeployForSession(
        ctx,
        chatId,
        s,
        "openclaw",
        `${deployIntent.planner || "heyelsa"} (${s.domainMode}/${s.env})`
      );
      return;
    }

    const aiReply = await askAI(chatId, text);
    if (aiReply) {
      await ctx.reply(aiReply, { parse_mode: "Markdown" }).catch(() =>
        ctx.reply(aiReply) // retry without markdown if formatting fails
      );
    } else {
      ctx.reply("👋 Use /deploy to start a new deploy, or /help for all commands.");
    }
  }
});

// ── Export ────────────────────────────────────────────────────────────────────

function launch() {
  // Catch runtime polling errors so transient Telegram/network issues
  // do not terminate the entire backend process.
  bot.catch((err) => {
    console.error("[bot] Telegram polling error:", err?.message || err);
  });

  Promise.resolve(bot.launch())
    .then(() => {
      console.log("[bot] Telegram bot started.");
    })
    .catch((err) => {
      console.error("[bot] Telegram bot launch failed:", err?.message || err);
      console.error("[bot] Continuing without Telegram bot. API server remains online.");
    });

  // Graceful shutdown
  process.once("SIGINT",  () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

function stop(signal) {
  bot.stop(signal);
}

module.exports = { launch, stop };
