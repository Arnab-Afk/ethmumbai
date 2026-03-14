/**
 * src/ipfs.js
 * Pinata upload helpers — directory upload + DHT warmup
 */

const axios    = require("axios");
const FormData = require("form-data");
const fs       = require("fs");
const path     = require("path");
const { PINATA_JWT, PINATA_API_KEY, PINATA_API_SECRET } = process.env;

function authHeaders() {
  if (PINATA_JWT) return { Authorization: `Bearer ${PINATA_JWT}` };
  return {
    pinata_api_key: PINATA_API_KEY,
    pinata_secret_api_key: PINATA_API_SECRET,
  };
}

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

async function testAuth() {
  const res = await axios.get("https://api.pinata.cloud/data/testAuthentication", {
    headers: authHeaders(),
  });
  return res.data.message;
}

/**
 * Upload a local directory to Pinata IPFS.
 * Returns the CIDv1 string.
 */
async function uploadDir(dirPath, name, log = console.log) {
  const files = collectFiles(dirPath);
  log(`  📁 Uploading ${files.length} files as "${name}"`);

  const form = new FormData();
  for (const { full, relative } of files) {
    form.append("file", fs.createReadStream(full), { filepath: `tmp/${relative}` });
  }
  form.append("pinataMetadata", JSON.stringify({ name }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }));

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    form,
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { ...authHeaders(), ...form.getHeaders() },
    }
  );

  return res.data.IpfsHash;
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

module.exports = { testAuth, uploadDir, warmGateways, authHeaders };
