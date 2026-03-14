/**
 * src/bot.js — D3PLOY Telegram Bot
 *
 * A chat-based deploy interface, powered by OpenClaw skill integration.
 * Lets users deploy directly from Telegram by providing a GitHub repo
 * and ENS domain — no dashboard required.
 *
 * Conversation flow:
 *   /deploy → ask repo URL → ask domain → ask env (optional) → run pipeline → stream logs
 *   /status → show active deploy count
 *   /sites  → list deployed domains
 *   /help   → command reference
 *
 * Set TELEGRAM_BOT_TOKEN in .env to enable.
 */

const { Telegraf, Markup } = require("telegraf");
const { runPipeline }      = require("./pipeline");

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

// ── /start & /help ────────────────────────────────────────────────────────────

const HELP_TEXT = `
*D3PLOY Bot* 🚀
_Deploy anything to IPFS + ENS from Telegram_

*Commands*
/deploy — start a new deploy
/cancel — cancel current operation
/status — active deploys running
/help   — show this message

*How it works*
1. You give me a GitHub repo URL
2. You give me an ENS domain (or I assign a free \`app.d3ploy.eth\` subdomain)
3. I build it, upload to IPFS, update ENS, and log it on-chain
4. You get a live IPFS link — no servers, no Vercel, no censorship

Powered by *D3PLOY* + *Elsa OpenClaw x402* ⚡
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
      "🌐 *Step 2/3 — ENS Domain*\n\nEnter your ENS domain, e.g. `myapp.eth`\n\nOR type `auto` and I'll assign you a free `app.d3ploy.eth` subdomain automatically."
    );
  }

  // ── Step 2: collect domain ─────────────────────────────────

  if (s.step === STEPS.DOMAIN) {
    const input = text.toLowerCase().trim();

    if (input === "auto") {
      s.domainMode = "auto";
      s.domain     = null; // server will assign
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
    s.step = STEPS.DEPLOY;

    // Show summary + confirm
    const domainDisplay = s.domainMode === "auto"
      ? "auto-assigned (`app.d3ploy.eth`)"
      : `\`${s.domain}\``;

    await ctx.replyWithMarkdown(
      `✅ *Deploy Summary*\n\n` +
      `📦 Repo: \`${s.repoUrl}\`\n` +
      `🌐 Domain: ${domainDisplay}\n` +
      `🏷️  Env: \`${s.env}\`\n\n` +
      `Launching pipeline... this usually takes 1–3 minutes ⏱️`,
      Markup.removeKeyboard()
    );

    // ── Run pipeline ─────────────────────────────────────────

    const { log, flush } = makeLogBatcher(ctx);

    try {
      const receipt = await runPipeline(
        {
          repoUrl:    s.repoUrl,
          domain:     s.domain || "auto",
          env:        s.env,
          meta:       `telegram:${ctx.from.username || ctx.from.id}`,
          ens: {
            mode:     s.domainMode,
            fullName: s.domain || null,
            ipnsKey:  null,
          },
        },
        log
      );

      await flush();

      // ── Success message ──────────────────────────────────
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

    return;
  }

  // ── Idle — nudge user ──────────────────────────────────────

  if (s.step === STEPS.IDLE) {
    ctx.reply("👋 Use /deploy to start a new deploy, or /help for all commands.");
  }
});

// ── Export ────────────────────────────────────────────────────────────────────

function launch() {
  bot.launch();
  console.log("[bot] Telegram bot started.");

  // Graceful shutdown
  process.once("SIGINT",  () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

function stop(signal) {
  bot.stop(signal);
}

module.exports = { launch, stop };
