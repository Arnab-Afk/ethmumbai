/**
 * src/openclaw.js
 * OpenClaw deploy intent parsing powered by HeyElsa with safe fallback parsing.
 */

const {
    DEFAULT_PARENT,
    buildAutoAssignedEnsName,
    isValidEnsName,
    normalizeEnsName,
} = require("./ens");

const HEYELSA_API_URL = process.env.HEYELSA_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const HEYELSA_API_KEY = process.env.HEYELSA_API_KEY || process.env.OPENROUTER_API_KEY || "";
const HEYELSA_MODEL = process.env.HEYELSA_MODEL || "heyelsa/elsa-x402";

function findGithubUrl(text) {
    const match = String(text || "").match(/https?:\/\/github\.com\/[^\s)]+/i);
    return match ? match[0].replace(/[),.;!?]+$/, "") : null;
}

function normalizeEnv(value) {
    const env = String(value || "").trim().toLowerCase();
    if (["production", "prod", "live", "mainnet"].includes(env)) return "production";
    if (["staging", "stage"].includes(env)) return "staging";
    if (["preview", "dev", "development", "test"].includes(env)) return "preview";
    return "production";
}

function fallbackPlanFromText(text) {
    const repoUrl = findGithubUrl(text);
    if (!repoUrl) return null;

    const lower = String(text || "").toLowerCase();
    const env = normalizeEnv(
        lower.includes("staging") ? "staging" : lower.includes("preview") ? "preview" : "production"
    );

    const domainMatch = String(text || "").match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/i);
    const requestedDomain = domainMatch ? normalizeEnsName(domainMatch[1]) : "";

    if (requestedDomain && isValidEnsName(requestedDomain) && requestedDomain !== "github.com") {
        return {
            repoUrl,
            env,
            domainMode: "custom",
            domain: requestedDomain,
            reason: "Fallback parser detected custom ENS domain in message.",
            planner: "fallback",
        };
    }

    return {
        repoUrl,
        env,
        domainMode: "auto",
        domain: buildAutoAssignedEnsName(DEFAULT_PARENT),
        reason: "Fallback parser used auto subdomain under parent ENS.",
        planner: "fallback",
    };
}

function sanitizePlan(plan, originalText) {
    const fallback = fallbackPlanFromText(originalText);
    if (!plan || typeof plan !== "object") return fallback;

    const repoUrl = findGithubUrl(plan.repoUrl) || (fallback && fallback.repoUrl);
    if (!repoUrl) return fallback;

    const mode = String(plan.domainMode || "").toLowerCase() === "custom" ? "custom" : "auto";
    const env = normalizeEnv(plan.env);

    if (mode === "custom") {
        const normalized = normalizeEnsName(plan.domain || "");
        if (isValidEnsName(normalized)) {
            return {
                repoUrl,
                env,
                domainMode: "custom",
                domain: normalized,
                reason: String(plan.reason || "HeyElsa selected custom ENS domain."),
                planner: "heyelsa",
            };
        }
    }

    return {
        repoUrl,
        env,
        domainMode: "auto",
        domain: buildAutoAssignedEnsName(DEFAULT_PARENT),
        reason: String(plan.reason || "HeyElsa selected auto ENS domain assignment."),
        planner: "heyelsa",
    };
}

async function resolveDeployIntentWithHeyElsa(text) {
    if (!HEYELSA_API_KEY) return null;

    const system = [
        "You are OpenClaw Deploy Planner powered by HeyElsa.",
        "Extract deployment intent from a user message and respond with strict JSON only.",
        "JSON shape: { repoUrl, env, domainMode, domain, reason }",
        "Rules:",
        "- repoUrl must be a valid github.com URL from the message.",
        "- env must be one of production|staging|preview.",
        "- domainMode must be custom or auto.",
        "- if user explicitly gives ENS domain, set custom and include it in domain.",
        "- otherwise set auto and set domain to null.",
    ].join("\n");

    const res = await fetch(HEYELSA_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${HEYELSA_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://d3ploy.xyz",
            "X-Title": "D3PLOY OpenClaw Planner",
        },
        body: JSON.stringify({
            model: HEYELSA_MODEL,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: system },
                { role: "user", content: text },
            ],
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`HeyElsa planner failed (${res.status}): ${detail || "request failed"}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

async function resolveDeployIntent(text, log = () => { }) {
    const fallback = fallbackPlanFromText(text);
    if (!fallback) return null;

    try {
        const aiPlan = await resolveDeployIntentWithHeyElsa(text);
        const plan = sanitizePlan(aiPlan, text);
        if (plan) {
            log(`  🧠 OpenClaw planner: ${plan.planner} (${plan.domainMode}/${plan.env})`);
            return plan;
        }
    } catch (err) {
        log(`  ⚠️ HeyElsa unavailable, using fallback parser (${err.message})`);
    }

    log("  🧠 OpenClaw planner: fallback");
    return fallback;
}

module.exports = {
    findGithubUrl,
    resolveDeployIntent,
};
