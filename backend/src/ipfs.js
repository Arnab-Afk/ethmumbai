/**
 * src/ipfs.js
 * IPFS upload helpers — Pinata v3 → Pinata v2 → Lighthouse → local IPFS daemon fallback chain
 */

const axios    = require("axios");
const FormData = require("form-data");
const fs       = require("fs");
const path     = require("path");
const { PINATA_JWT, PINATA_API_KEY, PINATA_API_SECRET, LIGHTHOUSE_API_KEY } = process.env;

function pinataPlanLimitError(err) {
  const msg = err.response?.data?.error?.message || "";
  return err.response?.status === 403 && msg.toLowerCase().includes("plan limits");
}

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
 * Upload a local directory to IPFS.
 * Provider chain: Pinata v3 → Pinata v2 → Lighthouse
 * Returns the CIDv1 string.
 */
async function uploadDir(dirPath, name, log = console.log) {
  const files = collectFiles(dirPath);
  log(`  📁 Uploading ${files.length} files as "${name}"`);

  // ── 1. Pinata v3 Files API ─────────────────────────────
  if (PINATA_JWT) {
    try {
      const form = new FormData();
      for (const { full, relative } of files) {
        form.append("file", fs.createReadStream(full), { filename: relative });
      }
      form.append("name", name);

      const res = await axios.post(
        "https://uploads.pinata.cloud/v3/files",
        form,
        {
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          headers: { Authorization: `Bearer ${PINATA_JWT}`, ...form.getHeaders() },
        }
      );
      return res.data.data.cid;
    } catch (err) {
      if (pinataPlanLimitError(err)) {
        log(`  ⚠️  Pinata plan limit reached — skipping v2, trying Lighthouse...`);
      } else {
        log(`  ⚠️  Pinata v3 failed (${err.response?.status ?? err.message}), falling back to v2...`);

        // ── 2. Pinata v2 legacy API ──────────────────────────
        try {
          const form2 = new FormData();
          for (const { full, relative } of files) {
            form2.append("file", fs.createReadStream(full), { filepath: `tmp/${relative}` });
          }
          form2.append("pinataMetadata", JSON.stringify({ name }));
          form2.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }));

          const res2 = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            form2,
            {
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
              headers: { ...authHeaders(), ...form2.getHeaders() },
            }
          );
          return res2.data.IpfsHash;
        } catch (err2) {
          if (pinataPlanLimitError(err2)) {
            log(`  ⚠️  Pinata plan limit reached — trying Lighthouse...`);
          } else {
            log(`  ⚠️  Pinata v2 failed (${err2.response?.status ?? err2.message}), trying Lighthouse...`);
          }
        }
      }
    }
  }

  // ── 3. Lighthouse ──────────────────────────────────────
  if (LIGHTHOUSE_API_KEY) {
    log(`  📡 Trying Lighthouse IPFS...`);
    try {
      const archiver = require("archiver");
      const zipStream = archiver("zip", { zlib: { level: 6 } });
      zipStream.directory(dirPath, false);
      zipStream.finalize();

      const lhForm = new FormData();
      lhForm.append("file", zipStream, { filename: "site.zip", contentType: "application/zip" });

      const lhRes = await axios.post(
        "https://node.lighthouse.storage/api/v0/add",
        lhForm,
        {
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          headers: {
            Authorization: `Bearer ${LIGHTHOUSE_API_KEY}`,
            ...lhForm.getHeaders(),
          },
        }
      );
      return lhRes.data.Hash;
    } catch (err) {
      log(`  ⚠️  Lighthouse failed (${err.response?.status ?? err.message}), trying local IPFS daemon...`);
    }
  }

  // ── 4. Local IPFS daemon (Kubo HTTP API at localhost:5001) ─────────────
  log(`  🖥️  Falling back to local IPFS daemon (localhost:5001)...`);
  try {
    const { execSync } = require("child_process");
    // Use the kubo CLI — it talks to the already-running daemon
    const result = execSync(
      `ipfs add -r --cid-version=1 --wrap-with-directory=false --quieter "${dirPath}"`,
      { encoding: "utf8" }
    ).trim();
    // --quieter prints one CID per item; the last line is the root directory CID
    const lines = result.split("\n").filter(Boolean);
    const cid = lines[lines.length - 1];
    log(`  ✅ Local IPFS daemon: ${cid}`);
    return cid;
  } catch (err) {
    throw new Error(
      "All IPFS providers failed (Pinata plan limit, Lighthouse unavailable, local daemon not running). " +
      "Run 'ipfs daemon' locally, or delete old Pinata pins at app.pinata.cloud and retry."
    );
  }
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
