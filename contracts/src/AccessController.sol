// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title AccessController
 * @notice Enforces on-chain access policies for EverDeploy sites.
 *
 *  Policies (mirrors `access.policy` ENS text record values):
 *   - PUBLIC      — anyone passes
 *   - TOKEN_GATED — holder of ≥ minBalance of an ERC-20/721/1155 token
 *   - ALLOWLIST   — explicitly whitelisted addresses
 *   - DAO         — holder of a DAO membership NFT (ERC-721)
 *   - PAUSED      — nobody passes (emergency kill-switch)
 *
 * @dev Each ENS domain has its own independent policy configuration.
 *      The frontend reads ENS text records to discover the policy, then calls
 *      `checkAccess()` off-chain (eth_call) to gate the UI.  For on-chain
 *      gating (e.g. a smart contract that wants to verify a caller has access),
 *      use the same `checkAccess()` function in a require statement.
 */
contract AccessController is Ownable {
    // ────────────────────────────────── enums ──────────────────

    enum PolicyType {
        PUBLIC,       // 0 — open to all
        TOKEN_GATED,  // 1 — requires token balance
        ALLOWLIST,    // 2 — explicit whitelist
        DAO,          // 3 — requires DAO NFT
        PAUSED        // 4 — all access denied
    }

    enum TokenStandard {
        ERC20,   // 0
        ERC721,  // 1
        ERC1155  // 2
    }

    // ────────────────────────────────── structs ──────────────────

    struct TokenPolicy {
        address       tokenContract;
        TokenStandard standard;
        uint256       minBalance;
        uint256       tokenId;       // only relevant for ERC-1155
    }

    struct DomainPolicy {
        PolicyType    policyType;
        TokenPolicy   tokenPolicy;   // used when policyType is TOKEN_GATED or DAO
        bool          initialised;
    }

    // ──────────────────────────────────── storage ──

    /// @notice domain string → policy configuration
    mapping(string => DomainPolicy) private _policies;

    /// @notice domain string → allowlist member → bool
    mapping(string => mapping(address => bool)) private _allowlist;

    // ──────────────────────────────────── events ──

    event PolicySet(string indexed domain, PolicyType policyType);
    event AllowlistUpdated(string indexed domain, address indexed account, bool allowed);
    event PolicyPaused(string indexed domain);
    event PolicyUnpaused(string indexed domain, PolicyType resumedType);

    // ──────────────────────────────────── errors ──

    error PolicyNotInitialised(string domain);
    error AccessDenied(string domain, address account);
    error InvalidTokenContract();

    // ─────────────────────────────────── constructor ──

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─────────────────────────── public / external ──────────────

    /**
     * @notice Set a domain to PUBLIC access.
     */
    function setPolicyPublic(string calldata domain) external onlyOwner {
        _policies[domain] = DomainPolicy({
            policyType:  PolicyType.PUBLIC,
            tokenPolicy: TokenPolicy(address(0), TokenStandard.ERC20, 0, 0),
            initialised: true
        });
        emit PolicySet(domain, PolicyType.PUBLIC);
    }

    /**
     * @notice Set a token-gating policy (ERC-20, ERC-721, or ERC-1155).
     * @param domain          ENS domain (e.g. "myapp.eth")
     * @param tokenContract   Address of the token contract
     * @param standard        0 = ERC20, 1 = ERC721, 2 = ERC1155
     * @param minBalance      Minimum balance required (for ERC-721, usually 1)
     * @param tokenId         ERC-1155 token ID (ignored for ERC-20 / ERC-721)
     */
    function setPolicyTokenGated(
        string    calldata domain,
        address            tokenContract,
        TokenStandard      standard,
        uint256            minBalance,
        uint256            tokenId
    ) external onlyOwner {
        if (tokenContract == address(0)) revert InvalidTokenContract();

        _policies[domain] = DomainPolicy({
            policyType: PolicyType.TOKEN_GATED,
            tokenPolicy: TokenPolicy({
                tokenContract: tokenContract,
                standard:      standard,
                minBalance:    minBalance,
                tokenId:       tokenId
            }),
            initialised: true
        });
        emit PolicySet(domain, PolicyType.TOKEN_GATED);
    }

    /**
     * @notice Set a DAO-gated policy (requires holding a specific NFT).
     * @param domain          ENS domain
     * @param nftContract     ERC-721 contract address of the DAO membership NFT
     */
    function setPolicyDAO(string calldata domain, address nftContract)
        external onlyOwner
    {
        if (nftContract == address(0)) revert InvalidTokenContract();

        _policies[domain] = DomainPolicy({
            policyType: PolicyType.DAO,
            tokenPolicy: TokenPolicy({
                tokenContract: nftContract,
                standard:      TokenStandard.ERC721,
                minBalance:    1,
                tokenId:       0
            }),
            initialised: true
        });
        emit PolicySet(domain, PolicyType.DAO);
    }

    /**
     * @notice Set an allowlist policy and optionally pre-populate it.
     */
    function setPolicyAllowlist(string calldata domain, address[] calldata initial)
        external onlyOwner
    {
        _policies[domain] = DomainPolicy({
            policyType:  PolicyType.ALLOWLIST,
            tokenPolicy: TokenPolicy(address(0), TokenStandard.ERC20, 0, 0),
            initialised: true
        });
        for (uint256 i = 0; i < initial.length; i++) {
            _allowlist[domain][initial[i]] = true;
            emit AllowlistUpdated(domain, initial[i], true);
        }
        emit PolicySet(domain, PolicyType.ALLOWLIST);
    }

    /// @notice Add or remove an address from a domain's allowlist.
    function setAllowlisted(string calldata domain, address account, bool allowed)
        external onlyOwner
    {
        _allowlist[domain][account] = allowed;
        emit AllowlistUpdated(domain, account, allowed);
    }

    /// @notice Emergency pause — denies all access.
    function pause(string calldata domain) external onlyOwner {
        _policies[domain].policyType = PolicyType.PAUSED;
        _policies[domain].initialised = true;
        emit PolicyPaused(domain);
    }

    /// @notice Lift pause and restore a specific policy.
    function unpause(string calldata domain, PolicyType resumeTo) external onlyOwner {
        require(resumeTo != PolicyType.PAUSED, "Cannot unpause to PAUSED");
        _policies[domain].policyType = resumeTo;
        emit PolicyUnpaused(domain, resumeTo);
    }

    // ─────────────────────────── read / view ──────────────────

    /**
     * @notice Check whether `account` has access to `domain`.
     * @return true if access is granted, false otherwise.
     *
     * @dev Safe to call off-chain via eth_call (no state changes, gas free).
     *      Reverts only on missing policy; returns false for any denied case.
     */
    function checkAccess(string calldata domain, address account)
        external view returns (bool)
    {
        DomainPolicy storage p = _policies[domain];
        if (!p.initialised) revert PolicyNotInitialised(domain);

        PolicyType pt = p.policyType;

        if (pt == PolicyType.PAUSED)   return false;
        if (pt == PolicyType.PUBLIC)   return true;
        if (pt == PolicyType.ALLOWLIST) return _allowlist[domain][account];

        // TOKEN_GATED or DAO — check on-chain balance
        TokenPolicy storage tp = p.tokenPolicy;
        return _checkTokenBalance(tp, account);
    }

    /**
     * @notice Revert-style access check — useful in on-chain gating.
     */
    function requireAccess(string calldata domain, address account) external view {
        bool ok = this.checkAccess(domain, account);
        if (!ok) revert AccessDenied(domain, account);
    }

    /// @notice Returns the current policy type for a domain.
    function getPolicyType(string calldata domain) external view returns (PolicyType) {
        return _policies[domain].policyType;
    }

    /// @notice Returns the full policy struct.
    function getPolicy(string calldata domain) external view returns (DomainPolicy memory) {
        return _policies[domain];
    }

    /// @notice Check whether an address is allowlisted for a domain.
    function isAllowlisted(string calldata domain, address account) external view returns (bool) {
        return _allowlist[domain][account];
    }

    // ──────────────────────────────── internal ──────────────────

    function _checkTokenBalance(TokenPolicy storage tp, address account)
        internal view returns (bool)
    {
        TokenStandard std = tp.standard;

        if (std == TokenStandard.ERC20) {
            return IERC20(tp.tokenContract).balanceOf(account) >= tp.minBalance;
        }

        if (std == TokenStandard.ERC721) {
            return IERC721(tp.tokenContract).balanceOf(account) >= tp.minBalance;
        }

        // ERC1155
        return IERC1155(tp.tokenContract).balanceOf(account, tp.tokenId) >= tp.minBalance;
    }
}
