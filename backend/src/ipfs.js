/**
 * src/ipfs.js
 * IPFS upload via local Kubo daemon (HTTP API).
 */

const axios    = require("axios");
const FormData = require("form-data");
const fs       = require("fs");
const path     = require("path");

function collectFiles(dir, baseDir = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full, baseDir));
    else if (entry.isFile())
      results.push({ full, relative: path.relative(baseDir, full).replace(/\\/g, "/") });
  }
  return results;
}

/**
 * Upload a local directory to IPFS via the local Kubo daemon.
 * Returns the CIDv1 string.
 */
async function uploadDir(dirPath, name, log = console.log) {
  const files = collectFiles(dirPath);
  log(`  📁 Uploading ${files.length} files as "${name}"`);

  const kuboUrl = process.env.IPFS_API_URL || "http://127.0.0.1:5001";
  log(`  🖥️  Uploading to Kubo at ${kuboUrl}...`);

  const uploadForm = new FormData();
  for (const { full, relative } of files) {
    uploadForm.append("file", fs.createReadStream(full), { filename: relative });
  }

  const kuboRes = await axios.post(
    `${kuboUrl}/api/v0/add?cid-version=1&wrap-with-directory=false&recursive=true`,
    uploadForm,
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: uploadForm.getHeaders(),
      timeout: 60000,
    }
  );

  // Kubo returns one JSON object per line (NDJSON); last line is the root dir
  const lines = kuboRes.data.toString().trim().split("\n").filter(Boolean);
  const last  = JSON.parse(lines[lines.length - 1]);
  log(`  ✅ Uploaded: ${last.Hash}`);
  return last.Hash;
}

/**
 * Warm up public IPFS gateways so the CID propagates quickly.
 */
async function warmGateways(cid, log = console.log) {
  const gateways = ["ipfs.io", "w3s.link", "nftstorage.link"];
  log(`  🔥 Warming ${gateways.length} gateways for CID ${cid}...`);
  await Promise.allSettled(
    gateways.map((host) =>
      axios
        .get(`https://${host}/ipfs/${cid}/`, { timeout: 12000 })
        .catch(() => {})
    )
  );
}

module.exports = { uploadDir, warmGateways };
