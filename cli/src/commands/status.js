"use strict";
/**
 * commands/status.js
 *
 * web3deploy status [domain]
 *
 * Reads deploy history + IPNS entry from the backend API and prints a summary.
 */

const axios = require("axios");
const chalk = require("chalk");
const ora   = require("ora");
const { readConfig, apiBase } = require("../config");

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  return d.toUTCString();
}

async function status(domain, _options) {
  require("dotenv").config();

  const cfg = readConfig();
  const target = domain || (cfg && cfg.domain);

  if (!target) {
    console.error(
      chalk.red(
        "  ✗ No ENS domain specified. Run inside a web3deploy project or pass a domain as argument."
      )
    );
    process.exit(1);
  }

  const base  = apiBase(cfg);
  const token = process.env.WEB3DEPLOY_TOKEN || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const spinner = ora(`Fetching status for ${target}…`).start();

  let history, ipns;

  try {
    [{ data: history }, { data: ipns }] = await Promise.all([
      axios.get(`${base}/api/sites/${encodeURIComponent(target)}`, { headers }),
      axios.get(`${base}/api/sites/${encodeURIComponent(target)}/ipns`, { headers }).catch(() => ({
        data: null,
      })),
    ]);
  } catch (err) {
    spinner.fail("Request failed");
    console.error(chalk.red(`  ✗ ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }

  spinner.stop();

  const latest = history.latest;
  const cid    = latest ? Buffer.from(latest.cid.replace(/^0x/, ""), "hex").toString("utf8") : null;

  console.log(chalk.bold.cyan(`\n  D3PLOY — Status: ${target}\n`));
  console.log(`  Domain      : ${chalk.white(target)}`);
  console.log(`  CID         : ${cid ? chalk.cyan(cid) : chalk.gray("none")}`);
  if (latest) {
    console.log(`  Environment : ${chalk.white(latest.env || "—")}`);
    console.log(`  Last deploy : ${chalk.white(formatDate(latest.timestamp))}`);
    if (latest.deployer) console.log(`  Deployer    : ${chalk.white(latest.deployer)}`);
  }

  if (ipns && ipns.entry) {
    const ipnsCid = Buffer.from((ipns.entry.latestCid || "").replace(/^0x/, ""), "hex").toString("utf8");
    console.log(`  IPNS CID    : ${chalk.cyan(ipnsCid || "—")}`);
    console.log(`  IPNS seq    : ${chalk.white(ipns.entry.latestSeq || "—")}`);
    if (ipns.gateways && ipns.gateways.length) {
      console.log(`  Gateways:`);
      for (const gw of ipns.gateways) {
        console.log(`    ${chalk.underline.blue(gw)}`);
      }
    }
  }

  if (cid) {
    console.log(`\n  Live at:`);
    console.log(`    ${chalk.underline.blue(`https://${target}.limo`)}`);
    console.log(`    ${chalk.underline.blue(`https://${cid}.ipfs.dweb.link`)}`);
    console.log(`    ${chalk.underline.blue(`https://${cid}.ipfs.cf-ipfs.com`)}`);
  }

  if (history.history && history.history.length > 1) {
    console.log(chalk.bold.white("\n  Recent deploys:"));
    const rows = history.history.slice(0, 5);
    rows.forEach((d, i) => {
      const rowCid = Buffer.from((d.cid || "").replace(/^0x/, ""), "hex").toString("utf8");
      const current = i === 0 ? chalk.green(" ← current") : "";
      console.log(
        `    #${history.count - i}  ${chalk.cyan(rowCid.slice(0, 20))}…  ${formatDate(d.timestamp)}${current}`
      );
    });
  }

  console.log();
}

module.exports = { status };
