"use strict";
/**
 * src/index.js — web3deploy CLI entry point
 *
 * Commands:
 *   web3deploy init                        init a new project
 *   web3deploy push                        build + upload to IPFS + update ENS
 *   web3deploy status [domain]             show current deploy state
 *   web3deploy rollback [deploy-id]        roll back to a previous deploy
 *   web3deploy env set <key> <value>       set an ENS text record
 *   web3deploy env get <key>               get an ENS text record
 *   web3deploy env list                    list all ENS text records
 */

const { Command } = require("commander");
const chalk       = require("chalk");

const { init }                  = require("./commands/init");
const { push }                  = require("./commands/push");
const { status }                = require("./commands/status");
const { rollback }              = require("./commands/rollback");
const { envSet, envGet, envList } = require("./commands/env");

const program = new Command();

program
  .name("web3deploy")
  .description(
    chalk.bold.cyan("D3PLOY") +
      " — deploy your site to IPFS and update ENS contenthash"
  )
  .version("0.1.0");

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command("init")
  .description("Initialise a new web3deploy project (creates web3deploy.config.json)")
  .action(async () => {
    try {
      await init();
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

// ── push ──────────────────────────────────────────────────────────────────────
program
  .command("push")
  .description("Build, upload to IPFS, and update ENS contenthash")
  .option("-r, --repo <url>",     "Git repository URL (auto-detected from current directory)")
  .option("-d, --domain <ens>",   "ENS domain to deploy to (overrides config)")
  .option("-e, --env <name>",     "Deploy environment name", "production")
  .option("--ipns-key <key>",     "IPNS key for custom domain (or set IPNS_KEY env var)")
  .action(async (options) => {
    try {
      await push(options);
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

// ── status ────────────────────────────────────────────────────────────────────
program
  .command("status [domain]")
  .description("Show current deploy status for an ENS domain")
  .action(async (domain, options) => {
    try {
      await status(domain, options);
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

// ── rollback ─────────────────────────────────────────────────────────────────
program
  .command("rollback [deploy-id]")
  .description("Roll back ENS contenthash to a previous deploy")
  .action(async (deployId, options) => {
    try {
      await rollback(deployId, options);
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

// ── env ───────────────────────────────────────────────────────────────────────
const envCmd = program
  .command("env")
  .description("Manage ENS text records (on-chain config)")
  .option("-d, --domain <ens>", "ENS domain (overrides config)");

envCmd
  .command("set <key> <value>")
  .description("Set an ENS text record")
  .action(async (key, value) => {
    try {
      await envSet(key, value, envCmd.opts());
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

envCmd
  .command("get <key>")
  .description("Get an ENS text record")
  .action(async (key) => {
    try {
      await envGet(key, envCmd.opts());
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

envCmd
  .command("list")
  .description("List all ENS text records for this domain")
  .action(async () => {
    try {
      await envList(envCmd.opts());
    } catch (err) {
      console.error(chalk.red("  ✗ " + err.message));
      process.exit(1);
    }
  });

program.parse(process.argv);
