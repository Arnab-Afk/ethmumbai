"use strict";
/**
 * commands/rollback.js
 *
 * web3deploy rollback [deploy-id]
 *
 * Lists recent deploys and lets the user pick one to re-point ENS contenthash to.
 * Calls POST /api/deploy/rollback on the backend.
 */

const axios    = require("axios");
const chalk    = require("chalk");
const ora      = require("ora");
const inquirer = require("inquirer");
const { readConfig, apiBase } = require("../config");

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(typeof ts === "number" ? ts * 1000 : ts).toUTCString();
}

function decodeCid(hex) {
  if (!hex) return "";
  return Buffer.from(hex.replace(/^0x/, ""), "hex").toString("utf8");
}

async function rollback(deployId, _options) {
  require("dotenv").config();

  const cfg    = readConfig();
  const domain = (cfg && cfg.domain);
  const base   = apiBase(cfg);
  const token  = process.env.WEB3DEPLOY_TOKEN || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  if (!domain) {
    console.error(
      chalk.red("  ✗ No ENS domain found. Run inside a web3deploy project directory.")
    );
    process.exit(1);
  }

  console.log(chalk.bold.cyan("\n  D3PLOY — web3deploy rollback\n"));

  // ── Fetch deploy history ──────────────────────────────────────────────────
  const spinner = ora("Fetching deploy history…").start();
  let history;
  try {
    const { data } = await axios.get(
      `${base}/api/sites/${encodeURIComponent(domain)}?limit=10`,
      { headers }
    );
    history = data;
  } catch (err) {
    spinner.fail("Failed to fetch history");
    console.error(chalk.red(`  ✗ ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }
  spinner.stop();

  const deploys = history.history || [];
  if (deploys.length === 0) {
    console.log(chalk.yellow("  No deploy history found for " + domain));
    process.exit(0);
  }

  const total = history.count || deploys.length;

  // ── Display recent deploys ────────────────────────────────────────────────
  console.log(chalk.bold.white("  Recent deploys:\n"));
  deploys.forEach((d, i) => {
    const cid     = decodeCid(d.cid);
    const num     = total - i;
    const current = i === 0 ? chalk.green(" ← current") : "";
    console.log(
      `    #${num}  ${chalk.cyan(cid.slice(0, 46))}  ${chalk.gray(formatDate(d.timestamp))}${current}`
    );
  });
  console.log();

  // ── Resolve target ────────────────────────────────────────────────────────
  let targetDeploy;

  if (deployId) {
    // User passed a deploy number on the CLI
    const num = parseInt(deployId, 10);
    const idx = total - num;
    if (isNaN(num) || idx < 0 || idx >= deploys.length) {
      console.error(chalk.red(`  ✗ Deploy #${deployId} not found in the last ${deploys.length} records.`));
      process.exit(1);
    }
    targetDeploy = deploys[idx];
  } else {
    // Interactive prompt
    const choices = deploys.slice(1).map((d, i) => {
      const cid = decodeCid(d.cid);
      const num = total - (i + 1);
      return {
        name: `#${num}  ${cid.slice(0, 46)}  ${formatDate(d.timestamp)}`,
        value: d,
      };
    });

    if (choices.length === 0) {
      console.log(chalk.yellow("  Only one deploy in history — nothing to roll back to."));
      process.exit(0);
    }

    const { chosen } = await inquirer.prompt([
      {
        type: "list",
        name: "chosen",
        message: "Roll back to:",
        choices,
      },
    ]);
    targetDeploy = chosen;
  }

  const targetCid = decodeCid(targetDeploy.cid);
  console.log(chalk.bold.white(`\n  Rolling back ${domain} → ${chalk.cyan(targetCid)}\n`));

  // ── Call backend rollback endpoint ────────────────────────────────────────
  const rollbackSpinner = ora("Updating ENS contenthash…").start();
  try {
    const { data } = await axios.post(
      `${base}/api/deploy/rollback`,
      { domain, cid: targetCid },
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
    rollbackSpinner.succeed("ENS contenthash updated");
    if (data.txHash) {
      console.log(`  Tx : ${chalk.cyan(data.txHash)}`);
    }
    console.log(chalk.bold.green("\n  ✓ Rollback complete!\n"));
  } catch (err) {
    rollbackSpinner.fail("Rollback request failed");
    const msg = err.response?.data?.error || err.message;
    console.error(chalk.red(`  ✗ ${msg}`));
    process.exit(1);
  }
}

module.exports = { rollback };
