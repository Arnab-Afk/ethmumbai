/**
 * src/routes/sites.js
 *
 * GET  /api/sites/:domain          — get deploy history for a domain
 * GET  /api/sites/:domain/ipns     — get IPNS entry for a domain
 * GET  /api/sites                  — list all deployed domains
 */

const express  = require("express");
const { ethers } = require("ethers");

const router = express.Router();

const REGISTRY_ABI = [
  "function getDeployHistory(string calldata domain, uint256 offset, uint256 limit) external view returns (tuple(bytes cid, address deployer, uint256 timestamp, string domain, string env, string meta)[])",
  "function getLatestDeploy(string calldata domain) external view returns (tuple(bytes cid, address deployer, uint256 timestamp, string domain, string env, string meta))",
  "function getAllDomains() external view returns (string[])",
  "function deployCount(string calldata domain) external view returns (uint256)",
];

const IPNS_ABI = [
  "function isRegistered(string calldata domain) external view returns (bool)",
  "function getEntry(string calldata domain) external view returns (tuple(bytes ipnsKey, bytes latestCid, uint64 latestSeq, uint256 registeredAt, uint256 updatedAt, bool active))",
  "function getGateways(string calldata domain) external view returns (string[])",
];

function getProvider() {
  // batchMaxCount:1 sends each RPC call as a separate request,
  // avoiding drpc.org free-tier's hard limit of 3 requests per batch.
  return new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL, undefined, { batchMaxCount: 1 });
}

function getRegistry() {
  return new ethers.Contract(process.env.REGISTRY_CONTRACT, REGISTRY_ABI, getProvider());
}

function getIPNS() {
  return new ethers.Contract(process.env.IPNS_REGISTRY_CONTRACT, IPNS_ABI, getProvider());
}

// GET /api/sites — list all domains
router.get("/", async (_req, res) => {
  try {
    const registry = getRegistry();
    const domains  = await registry.getAllDomains();
    res.json({ domains });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sites/:domain — deploy history
router.get("/:domain", async (req, res) => {
  try {
    const { domain } = req.params;
    const offset = parseInt(req.query.offset) || 0;
    const limit  = parseInt(req.query.limit)  || 10;

    const registry = getRegistry();
    // Sequential calls to avoid drpc.org free-tier batch limit (max 3)
    const count   = await registry.deployCount(domain);
    const history = await registry.getDeployHistory(domain, offset, limit);
    const latest  = await registry.getLatestDeploy(domain).catch(() => null);

    const format = (d) => ({
      cid:       ethers.toUtf8String(d.cid),
      deployer:  d.deployer,
      env:       d.env,
      meta:      d.meta,
      timestamp: Number(d.timestamp),
      url:       `https://ipfs.io/ipfs/${ethers.toUtf8String(d.cid)}/`,
    });

    res.json({
      domain,
      count:   Number(count),
      latest:  latest ? format(latest) : null,
      history: history.map(format),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sites/:domain/ipns — IPNS entry
router.get("/:domain/ipns", async (req, res) => {
  try {
    const { domain } = req.params;
    const ipns = getIPNS();
    const isReg = await ipns.isRegistered(domain);

    if (!isReg) return res.status(404).json({ error: "Domain not registered in IPNSRegistry" });

    const [entry, gateways] = await Promise.all([
      ipns.getEntry(domain),
      ipns.getGateways(domain).catch(() => []),
    ]);

    const cid = ethers.toUtf8String(entry.latestCid);
    res.json({
      domain,
      ipnsKey:     ethers.toUtf8String(entry.ipnsKey),
      latestCid:   cid,
      latestSeq:   Number(entry.latestSeq),
      registeredAt: Number(entry.registeredAt),
      updatedAt:   Number(entry.updatedAt),
      active:      entry.active,
      gateways,
      url:         `https://ipfs.io/ipfs/${cid}/`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
