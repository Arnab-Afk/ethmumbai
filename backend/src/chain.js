/**
 * src/chain.js
 * On-chain interactions — DeployRegistry + IPNSRegistry
 */

const { ethers } = require("ethers");

const REGISTRY_ABI = [
  "function logDeploy(string calldata domain, bytes calldata cid, string calldata env, string calldata meta) external",
];

const IPNS_ABI = [
  "function isRegistered(string calldata domain) external view returns (bool)",
  "function getEntry(string calldata domain) external view returns (tuple(bytes ipnsKey, bytes latestCid, uint64 latestSeq, uint256 registeredAt, uint256 updatedAt, bool active))",
  "function register(string calldata domain, bytes calldata ipnsKey, bytes calldata initialCid, string[] calldata gateways) external",
  "function logIPNSUpdate(string calldata domain, bytes calldata cid, uint64 sequence) external",
];

function getSigner() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL, undefined, { batchMaxCount: 1 });
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider);
}

async function logDeploy(domain, cid, env = "production", meta = "", log = console.log) {
  const signer   = getSigner();
  const nonce    = await signer.provider.getTransactionCount(signer.address, "pending");
  const contract = new ethers.Contract(process.env.REGISTRY_CONTRACT, REGISTRY_ABI, signer);
  log(`  ⛓️  DeployRegistry.logDeploy() nonce=${nonce}`);
  const tx = await contract.logDeploy(
    domain,
    ethers.toUtf8Bytes(cid),
    env,
    meta || `ipfs:${cid},ts:${Date.now()}`,
    { nonce }
  );
  log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  log(`  ✅ Block ${receipt.blockNumber}`);
  return receipt;
}

async function updateIPNS(domain, cid, options = {}, log = console.log) {
  const { ipnsKey: providedIpnsKey = null } = options || {};
  const signer   = getSigner();
  const nonce    = await signer.provider.getTransactionCount(signer.address, "pending");
  const contract = new ethers.Contract(process.env.IPNS_REGISTRY_CONTRACT, IPNS_ABI, signer);
  const cidBytes = ethers.toUtf8Bytes(cid);
  const isReg    = await contract.isRegistered(domain);

  if (!isReg) {
    const stableIpnsKey = providedIpnsKey || `ipns-placeholder:${domain}`;
    const ipnsKey  = ethers.toUtf8Bytes(stableIpnsKey);
    const gateways = ["https://gateway.pinata.cloud", "https://dweb.link", "https://ipfs.io"];
    log(`  🔗 IPNSRegistry.register() nonce=${nonce}`);
    const tx = await contract.register(domain, ipnsKey, cidBytes, gateways, { nonce });
    log(`  tx: ${tx.hash}`);
    const receipt = await tx.wait();
    log(`  ✅ Registered — block ${receipt.blockNumber}`);
    return receipt;
  } else {
    const entry   = await contract.getEntry(domain);
    const nextSeq = BigInt(entry.latestSeq) + 1n;
    log(`  🔗 IPNSRegistry.logIPNSUpdate() seq=${nextSeq} nonce=${nonce}`);
    const tx = await contract.logIPNSUpdate(domain, cidBytes, nextSeq, { nonce });
    log(`  tx: ${tx.hash}`);
    const receipt = await tx.wait();
    log(`  ✅ Updated seq ${nextSeq} — block ${receipt.blockNumber}`);
    return receipt;
  }
}

module.exports = { logDeploy, updateIPNS, getSigner };
