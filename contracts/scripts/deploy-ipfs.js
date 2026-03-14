/**
 * deploy-ipfs.js
 *
 * Full EverDeploy pipeline for the /web static site:
 *   1. Upload web/out/ to Pinata (REST API, correct filepath prefix)
 *   2. Call DeployRegistry.logDeploy() on Base Sepolia
 *   3. Call IPNSRegistry.register() or logIPNSUpdate() on Base Sepolia
 *
 * Usage:  node scripts/deploy-ipfs.js [domain] [env]
 * Default: domain = everdeploy.eth, env = production
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { ethers } = require("ethers");

// ── config ───────────────────────────────────────────────────────────────────

const DOMAIN = process.argv[2] || "everdeploy.eth";
const ENV = process.argv[3] || "production";
const OUT_DIR = path.resolve(__dirname, "../../web/out");

const {
    PINATA_API_KEY,
    PINATA_API_SECRET,
    PINATA_JWT,
    PRIVATE_KEY,
    SEPOLIA_RPC_URL,
    REGISTRY_CONTRACT,
    IPNS_REGISTRY_CONTRACT,
} = process.env;

// ── ABI snippets ─────────────────────────────────────────────────────────────

const REGISTRY_ABI = [
    "function logDeploy(string calldata domain, bytes calldata cid, string calldata env, string calldata meta) external",
];

const IPNS_ABI = [
    "function isRegistered(string calldata domain) external view returns (bool)",
    "function getEntry(string calldata domain) external view returns (tuple(bytes ipnsKey, bytes latestCid, uint64 latestSeq, uint256 registeredAt, uint256 updatedAt, bool active))",
    "function register(string calldata domain, bytes calldata ipnsKey, bytes calldata initialCid, string[] calldata gateways) external",
    "function logIPNSUpdate(string calldata domain, bytes calldata cid, uint64 sequence) external",
];

// ── helpers ──────────────────────────────────────────────────────────────────

function checkEnv() {
    const hasPinata = PINATA_JWT || (PINATA_API_KEY && PINATA_API_SECRET);
    if (!hasPinata) {
        console.error("❌ Need PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET in .env");
        process.exit(1);
    }
    const missing = ["PRIVATE_KEY", "SEPOLIA_RPC_URL", "REGISTRY_CONTRACT", "IPNS_REGISTRY_CONTRACT"]
        .filter((k) => !process.env[k]);
    if (missing.length) {
        console.error("❌ Missing env vars:", missing.join(", "));
        process.exit(1);
    }
    if (!fs.existsSync(OUT_DIR)) {
        console.error(`❌ Build output not found at ${OUT_DIR}`);
        console.error("   Run: cd web && npm run build");
        process.exit(1);
    }
}

/** Auth headers — JWT preferred */
function authHeaders() {
    if (PINATA_JWT) return { Authorization: `Bearer ${PINATA_JWT}` };
    return { pinata_api_key: PINATA_API_KEY, pinata_secret_api_key: PINATA_API_SECRET };
}

/** Recursively collect ONLY files (skip directories) */
function collectFiles(dir, baseDir = dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(full, baseDir));
        } else if (entry.isFile()) {
            results.push({ full, relative: path.relative(baseDir, full).replace(/\\/g, "/") });
        }
        // skip symlinks / other special entries
    }
    return results;
}

/**
 * Upload directory to Pinata.
 * Key insight from @pinata/sdk source: each file's filepath must be prefixed
 * with "tmp/" so Pinata groups them all under one virtual root directory.
 */
async function uploadToPinata() {
    console.log("\n📤 Uploading to Pinata IPFS...");

    // Auth check
    const authRes = await axios.get("https://api.pinata.cloud/data/testAuthentication", {
        headers: authHeaders(),
    });
    console.log(`   ✅ Auth OK — ${authRes.data.message}`);

    const files = collectFiles(OUT_DIR);
    console.log(`   📁 ${files.length} files found`);

    const form = new FormData();

    for (const { full, relative } of files) {
        form.append("file", fs.createReadStream(full), {
            // "tmp/" prefix is required by Pinata to treat all entries as one directory
            filepath: `tmp/${relative}`,
        });
    }

    form.append("pinataMetadata", JSON.stringify({
        name: DOMAIN,
        keyvalues: { env: ENV, ts: new Date().toISOString() },
    }));

    form.append("pinataOptions", JSON.stringify({
        cidVersion: 1,
        wrapWithDirectory: false, // "tmp/" IS the root — no extra wrapper needed
    }));

    const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        form,
        {
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            headers: { ...authHeaders(), ...form.getHeaders() },
        }
    );

    const cid = res.data.IpfsHash;
    console.log(`\n   CID     : ${cid}`);
    console.log(`   Pinata  : https://gateway.pinata.cloud/ipfs/${cid}`);
    console.log(`   dweb    : https://${cid}.ipfs.dweb.link`);
    return cid;
}

/** Log deploy on-chain */
async function logDeploy(signer, cid) {
    console.log("\n⛓️  Logging to DeployRegistry...");
    const contract = new ethers.Contract(REGISTRY_CONTRACT, REGISTRY_ABI, signer);
    const tx = await contract.logDeploy(
        DOMAIN, ethers.toUtf8Bytes(cid), ENV, `ipfs:${cid},ts:${Date.now()}`
    );
    console.log(`   tx : ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Block ${receipt.blockNumber}`);
}

/** Register or update IPNS on-chain */
async function updateIPNS(signer, cid) {
    console.log("\n🔗 Updating IPNSRegistry...");
    const contract = new ethers.Contract(IPNS_REGISTRY_CONTRACT, IPNS_ABI, signer);
    const cidBytes = ethers.toUtf8Bytes(cid);
    const isReg = await contract.isRegistered(DOMAIN);

    if (!isReg) {
        const ipnsKey = ethers.toUtf8Bytes(`ipns-placeholder:${DOMAIN}`);
        const gateways = [
            "https://gateway.pinata.cloud",
            "https://dweb.link",
            "https://cloudflare-ipfs.com",
        ];
        const tx = await contract.register(DOMAIN, ipnsKey, cidBytes, gateways);
        console.log(`   tx : ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`   ✅ Registered — block ${receipt.blockNumber}`);
    } else {
        const entry = await contract.getEntry(DOMAIN);
        const nextSeq = BigInt(entry.latestSeq) + 1n;
        const tx = await contract.logIPNSUpdate(DOMAIN, cidBytes, nextSeq);
        console.log(`   tx : ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`   ✅ IPNS updated seq ${nextSeq} — block ${receipt.blockNumber}`);
    }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
    checkEnv();

    console.log("═══════════════════════════════════════════════════════");
    console.log("  EverDeploy — IPFS Deploy Pipeline");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Domain  : ${DOMAIN}`);
    console.log(`  Env     : ${ENV}`);
    console.log(`  Source  : ${OUT_DIR}`);

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`  Wallet  : ${signer.address}`);
    const bal = await provider.getBalance(signer.address);
    console.log(`  Balance : ${ethers.formatEther(bal)} ETH`);

    const cid = await uploadToPinata();
    await logDeploy(signer, cid);
    await updateIPNS(signer, cid);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  🚀 Deploy complete!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  CID        : ${cid}`);
    console.log(`  Pinata     : https://gateway.pinata.cloud/ipfs/${cid}`);
    console.log(`  dweb.link  : https://${cid}.ipfs.dweb.link`);
    console.log(`  CF gateway : https://cloudflare-ipfs.com/ipfs/${cid}`);
    console.log("═══════════════════════════════════════════════════════");

    const receipt = {
        cid, domain: DOMAIN, env: ENV, timestamp: new Date().toISOString(),
        gateways: {
            pinata: `https://gateway.pinata.cloud/ipfs/${cid}`,
            dweb: `https://${cid}.ipfs.dweb.link`,
            cloudflare: `https://cloudflare-ipfs.com/ipfs/${cid}`,
        },
        contracts: { REGISTRY_CONTRACT, IPNS_REGISTRY_CONTRACT },
    };
    const receiptPath = path.join(__dirname, "../latest-deploy.json");
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
    console.log(`\n  📄 Receipt → ${receiptPath}`);
}

main().catch((err) => {
    console.error("\n❌ Deploy failed:", err.response?.data || err.message || err);
    process.exit(1);
});
