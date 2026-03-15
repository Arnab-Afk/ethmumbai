"use strict";
/**
 * commands/push.js
 *
 * web3deploy push [--repo <url>] [--domain <ens>] [--env <name>]
 *
 * Triggers the full build → IPFS → ENS pipeline via the backend API.
 * Streams SSE log lines in real time and prints the final receipt.
 */

const axios  = require("axios");
const chalk  = require("chalk");
const ora    = require("ora");
const fs     = require("fs");
const path   = require("path");
const { readConfig, apiBase } = require("../config");

/** Detect the git remote of the current directory. */
function detectRepoUrl() {
  try {
    const { execSync } = require("child_process");
    const remote = execSync("git remote get-url origin", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // Normalise SSH remote → HTTPS
    if (remote.startsWith("git@github.com:")) {
      return "https://github.com/" + remote.slice("git@github.com:".length).replace(/\.git$/, "");
    }
    return remote.replace(/\.git$/, "");
  } catch {
    return null;
  }
}

async function push(options) {
  require("dotenv").config();

  const cfg = readConfig();

  const repoUrl = options.repo || detectRepoUrl();
  if (!repoUrl) {
    console.error(
      chalk.red(
        "  ✗ Could not detect a git remote. Run inside a git repo or pass --repo <url>"
      )
    );
    process.exit(1);
  }

  const domain = options.domain || (cfg && cfg.domain);
  if (!domain) {
    console.error(
      chalk.red(
        '  ✗ No ENS domain found. Run `web3deploy init` or pass --domain <ens>'
      )
    );
    process.exit(1);
  }

  const env      = options.env  || "production";
  const base     = apiBase(cfg);
  const token    = process.env.WEB3DEPLOY_TOKEN || "";
  const ipnsKey  = process.env.IPNS_KEY         || options.ipnsKey || null;

  console.log(chalk.bold.cyan("\n  D3PLOY — web3deploy push\n"));
  console.log(`  Repo   : ${chalk.white(repoUrl)}`);
  console.log(`  Domain : ${chalk.white(domain)}`);
  console.log(`  Env    : ${chalk.white(env)}`);
  console.log(`  API    : ${chalk.white(base)}\n`);

  let spinner = ora("Connecting to D3PLOY API…").start();

  let res;
  try {
    res = await axios.post(
      `${base}/api/deploy`,
      {
        repoUrl,
        domain,
        env,
        domainMode: ipnsKey ? "custom" : "auto",
        ipnsKey,
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        responseType: "stream",
        timeout: 0, // no timeout — builds can take a while
      }
    );
  } catch (err) {
    spinner.fail("Failed to connect to API");
    const msg = err.response?.data || err.message;
    console.error(chalk.red(`  ✗ ${typeof msg === "object" ? JSON.stringify(msg) : msg}`));
    process.exit(1);
  }

  spinner.succeed("Connected — streaming deploy logs\n");

  let finalReceipt = null;
  let buffer = "";

  await new Promise((resolve, reject) => {
    res.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        // SSE format: "data: ..."
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          try {
            const obj = JSON.parse(payload);
            if (obj.type === "log") {
              process.stdout.write(chalk.gray("  " + obj.message + "\n"));
            } else if (obj.type === "done") {
              finalReceipt = obj.receipt;
            } else if (obj.type === "error") {
              console.error(chalk.red("\n  ✗ Deploy error: " + obj.error));
            }
          } catch {
            // plain text line
            if (payload && payload !== "[DONE]") {
              process.stdout.write(chalk.gray("  " + payload + "\n"));
            }
          }
        }
      }
    });

    res.data.on("end", resolve);
    res.data.on("error", reject);
  });

  if (!finalReceipt) {
    console.error(chalk.red("\n  ✗ Deploy did not return a receipt."));
    process.exit(1);
  }

  const { cid, domain: deployedDomain, txHash, gatewayUrls } = finalReceipt;

  console.log(chalk.bold.green("\n  🚀 Deploy complete!\n"));
  console.log(`  ENS    : ${chalk.cyan(deployedDomain)}`);
  console.log(`  CID    : ${chalk.cyan(cid)}`);
  if (txHash) console.log(`  Tx     : ${chalk.cyan(txHash)}`);
  if (gatewayUrls && gatewayUrls.length) {
    console.log(`  Live at:`);
    for (const url of gatewayUrls) {
      console.log(`    ${chalk.underline.blue(url)}`);
    }
  } else {
    console.log(`  Live at: ${chalk.underline.blue(`https://${deployedDomain}.limo`)}`);
    console.log(`           ${chalk.underline.blue(`https://${cid}.ipfs.dweb.link`)}`);
  }

  // Write latest-deploy.json
  const artifact = { cid, domain: deployedDomain, txHash, env, timestamp: new Date().toISOString() };
  fs.writeFileSync(
    path.join(process.cwd(), "latest-deploy.json"),
    JSON.stringify(artifact, null, 2) + "\n",
    "utf8"
  );
  console.log(chalk.gray("\n  ✓ Wrote latest-deploy.json"));
}

module.exports = { push };
