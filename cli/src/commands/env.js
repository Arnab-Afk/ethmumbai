"use strict";
/**
 * commands/env.js
 *
 * web3deploy env set <key> <value>    — store a key/value in ENS text records via the backend
 * web3deploy env get <key>            — read a key from ENS text records
 * web3deploy env list                 — list all deploy-related ENS text records
 *
 * The backend exposes GET/POST /api/domains/:domain/records
 */

const axios = require("axios");
const chalk = require("chalk");
const ora   = require("ora");
const { readConfig, apiBase } = require("../config");

function getDomain(cfg, options) {
  const d = (options && options.domain) || (cfg && cfg.domain);
  if (!d) {
    console.error(
      chalk.red("  ✗ No ENS domain. Run inside a web3deploy project or pass --domain <ens>.")
    );
    process.exit(1);
  }
  return d;
}

async function envSet(key, value, options) {
  require("dotenv").config();
  const cfg    = readConfig();
  const domain = getDomain(cfg, options);
  const base   = apiBase(cfg);
  const token  = process.env.WEB3DEPLOY_TOKEN || "";
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const spinner = ora(`Setting ${key} on ${domain}…`).start();
  try {
    await axios.post(
      `${base}/api/domains/${encodeURIComponent(domain)}/records`,
      { key, value },
      { headers }
    );
    spinner.succeed(`Set ${chalk.cyan(key)} = ${chalk.white(value)} on ${chalk.white(domain)}`);
  } catch (err) {
    spinner.fail("Failed");
    console.error(chalk.red(`  ✗ ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }
}

async function envGet(key, options) {
  require("dotenv").config();
  const cfg    = readConfig();
  const domain = getDomain(cfg, options);
  const base   = apiBase(cfg);
  const token  = process.env.WEB3DEPLOY_TOKEN || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const spinner = ora(`Reading ${key} from ${domain}…`).start();
  try {
    const { data } = await axios.get(
      `${base}/api/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(key)}`,
      { headers }
    );
    spinner.stop();
    console.log(`  ${chalk.cyan(key)} = ${chalk.white(data.value ?? "(not set)")}`);
  } catch (err) {
    spinner.fail("Failed");
    console.error(chalk.red(`  ✗ ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }
}

async function envList(options) {
  require("dotenv").config();
  const cfg    = readConfig();
  const domain = getDomain(cfg, options);
  const base   = apiBase(cfg);
  const token  = process.env.WEB3DEPLOY_TOKEN || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const spinner = ora(`Fetching records for ${domain}…`).start();
  try {
    const { data } = await axios.get(
      `${base}/api/domains/${encodeURIComponent(domain)}/records`,
      { headers }
    );
    spinner.stop();
    const records = data.records || {};
    const keys = Object.keys(records);
    if (keys.length === 0) {
      console.log(chalk.gray("  (no text records found)"));
      return;
    }
    console.log(chalk.bold.cyan(`\n  ENS text records — ${domain}\n`));
    for (const k of keys) {
      console.log(`  ${chalk.cyan(k.padEnd(30))} ${chalk.white(records[k])}`);
    }
    console.log();
  } catch (err) {
    spinner.fail("Failed");
    console.error(chalk.red(`  ✗ ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }
}

module.exports = { envSet, envGet, envList };
