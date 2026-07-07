// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GroupTreasury — UjamaaDAO On-Chain Treasury Anchor
 * @notice A tamper-evident MIRROR of the off-chain treasury ledger. It records a
 *         keccak256 hash of every treasury movement (a dues credit, a project
 *         contribution, an approved-proposal disbursement) so anyone can verify
 *         that a transaction shown in-app was recorded and never altered.
 *
 *         This contract does NOT custody funds. Real money moves via M-Pesa to
 *         platform-controlled accounts (UjamaaDAO Rule 2) — never on-chain,
 *         never P2P. The chain holds only attestations: (txId => dataHash) and an
 *         immutable `TreasuryTxAnchored` event log.
 *
 *         The platform RECORDER_ROLE (the worker's minter wallet) signs anchors,
 *         exactly as GovernanceVoting anchors votes/results/ward-memory. Until a
 *         RECORDER is funded and the address is wired, the off-chain ledger is the
 *         source of truth and anchoring is simply dormant — flipping it on is an
 *         env change, no contract or backend rewrite.
 *
 * Movement kind (mirrors backend transactionType):
 *   0 = CREDIT, 1 = DEBIT
 */
contract GroupTreasury is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // walletTransactionId (packed as bytes32) => latest anchored data hash
    mapping(bytes32 => bytes32) public anchors;

    event TreasuryTxAnchored(
        bytes32 indexed txId,
        bytes32 indexed groupId,
        bytes32 dataHash,
        uint8 kind,
        address indexed recorder,
        uint256 timestamp
    );

    /**
     * @param admin Address granted DEFAULT_ADMIN_ROLE + RECORDER_ROLE.
     */
    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RECORDER_ROLE, admin);
    }

    /**
     * @notice Anchor a treasury movement's record hash on-chain.
     * @dev No dedup guard: a record may legitimately be re-anchored (e.g. a
     *      correction). The mapping holds the latest hash; the event log is the
     *      immutable history. Reverts on a zero txId so an empty key can never be
     *      anchored by accident.
     * @param txId     UUID of the WalletTransaction (packed as bytes32).
     * @param groupId  UUID of the owning group's treasury (packed as bytes32) — indexed for filtering.
     * @param dataHash keccak256 of (txId + treasuryId + amount + currency + transactionType + referenceType + createdAt + initiatedById).
     * @param kind     0 = CREDIT, 1 = DEBIT.
     */
    function recordTransaction(
        bytes32 txId,
        bytes32 groupId,
        bytes32 dataHash,
        uint8 kind
    ) external onlyRole(RECORDER_ROLE) {
        require(txId != bytes32(0), "txId=0");
        require(kind <= 1, "bad kind");
        anchors[txId] = dataHash;
        emit TreasuryTxAnchored(txId, groupId, dataHash, kind, msg.sender, block.timestamp);
    }

    // ── Views ───────────────────────────────────────────────────────────────────

    function getAnchor(bytes32 txId) external view returns (bytes32) {
        return anchors[txId];
    }

    function isAnchored(bytes32 txId) external view returns (bool) {
        return anchors[txId] != bytes32(0);
    }
}
