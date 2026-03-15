"use strict";
/**
 * commands/init.js
 *
 * web3deploy init
 *   Interactively creates web3deploy.config.json + .env.example
 *   and patches .gitignore to ignore .env.
 */

const fs         = require("fs");
const path       = require("path");
const inquirer   = require("inquirer");
const chalk      = require("chalk");
const { writeConfig, CONFIG_FILE } = require("../config");

async function init() {
  console.log(chalk.bold.cyan("\n  D3PLOY — web3deploy init\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "domain",
      message: "ENS domain to deploy to (e.g. myapp.eth):",
      validate: (v) =>
        v.includes(".") ? true : "Must be a valid ENS name like myapp.eth",
    },
    {
      type: "input",
      name: "buildCommand",
      message: "Build command:",
      default: "npm run build",
    },
    {
      type: "input",
      name: "outputDir",
      message: "Build output directory:",
      default: "dist",
    },
    {
      type: "input",
      name: "framework",
      message: "Framework (vite / nextjs / cra / plain — leave blank to auto-detect):",
      default: "",
    },
    {
      type: "input",
      name: "apiUrl",
      message: "D3PLOY backend URL:",
      default: "http://localhost:3001",
    },
    {
      type: "confirm",
      name: "usePinata",
      message: "Use Pinata for IPFS pinning?",
      default: true,
    },
    {
      type: "confirm",
      name: "useMultiSig",
      message: "Use Gnosis Safe multi-sig for ENS updates? (configure later)",
      default: false,
    },
  ]);

  const cfg = {
    domain: answers.domain,
    build: {
      command: answers.buildCommand,
      outputDir: answers.outputDir,
      ...(answers.framework ? { framework: answers.framework } : {}),
    },
    pinning: {
      ...(answers.usePinata ? { pinata: { jwt: "${PINATA_JWT}" } } : {}),
    },
    signer: {
      privateKey: "${DEPLOYER_PRIVATE_KEY}",
    },
    ...(answers.useMultiSig
      ? {
          governance: {
            safe: "${GNOSIS_SAFE_ADDRESS}",
            rpc: "${ETH_RPC_URL}",
            threshold: 3,
          },
        }
      : {}),
    apiUrl: answers.apiUrl,
  };

  writeConfig(cfg);
  console.log(chalk.green(`  ✓ Created ${CONFIG_FILE}`));

  // Write .env.example
  const envLines = [
    "# D3PLOY environment variables",
    "DEPLOYER_PRIVATE_KEY=0x...",
    answers.usePinata ? "PINATA_JWT=eyJ..." : null,
    answers.useMultiSig ? "GNOSIS_SAFE_ADDRESS=0x..." : null,
    answers.useMultiSig ? "ETH_RPC_URL=https://mainnet.infura.io/v3/..." : null,
    "SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...",
  ]
    .filter(Boolean)
    .join("\n");

  const envExamplePath = path.join(process.cwd(), ".env.example");
  if (!fs.existsSync(envExamplePath)) {
    fs.writeFileSync(envExamplePath, envLines + "\n", "utf8");
    console.log(chalk.green("  ✓ Created .env.example"));
  }

  // Patch .gitignore
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  let gitignore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  if (!gitignore.includes(".env")) {
    gitignore += "\n# D3PLOY secrets\n.env\n";
    fs.writeFileSync(gitignorePath, gitignore, "utf8");
    console.log(chalk.green("  ✓ Updated .gitignore"));
  }

  console.log(
    chalk.bold.white(
      `\n  Next steps:\n` +
        `    1. Copy .env.example → .env and fill in your keys\n` +
        `    2. Run ${chalk.cyan("web3deploy push")} to deploy\n`
    )
  );
}

module.exports = { init };
