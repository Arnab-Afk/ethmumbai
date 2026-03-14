// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SubnameRegistry
 * @notice Issues and manages ENS subnames under the platform's parent domain
 *         (e.g. `app.web3deploy.eth`).  Each subname is claimed by a specific
 *         wallet, which then has full control: they can update the IPFS CID
 *         pointer stored here and transfer ownership to another address.
 *
 * @dev This contract manages the *off-chain* data (owner, CID, metadata) for
 *      subnames.  The actual ENS resolver update (setting the ENS `contenthash`
 *      record on-chain) is handled by the platform's backend relayer after
 *      verifying a claim event from this contract.  Integrating directly with
 *      the ENS NameWrapper is also possible and left as a Phase-2 upgrade.
 */
contract SubnameRegistry is Ownable, ReentrancyGuard {
    // ──────────────────────────────────── structs ──

    struct Subname {
        /// @notice Wallet that owns this subname
        address owner;
        /// @notice Latest IPFS CID pointed at by this subname
        bytes   cid;
        /// @notice When the subname was first claimed (block timestamp)
        uint256 claimedAt;
        /// @notice When the CID was last updated
        uint256 updatedAt;
        /// @notice Whether this subname has been claimed
        bool    active;
        /// @notice Optional metadata (framework, description, …)
        string  meta;
    }

    // ──────────────────────────────────── storage ──

    /// @notice label → Subname record (label = "myproject" in "myproject.app.web3deploy.eth")
    mapping(string => Subname) private _subnames;

    /// @notice owner address → list of labels they own
    mapping(address => string[]) private _ownedLabels;

    /// @notice Total subnames ever claimed
    uint256 public totalClaims;

    /// @notice Flat fee in wei to claim a subname (0 = free)
    uint256 public claimFee;

    /// @notice Maximum label length (default 32 characters)
    uint256 public maxLabelLength;

    // ──────────────────────────────────── events ──

    event SubnameClaimed(string indexed label, address indexed owner, uint256 timestamp);
    event SubnameUpdated(string indexed label, address indexed owner, bytes  cid);
    event SubnameTransferred(string indexed label, address indexed from, address indexed to);
    event SubnameRevoked(string indexed label, address indexed revokedBy);
    event ClaimFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ──────────────────────────────────── errors ──

    error LabelAlreadyClaimed(string label);
    error LabelNotClaimed(string label);
    error NotSubnameOwner(string label, address caller);
    error InvalidLabel(string reason);
    error InsufficientFee(uint256 required, uint256 sent);

    // ───────────────────────────────── constructor ──

    constructor(address initialOwner, uint256 _claimFee, uint256 _maxLabelLength)
        Ownable(initialOwner)
    {
        claimFee       = _claimFee;
        maxLabelLength = _maxLabelLength == 0 ? 32 : _maxLabelLength;
    }

    // ──────────────────────────── external / public ──────────

    /**
     * @notice Claim a subname label.
     * @param label    The subdomain label to claim (e.g. "myproject").
     *                 Must be lowercase alphanumeric + hyphens, ≤ maxLabelLength.
     * @param initialCid  Optional initial IPFS CID (pass empty bytes to set later).
     * @param meta     Optional freeform metadata.
     */
    function claim(
        string calldata label,
        bytes  calldata initialCid,
        string calldata meta
    ) external payable nonReentrant {
        _validateLabel(label);

        if (_subnames[label].active) revert LabelAlreadyClaimed(label);
        if (msg.value < claimFee)    revert InsufficientFee(claimFee, msg.value);

        _subnames[label] = Subname({
            owner:     msg.sender,
            cid:       initialCid,
            claimedAt: block.timestamp,
            updatedAt: block.timestamp,
            active:    true,
            meta:      meta
        });

        _ownedLabels[msg.sender].push(label);
        totalClaims++;

        emit SubnameClaimed(label, msg.sender, block.timestamp);

        if (bytes(initialCid).length > 0) {
            emit SubnameUpdated(label, msg.sender, initialCid);
        }
    }

    /**
     * @notice Update the IPFS CID for a subname you own.
     */
    function updateCID(string calldata label, bytes calldata cid, string calldata meta)
        external nonReentrant
    {
        _onlyOwnerOf(label);

        Subname storage sub      = _subnames[label];
        sub.cid                  = cid;
        sub.updatedAt            = block.timestamp;
        if (bytes(meta).length > 0) sub.meta = meta;

        emit SubnameUpdated(label, msg.sender, cid);
    }

    /**
     * @notice Transfer ownership of a subname to another address.
     */
    function transfer(string calldata label, address newOwner)
        external nonReentrant
    {
        _onlyOwnerOf(label);
        require(newOwner != address(0), "Zero address");

        address prev = _subnames[label].owner;
        _subnames[label].owner = newOwner;
        _ownedLabels[newOwner].push(label);
        // Note: we don't remove from prev's list here to keep gas low;
        // use getOwnedLabels which filters by active + owner match.

        emit SubnameTransferred(label, prev, newOwner);
    }

    // ──────────────────────────────── read helpers ──

    /// @notice Returns the full Subname struct for a label.
    function getSubname(string calldata label) external view returns (Subname memory) {
        return _subnames[label];
    }

    /// @notice Check whether a label is already taken.
    function isClaimed(string calldata label) external view returns (bool) {
        return _subnames[label].active;
    }

    /// @notice All labels owned by an address (may include transferred-away labels;
    ///         filter by `owner == caller && active` on the client side).
    function getOwnedLabels(address owner) external view returns (string[] memory) {
        return _ownedLabels[owner];
    }

    // ──────────────────────────── admin functions ──────────

    /**
     * @notice Revoke a subname (e.g. for abuse).  Owner-only.
     */
    function revoke(string calldata label) external onlyOwner {
        if (!_subnames[label].active) revert LabelNotClaimed(label);
        _subnames[label].active = false;
        emit SubnameRevoked(label, msg.sender);
    }

    /// @notice Update the claim fee.
    function setClaimFee(uint256 newFee) external onlyOwner {
        emit ClaimFeeUpdated(claimFee, newFee);
        claimFee = newFee;
    }

    /// @notice Update the maximum label length.
    function setMaxLabelLength(uint256 max) external onlyOwner {
        require(max > 0, "Zero length");
        maxLabelLength = max;
    }

    /// @notice Withdraw accumulated fees.
    function withdrawFees(address payable to) external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");
        (bool ok, ) = to.call{value: bal}("");
        require(ok, "Transfer failed");
        emit FeesWithdrawn(to, bal);
    }

    // ──────────────────────────── internal helpers ──────────

    function _onlyOwnerOf(string calldata label) internal view {
        Subname storage sub = _subnames[label];
        if (!sub.active)             revert LabelNotClaimed(label);
        if (sub.owner != msg.sender) revert NotSubnameOwner(label, msg.sender);
    }

    /**
     * @dev Validates that the label is:
     *   - non-empty and within maxLabelLength
     *   - only lowercase a-z, 0-9, or hyphen
     *   - does not start or end with a hyphen
     */
    function _validateLabel(string calldata label) internal view {
        bytes memory b = bytes(label);
        uint256 len    = b.length;

        if (len == 0 || len > maxLabelLength) revert InvalidLabel("bad length");
        if (b[0] == 0x2d || b[len - 1] == 0x2d) revert InvalidLabel("leading/trailing hyphen");

        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool ok  = (c >= 0x61 && c <= 0x7a)   // a-z
                    || (c >= 0x30 && c <= 0x39)    // 0-9
                    || (c == 0x2d);                 // hyphen
            if (!ok) revert InvalidLabel("invalid character");
        }
    }
}
