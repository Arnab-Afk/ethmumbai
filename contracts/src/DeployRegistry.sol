// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DeployRegistry
 * @notice Immutable on-chain log of every IPFS deploy made through EverDeploy.
 *         Each entry records the IPFS CID, deployer address, ENS domain,
 *         environment, and block timestamp.  Because the history is append-only
 *         it serves as a tamper-proof audit trail that is more trustworthy than
 *         any centralised dashboard.
 *
 * @dev CIDs are stored as raw bytes (max 64 bytes covers both CIDv0 / CIDv1).
 *      Callers encode e.g. `bytes(cid)` on the client side.
 */
contract DeployRegistry is Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────── structs ──

    struct Deploy {
        /// @notice IPFS CID of the deployed build (raw bytes, up to 64 bytes)
        bytes   cid;
        /// @notice Wallet that signed / submitted the deploy
        address deployer;
        /// @notice block.timestamp at the time of logging
        uint256 timestamp;
        /// @notice ENS domain this deploy is associated with (e.g. "myapp.eth")
        string  domain;
        /// @notice Environment label – "production" | "staging" | "preview"
        string  env;
        /// @notice Arbitrary deploy metadata (commit hash, PR number, etc.)
        string  meta;
    }

    // ──────────────────────────────────────────── storage ──

    /// @notice domain string → ordered list of all deploys for that domain
    mapping(string => Deploy[]) private _history;

    /// @notice All domains that have ever had a deploy logged
    string[] private _allDomains;

    /// @notice Quick lookup: has this domain been seen before?
    mapping(string => bool) private _domainSeen;

    /// @notice Optional per-domain allowlists.  If the list is non-empty only
    ///         addresses on it may log deploys for that domain.
    mapping(string => mapping(address => bool)) private _authorized;
    mapping(string => bool) private _hasAllowlist;

    // ─────────────────────────────────────────────── events ──

    event Deployed(
        string  indexed domain,
        uint256 indexed deployIndex,
        bytes           cid,
        address indexed deployer,
        string          env,
        uint256         timestamp
    );

    event AuthorizationSet(string indexed domain, address indexed account, bool authorized);
    event AllowlistEnabled(string indexed domain);

    // ─────────────────────────────────────────── errors ──

    error EmptyCID();
    error EmptyDomain();
    error NotAuthorized(string domain, address caller);
    error InvalidEnv(string env);

    // ───────────────────────────────────────── constants ──

    bytes32 private constant ENV_PRODUCTION = keccak256("production");
    bytes32 private constant ENV_STAGING    = keccak256("staging");
    bytes32 private constant ENV_PREVIEW    = keccak256("preview");

    // ──────────────────────────────────────── constructor ──

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ──────────────────────────────── external / public ──────────

    /**
     * @notice Log a new deploy for an ENS domain.
     *
     * @param domain  ENS domain (e.g. "myapp.eth")
     * @param cid     IPFS CID as raw bytes  (e.g. `bytes("bafybeig3...")`)
     * @param env     One of "production" | "staging" | "preview"
     * @param meta    Optional freeform metadata (commit SHA, build number…)
     */
    function logDeploy(
        string calldata domain,
        bytes  calldata cid,
        string calldata env,
        string calldata meta
    ) external nonReentrant {
        if (bytes(cid).length    == 0) revert EmptyCID();
        if (bytes(domain).length == 0) revert EmptyDomain();
        _validateEnv(env);
        _checkAuth(domain, msg.sender);

        if (!_domainSeen[domain]) {
            _domainSeen[domain] = true;
            _allDomains.push(domain);
        }

        uint256 idx = _history[domain].length;

        _history[domain].push(Deploy({
            cid:       cid,
            deployer:  msg.sender,
            timestamp: block.timestamp,
            domain:    domain,
            env:       env,
            meta:      meta
        }));

        emit Deployed(domain, idx, cid, msg.sender, env, block.timestamp);
    }

    // ────────────────────────────────── read helpers ──

    /// @notice Returns the full Deploy struct for a specific index.
    function getDeploy(string calldata domain, uint256 index)
        external view returns (Deploy memory)
    {
        return _history[domain][index];
    }

    /// @notice Returns the most recent deploy for a domain.
    function getLatestDeploy(string calldata domain)
        external view returns (Deploy memory)
    {
        Deploy[] storage hist = _history[domain];
        require(hist.length > 0, "No deploys for domain");
        return hist[hist.length - 1];
    }

    /// @notice Total number of deploys for a domain.
    function deployCount(string calldata domain) external view returns (uint256) {
        return _history[domain].length;
    }

    /// @notice Paginated deploy history (newest-first).
    /// @param offset  starting index (0 = oldest)
    /// @param limit   max entries to return
    function getDeployHistory(
        string calldata domain,
        uint256 offset,
        uint256 limit
    ) external view returns (Deploy[] memory result) {
        Deploy[] storage hist = _history[domain];
        uint256 total = hist.length;
        if (offset >= total) return new Deploy[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        result = new Deploy[](count);
        // Return newest-first
        for (uint256 i = 0; i < count; i++) {
            result[i] = hist[total - 1 - offset - i];
        }
    }

    /// @notice All domains that have had at least one deploy.
    function getAllDomains() external view returns (string[] memory) {
        return _allDomains;
    }

    // ──────────────────────────── allowlist management ──────────

    /**
     * @notice Enable an allowlist for a domain and immediately add the first
     *         authorised address.  Once enabled the allowlist cannot be turned
     *         off (only addresses can be added/removed).
     * @dev Only the contract owner may call this; in practice the platform
     *      relayer or a governance Safe would hold ownership.
     */
    function enableAllowlist(string calldata domain, address[] calldata initial)
        external onlyOwner
    {
        _hasAllowlist[domain] = true;
        for (uint256 i = 0; i < initial.length; i++) {
            _authorized[domain][initial[i]] = true;
            emit AuthorizationSet(domain, initial[i], true);
        }
        emit AllowlistEnabled(domain);
    }

    /// @notice Add or remove an address from a domain's allowlist.
    function setAuthorized(string calldata domain, address account, bool authorised)
        external onlyOwner
    {
        _authorized[domain][account] = authorised;
        emit AuthorizationSet(domain, account, authorised);
    }

    /// @notice Check whether `account` may log a deploy for `domain`.
    function isAuthorized(string calldata domain, address account)
        external view returns (bool)
    {
        if (!_hasAllowlist[domain]) return true; // open by default
        return _authorized[domain][account];
    }

    // ─────────────────────────────── internal helpers ──────────

    function _validateEnv(string calldata env) internal pure {
        bytes32 h = keccak256(bytes(env));
        if (h != ENV_PRODUCTION && h != ENV_STAGING && h != ENV_PREVIEW) {
            revert InvalidEnv(env);
        }
    }

    function _checkAuth(string calldata domain, address caller) internal view {
        if (_hasAllowlist[domain] && !_authorized[domain][caller]) {
            revert NotAuthorized(domain, caller);
        }
    }
}
