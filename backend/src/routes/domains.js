/**
 * src/routes/domains.js
 * Custom ENS domain verification + ENS->IPNS setup authorization.
 */

const crypto = require("crypto");
const express = require("express");
const { ethers } = require("ethers");

const { requireAuth } = require("../auth");
const store = require("../store");
const {
  isValidEnsName,
  normalizeEnsName,
  verifyCustomEnsOwnership,
} = require("../ens");

const router = express.Router();

function makeIpnsKey(ensName) {
  const suffix = crypto.randomBytes(4).toString("hex");
  return `k51-${ensName.replace(/\./g, "-")}-${suffix}`;
}

function makeChallengeMessage({ ensName, walletAddress, ipnsKey, nonce }) {
  return [
    "D3PLOY Custom ENS Verification",
    `ENS Name: ${ensName}`,
    `Wallet: ${walletAddress}`,
    `IPNS Key: ${ipnsKey}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    "Sign this message to verify ownership and authorize ENS->IPNS setup.",
  ].join("\n");
}

router.post("/custom/init", requireAuth, async (req, res) => {
  const { ensName, walletAddress } = req.body;
  const normalizedEns = normalizeEnsName(ensName);

  if (!isValidEnsName(normalizedEns)) {
    return res.status(400).json({ error: "Invalid ENS name" });
  }
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: "Invalid walletAddress" });
  }

  try {
    const isOwner = await verifyCustomEnsOwnership(normalizedEns, walletAddress);
    if (!isOwner) {
      return res.status(403).json({ error: `Wallet ${walletAddress} is not the owner of ${normalizedEns}` });
    }

    const existing = store.getVerifiedCustomDomain(normalizedEns);
    const ipnsKey = existing?.ipnsKey || makeIpnsKey(normalizedEns);
    const nonce = crypto.randomBytes(12).toString("hex");
    const message = makeChallengeMessage({
      ensName: normalizedEns,
      walletAddress,
      ipnsKey,
      nonce,
    });

    store.setPendingCustomDomain(normalizedEns, {
      ensName: normalizedEns,
      walletAddress: walletAddress.toLowerCase(),
      ipnsKey,
      nonce,
      message,
      requestedBy: req.user.sub,
    });

    return res.json({
      ensName: normalizedEns,
      walletAddress,
      ipnsKey,
      nonce,
      message,
      note: "Sign this message with your ENS owner wallet to complete verification.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unable to verify ENS ownership" });
  }
});

router.post("/custom/verify", requireAuth, async (req, res) => {
  const { ensName, walletAddress, signature } = req.body;
  const normalizedEns = normalizeEnsName(ensName);

  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ error: "signature is required" });
  }
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: "Invalid walletAddress" });
  }

  const pending = store.getPendingCustomDomain(normalizedEns);
  if (!pending) {
    return res.status(404).json({ error: "No pending verification found. Start with /api/domains/custom/init" });
  }
  if (pending.requestedBy !== req.user.sub) {
    return res.status(403).json({ error: "This verification was initiated by another user" });
  }

  try {
    const recovered = ethers.verifyMessage(pending.message, signature).toLowerCase();
    if (recovered !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: "Signature does not match walletAddress" });
    }

    const stillOwner = await verifyCustomEnsOwnership(normalizedEns, walletAddress);
    if (!stillOwner) {
      return res.status(403).json({ error: "Wallet is no longer owner of this ENS name" });
    }

    store.setVerifiedCustomDomain(normalizedEns, {
      walletAddress: walletAddress.toLowerCase(),
      ipnsKey: pending.ipnsKey,
      verifiedBy: req.user.sub,
      ensToIpnsStatus: "ownership-verified-awaiting-ens-tx",
      ensToIpnsConfigured: false,
      verificationSignature: signature,
    });
    store.deletePendingCustomDomain(normalizedEns);

    return res.json({
      ok: true,
      ensName: normalizedEns,
      walletAddress,
      ipnsKey: pending.ipnsKey,
      ensToIpnsStatus: "ownership-verified-awaiting-ens-tx",
      ensToIpnsConfigured: false,
      note: "Custom ENS ownership verified. Set ENS contenthash to ipns://<ipnsKey> from your wallet, then confirm the tx hash.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Verification failed" });
  }
});

router.post("/custom/confirm-link", requireAuth, (req, res) => {
  const { ensName, txHash } = req.body;
  const normalizedEns = normalizeEnsName(ensName);

  if (!txHash || typeof txHash !== "string" || !/^0x([A-Fa-f0-9]{64})$/.test(txHash)) {
    return res.status(400).json({ error: "Valid txHash is required" });
  }

  const verified = store.getVerifiedCustomDomain(normalizedEns);
  if (!verified) {
    return res.status(404).json({ error: "Custom domain not verified yet" });
  }
  if (verified.verifiedBy !== req.user.sub) {
    return res.status(403).json({ error: "Not your custom domain record" });
  }

  store.setVerifiedCustomDomain(normalizedEns, {
    ...verified,
    ensToIpnsStatus: "linked-onchain",
    ensToIpnsConfigured: true,
    ensToIpnsTxHash: txHash,
  });

  return res.json({
    ok: true,
    ensName: normalizedEns,
    ensToIpnsStatus: "linked-onchain",
    ensToIpnsConfigured: true,
    ensToIpnsTxHash: txHash,
  });
});

router.get("/custom/:ensName", requireAuth, (req, res) => {
  const ensName = normalizeEnsName(req.params.ensName);
  const verified = store.getVerifiedCustomDomain(ensName);

  if (!verified) return res.status(404).json({ error: "Custom domain not verified" });
  if (verified.verifiedBy !== req.user.sub) {
    return res.status(403).json({ error: "Not your custom domain record" });
  }

  return res.json({
    ensName,
    walletAddress: verified.walletAddress,
    ipnsKey: verified.ipnsKey,
    ensToIpnsStatus: verified.ensToIpnsStatus,
    ensToIpnsConfigured: !!verified.ensToIpnsConfigured,
    ensToIpnsTxHash: verified.ensToIpnsTxHash || null,
    verifiedAt: verified.verifiedAt,
  });
});

router.get("/custom", requireAuth, (req, res) => {
  const domains = store.getVerifiedCustomDomainsForUser(req.user.sub).map((d) => ({
    ensName: d.ensName,
    walletAddress: d.walletAddress,
    ipnsKey: d.ipnsKey,
    ensToIpnsStatus: d.ensToIpnsStatus,
    ensToIpnsConfigured: !!d.ensToIpnsConfigured,
    ensToIpnsTxHash: d.ensToIpnsTxHash || null,
    verifiedAt: d.verifiedAt,
  }));
  return res.json({ domains });
});

module.exports = router;
