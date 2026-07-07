// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ProjectRegistry — UjamaaDAO On-Chain Project Anchor
 * @notice A tamper-evident MIRROR of the project lifecycle — the thesis of
 *         UjamaaDAO is "money + labor → outcomes, traceable," and projects are
 *         where labor and outcomes live. This contract anchors a keccak256 hash
 *         of each milestone-of-trust event so anyone can verify that a project's
 *         record (its creation, a verified milestone, verified labor, completion)
 *         was recorded and never altered.
 *
 *         It does NOT custody funds (that's M-Pesa off-chain, Rule 2) and it does
 *         NOT gate execution — it records. The platform RECORDER_ROLE (the
 *         worker's minter wallet) signs anchors, exactly as GovernanceVoting and
 *         GroupTreasury do. Dormant until PROJECT_REGISTRY_ADDRESS is wired —
 *         flipping it on is an env change, no contract or backend rewrite.
 *
 * Event kind:
 *   0 = PROJECT_CREATED, 1 = MILESTONE_VERIFIED, 2 = WORK_APPROVED, 3 = PROJECT_COMPLETED
 *
 * WORK_APPROVED is the thesis-critical one: a work session that passed the QR
 * witness-chain (≥1 independent, depth-0 witness) — i.e. labor verified by the
 * community, anchored beyond dispute.
 */
contract ProjectRegistry is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // eventId (keccak of "<kind>:<entityId>") => latest anchored data hash
    mapping(bytes32 => bytes32) public anchors;

    event ProjectEventAnchored(
        bytes32 indexed projectId,
        bytes32 indexed eventId,
        uint8 kind,
        bytes32 dataHash,
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
     * @notice Anchor a project lifecycle event's record hash on-chain.
     * @dev No dedup guard: an event may legitimately be re-anchored (e.g. a
     *      milestone re-verified after a correction). The mapping holds the
     *      latest hash; the event log is the immutable history.
     * @param projectId UUID of the project (packed as bytes32) — indexed for filtering.
     * @param eventId   keccak256("<kind>:<entityId>") — unique per lifecycle event.
     * @param kind      0=PROJECT_CREATED, 1=MILESTONE_VERIFIED, 2=WORK_APPROVED, 3=PROJECT_COMPLETED.
     * @param dataHash  keccak256 of the canonical event payload.
     */
    function recordEvent(
        bytes32 projectId,
        bytes32 eventId,
        uint8 kind,
        bytes32 dataHash
    ) external onlyRole(RECORDER_ROLE) {
        require(eventId != bytes32(0), "eventId=0");
        require(kind <= 3, "bad kind");
        anchors[eventId] = dataHash;
        emit ProjectEventAnchored(projectId, eventId, kind, dataHash, msg.sender, block.timestamp);
    }

    // ── Views ───────────────────────────────────────────────────────────────────

    function getAnchor(bytes32 eventId) external view returns (bytes32) {
        return anchors[eventId];
    }

    function isAnchored(bytes32 eventId) external view returns (bool) {
        return anchors[eventId] != bytes32(0);
    }
}
