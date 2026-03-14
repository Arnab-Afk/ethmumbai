// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPNSRegistry
 * @notice On-chain registry that maps ENS domains to their IPNS keys and tracks
 *         every IPNS CID update.
 *
 * Background
 * ──────────
 * A raw IPFS CID changes with every deploy.  IPNS (InterPlanetary Name System)
 * provides a *stable, mutable pointer* — a persistent address that always
 * resolves to the latest CID without requiring a new ENS transaction.
 *
 * EverDeploy uses w3name (https://github.com/web3-storage/w3name) to update IPNS
 * records cheaply off-chain.  This contract provides:
 *
 *  1. **IPNS key registration** — Associates a domain with its w3name public key
 *     so clients can resolve `ipns://<key>` without needing a centralised index.
 *
 *  2. **IPNS update log** — An append-only, ordered list of every `(CID, sequence)`
 *     pair published for a domain.  Useful for auditing, rollback discovery, and
 *     building cross-gateway resolvers that don't rely on the w3name API alone.
 *
 *  3. **Gateway hints** — Optional list of preferred IPFS gateway URLs the deployer
 *     trusts, readable by frontends.
 *
 * How it fits with DeployRegistry
 * ────────────────────────────────
 * The `DeployRegistry` is the canonical source of *production* deploys (full CID
 * + ENS contenthash update).  `IPNSRegistry` is the fast-path layer: preview
 * builds, staging, and rapid iterations only touch IPNS (zero gas, off-chain
 * signing), and this contract makes those updates discoverable on-chain.
 */
contract IPNSRegistry is Ownable, ReentrancyGuard {

    // ─────────────────────────────────── structs ──

    /**
     * @notice A single published IPNS record update.
     * @param cid       IPFS CID being pointed at (raw bytes)
     * @param sequence  w3name sequence number — must be strictly monotonically
     *                  increasing to prevent replay attacks at the IPNS layer.
     * @param timestamp block.timestamp when this update was logged
     * @param publisher wallet that called logIPNSUpdate()
     */
    struct IPNSUpdate {
        bytes   cid;
        uint64  sequence;
        uint256 timestamp;
        address publisher;
    }

    /**
     * @notice Full IPNS entry for one domain.
     * @param ipnsKey      w3name public key (CID-encoded, e.g. "k51qzi5uqu5…")
     *                     stored as raw bytes for gas efficiency.
     * @param latestCid    Most recently logged CID
     * @param latestSeq    Most recently logged sequence number
     * @param registeredAt block.timestamp when the key was first registered
     * @param updatedAt    block.timestamp of the last update
     * @param active       Whether the entry is still valid
     */
    struct IPNSEntry {
        bytes   ipnsKey;
        bytes   latestCid;
        uint64  latestSeq;
        uint256 registeredAt;
        uint256 updatedAt;
        bool    active;
    }

    // ──────────────────────────────────── storage ──

    /// @notice ENS domain → IPNS entry
    mapping(string => IPNSEntry) private _entries;

    /// @notice ENS domain → ordered list of all updates (oldest first)
    mapping(string => IPNSUpdate[]) private _updates;

    /// @notice ENS domain → list of authorised publishers (delegated wallets)
    mapping(string => mapping(address => bool)) private _publishers;

    /// @notice ENS domain → preferred gateway URLs
    mapping(string => string[]) private _gateways;

    /// @notice All registered domain keys (for enumeration)
    string[] private _allDomains;
    mapping(string => bool) private _registered;

    // ──────────────────────────────────── events ──

    event IPNSKeyRegistered(
        string  indexed domain,
        bytes           ipnsKey,
        address indexed registrant,
        uint256         timestamp
    );

    event IPNSUpdated(
        string  indexed domain,
        bytes           cid,
        uint64          sequence,
        address indexed publisher,
        uint256         timestamp
    );

    event PublisherSet(string indexed domain, address indexed publisher, bool authorised);
    event GatewaysUpdated(string indexed domain, string[] gateways);
    event IPNSKeyDeregistered(string indexed domain);

    // ──────────────────────────────────── errors ──

    error DomainAlreadyRegistered(string domain);
    error DomainNotRegistered(string domain);
    error NotAuthorised(string domain, address caller);
    error InvalidIPNSKey();
    error InvalidCID();
    error SequenceNotMonotonic(uint64 current, uint64 supplied);
    error TooManyGateways(uint256 max, uint256 supplied);

    // ─────────────────────────────────── constants ──

    uint256 public constant MAX_GATEWAYS = 10;

    // ──────────────────────────────── constructor ──

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─────────────────────────── external / public ───────────────

    /**
     * @notice Register an IPNS key for an ENS domain.
     *
     * @param domain    ENS domain (e.g. "myapp.eth")
     * @param ipnsKey   w3name public key bytes (e.g. bytes("k51qzi5uqu5…"))
     * @param initialCid  Optional first IPFS CID to record alongside registration
     * @param gateways  Up to MAX_GATEWAYS preferred gateway URLs
     *
     * @dev Only one IPNS key may be registered per domain.  To change the key
     *      (e.g. key rotation), call deregister() first, then register again.
     *      The caller becomes the initial authorised publisher.
     */
    function register(
        string   calldata domain,
        bytes    calldata ipnsKey,
        bytes    calldata initialCid,
        string[] calldata gateways
    ) external nonReentrant {
        if (_registered[domain])          revert DomainAlreadyRegistered(domain);
        if (bytes(ipnsKey).length == 0)   revert InvalidIPNSKey();
        if (gateways.length > MAX_GATEWAYS) revert TooManyGateways(MAX_GATEWAYS, gateways.length);

        _entries[domain] = IPNSEntry({
            ipnsKey:      ipnsKey,
            latestCid:    initialCid,
            latestSeq:    0,
            registeredAt: block.timestamp,
            updatedAt:    block.timestamp,
            active:       true
        });

        _publishers[domain][msg.sender] = true;
        _registered[domain] = true;
        _allDomains.push(domain);

        if (gateways.length > 0) {
            _gateways[domain] = gateways;
            emit GatewaysUpdated(domain, gateways);
        }

        emit IPNSKeyRegistered(domain, ipnsKey, msg.sender, block.timestamp);

        if (initialCid.length > 0) {
            _recordUpdate(domain, initialCid, 0);
        }
    }

    /**
     * @notice Log a new IPNS update (CID + sequence number).
     *
     * @param domain    ENS domain
     * @param cid       New IPFS CID being pointed at
     * @param sequence  w3name sequence number (must be > previous sequence)
     *
     * @dev This does NOT perform the actual IPNS publish — that is handled
     *      off-chain by the CLI / GitHub Action using the w3name private key.
     *      This function only records the update on-chain for auditability.
     *      Sequence 0 is only permitted on the very first update (from register).
     */
    function logIPNSUpdate(
        string calldata domain,
        bytes  calldata cid,
        uint64          sequence
    ) external nonReentrant {
        _assertActive(domain);
        _assertPublisher(domain, msg.sender);
        if (bytes(cid).length == 0) revert InvalidCID();

        IPNSEntry storage entry = _entries[domain];

        // Sequence must be >= latestSeq + 1 (strictly monotonic after first update)
        if (_updates[domain].length > 0 && sequence <= entry.latestSeq) {
            revert SequenceNotMonotonic(entry.latestSeq, sequence);
        }

        _recordUpdate(domain, cid, sequence);
    }

    /**
     * @notice Convenience: update gateways list for a domain.
     * @dev Only authorised publishers.
     */
    function updateGateways(string calldata domain, string[] calldata gateways)
        external
    {
        _assertActive(domain);
        _assertPublisher(domain, msg.sender);
        if (gateways.length > MAX_GATEWAYS) revert TooManyGateways(MAX_GATEWAYS, gateways.length);

        _gateways[domain] = gateways;
        emit GatewaysUpdated(domain, gateways);
    }

    /**
     * @notice Grant or revoke publisher rights for a domain.
     * @dev Only the contract owner (platform) can manage publisher lists.
     *      The primary deployer can also self-delegate via the owner.
     */
    function setPublisher(string calldata domain, address publisher, bool authorised)
        external onlyOwner
    {
        _assertActive(domain);
        _publishers[domain][publisher] = authorised;
        emit PublisherSet(domain, publisher, authorised);
    }

    /**
     * @notice Deregister an IPNS key for a domain (e.g. for key rotation).
     * @dev Only the contract owner can deregister.
     */
    function deregister(string calldata domain) external onlyOwner {
        _assertActive(domain);
        _entries[domain].active = false;
        emit IPNSKeyDeregistered(domain);
    }

    // ─────────────────────────────── read / view ─────────────────

    /// @notice Returns the full IPNSEntry for a domain.
    function getEntry(string calldata domain) external view returns (IPNSEntry memory) {
        return _entries[domain];
    }

    /// @notice Returns the latest logged CID and sequence number for quick resolution.
    function getLatest(string calldata domain)
        external view returns (bytes memory cid, uint64 sequence, uint256 timestamp)
    {
        _assertActive(domain);
        IPNSEntry storage e = _entries[domain];
        return (e.latestCid, e.latestSeq, e.updatedAt);
    }

    /// @notice Total number of IPNS updates logged for a domain.
    function updateCount(string calldata domain) external view returns (uint256) {
        return _updates[domain].length;
    }

    /// @notice Paginated update history for a domain (oldest first).
    function getUpdateHistory(
        string calldata domain,
        uint256 offset,
        uint256 limit
    ) external view returns (IPNSUpdate[] memory result) {
        IPNSUpdate[] storage hist = _updates[domain];
        uint256 total = hist.length;
        if (offset >= total) return new IPNSUpdate[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        result = new IPNSUpdate[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = hist[offset + i];
        }
    }

    /// @notice Returns gateway URLs registered for a domain.
    function getGateways(string calldata domain) external view returns (string[] memory) {
        return _gateways[domain];
    }

    /// @notice Check whether an address is an authorised publisher for a domain.
    function isPublisher(string calldata domain, address publisher)
        external view returns (bool)
    {
        return _publishers[domain][publisher];
    }

    /// @notice Whether a domain has a registered IPNS key.
    function isRegistered(string calldata domain) external view returns (bool) {
        return _registered[domain] && _entries[domain].active;
    }

    /// @notice All registered (including deregistered) domains.
    function getAllDomains() external view returns (string[] memory) {
        return _allDomains;
    }

    // ─────────────────────────────────── internal ─────────────────

    function _recordUpdate(string calldata domain, bytes calldata cid, uint64 sequence) internal {
        IPNSEntry storage entry = _entries[domain];
        entry.latestCid  = cid;
        entry.latestSeq  = sequence;
        entry.updatedAt  = block.timestamp;

        _updates[domain].push(IPNSUpdate({
            cid:       cid,
            sequence:  sequence,
            timestamp: block.timestamp,
            publisher: msg.sender
        }));

        emit IPNSUpdated(domain, cid, sequence, msg.sender, block.timestamp);
    }

    function _assertActive(string calldata domain) internal view {
        if (!_registered[domain] || !_entries[domain].active) {
            revert DomainNotRegistered(domain);
        }
    }

    function _assertPublisher(string calldata domain, address caller) internal view {
        if (!_publishers[domain][caller]) {
            revert NotAuthorised(domain, caller);
        }
    }
}
