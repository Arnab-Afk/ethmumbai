"use strict";
/**
 * src/config.js
 * Read / write web3deploy.config.json in the current working directory.
 */

const fs   = require("fs");
const path = require("path");

const CONFIG_FILE = "web3deploy.config.json";

function configPath(cwd = process.cwd()) {
  return path.join(cwd, CONFIG_FILE);
}

function readConfig(cwd = process.cwd()) {
  const p = configPath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(cfg, cwd = process.cwd()) {
  fs.writeFileSync(configPath(cwd), JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** Return the API base URL — config > env > default */
function apiBase(cfg) {
  return (cfg && cfg.apiUrl) || process.env.WEB3DEPLOY_API || "http://localhost:3001";
}

module.exports = { readConfig, writeConfig, configPath, apiBase, CONFIG_FILE };
