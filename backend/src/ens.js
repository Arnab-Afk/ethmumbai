/**
 * src/ens.js
 * ENS helpers for:
 *  - auto-assigned offchain subnames under d3ploy.eth (server-managed)
 *  - custom ENS names (client-managed)
 */

const crypto = require("crypto");

const DEFAULT_PARENT = process.env.D3PLOY_PARENT_ENS || "d3ploy.eth";
const DEFAULT_NAMESPACE_MODE = process.env.NAMESPACE_MODE || "mainnet";

const ADJECTIVES = [
    "amber", "azure", "bold", "brisk", "calm", "crisp", "daring", "eager", "fierce", "gentle",
    "golden", "lunar", "lively", "misty", "noble", "rapid", "silver", "solar", "swift", "wild",
];

const NOUNS = [
    "anchor", "beacon", "cloud", "comet", "falcon", "forge", "harbor", "lotus", "maple", "meadow",
    "nova", "oasis", "otter", "phoenix", "river", "sparrow", "summit", "tiger", "valley", "voyager",
];

function isValidEnsName(name) {
    return typeof name === "string" && name.includes(".") && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(name.trim());
}

function normalizeEnsName(name) {
    return (name || "").trim().toLowerCase();
}

function splitSubname(fullName) {
    const normalized = normalizeEnsName(fullName);
    const parts = normalized.split(".").filter(Boolean);
    if (parts.length < 3) {
        throw new Error(`Invalid subname: ${fullName}. Expected format like label.${DEFAULT_PARENT}`);
    }

    const label = parts[0];
    const parentName = parts.slice(1).join(".");
    return { label, parentName };
}

function createAutoLabel() {
    const adjective = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
    const noun = NOUNS[crypto.randomInt(0, NOUNS.length)];
    const suffix = crypto.randomBytes(2).toString("hex");
    return `${adjective}-${noun}-${suffix}`;
}

function buildAutoAssignedEnsName(parentName = DEFAULT_PARENT) {
    return `${createAutoLabel()}.${normalizeEnsName(parentName)}`;
}

async function loadOffchainSdk() {
    try {
        return require("@thenamespace/offchain-manager");
    } catch (_err) {
        return await import("@thenamespace/offchain-manager");
    }
}

async function createOffchainClient() {
    const namespaceApiKey = process.env.NAMESPACE_API_KEY;
    if (!namespaceApiKey) {
        throw new Error("NAMESPACE_API_KEY is required for auto-assigned ENS subname updates");
    }

    const sdk = await loadOffchainSdk();
    const createClient = sdk.createOffchainClient || sdk.default?.createOffchainClient;

    if (typeof createClient !== "function") {
        throw new Error("Unable to initialize Namespace Offchain SDK client");
    }

    const client = createClient({ mode: DEFAULT_NAMESPACE_MODE });
    if (typeof client.setDefaultApiKey === "function") {
        client.setDefaultApiKey(namespaceApiKey);
    }

    return client;
}

async function upsertAutoSubnameContenthash(fullName, cid, log = console.log) {
    const normalizedFullName = normalizeEnsName(fullName);
    const contenthash = `ipfs://${cid}`;

    if (!isValidEnsName(normalizedFullName)) {
        throw new Error(`Invalid ENS name: ${fullName}`);
    }

    const client = await createOffchainClient();

    // Prefer update; fallback to create when subname does not exist yet.
    try {
        await client.updateSubname(normalizedFullName, { contenthash });
        log(`  ✅ Namespace updated: ${normalizedFullName} -> ${contenthash}`);
        return { fullName: normalizedFullName, contenthash, action: "updated" };
    } catch (updateErr) {
        const { label, parentName } = splitSubname(normalizedFullName);
        try {
            await client.createSubname({
                label,
                parentName,
                contenthash,
            });
            log(`  ✅ Namespace created: ${normalizedFullName} -> ${contenthash}`);
            return { fullName: normalizedFullName, contenthash, action: "created" };
        } catch (createErr) {
            const updateMsg = updateErr?.message || "Unknown updateSubname error";
            const createMsg = createErr?.message || "Unknown createSubname error";
            throw new Error(`Namespace ENS update failed for ${normalizedFullName}. updateSubname: ${updateMsg}. createSubname: ${createMsg}`);
        }
    }
}

module.exports = {
    DEFAULT_PARENT,
    buildAutoAssignedEnsName,
    isValidEnsName,
    normalizeEnsName,
    upsertAutoSubnameContenthash,
};
