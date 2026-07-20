// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IPrToken {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GovernanceVoting — UjamaaDAO On-Chain Governance
 * @notice Votes are cast DIRECTLY by the voter's own (smart) account — the
 *         platform cannot forge or alter a vote. The platform retains only the
 *         legitimate process role of opening/closing a proposal's voting window
 *         and attesting the final tally; because every vote is an immutable
 *         on-chain `VoteCast` event, anyone can independently re-tally and check
 *         the attested result. This is the trust-minimised core of UjamaaDAO
 *         governance: "don't trust the admin — verify on-chain."
 *
 * Vote options (mirrors backend VoteOption enum):
 *   0 = YES, 1 = NO, 2 = ABSTAIN
 *
 * Voting weight is the caller's Participation Rights (PR) balance. PR is
 * soulbound and earned through participation.
 *
 * NOTE (weight hardening, tracked for the pre-mainnet security pass):
 *   weight is read at cast time via prToken.balanceOf(msg.sender). A fully
 *   trustless weight requires a balance SNAPSHOT taken at proposal-open
 *   (so PR minted mid-vote cannot influence an open ballot). That needs PrToken
 *   to expose checkpointed balances (ERC20Votes). Deferred to the hardening
 *   pass; cast-time weight is sufficient for the user-signed-vote property here.
 */
contract GovernanceVoting is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    /// @notice PR token read for voting weight.
    IPrToken public immutable prToken;

    enum VoteOption { YES, NO, ABSTAIN }

    // Voting window: 0 = uninitialised, 1 = OPEN, 2 = CLOSED
    uint8 internal constant STATUS_NONE = 0;
    uint8 internal constant STATUS_OPEN = 1;
    uint8 internal constant STATUS_CLOSED = 2;

    struct VoteRecord {
        address voter;
        uint8   option;    // 0=YES 1=NO 2=ABSTAIN
        uint256 weight;    // PR balance at time of vote
        uint256 timestamp;
    }

    // 0 = pending, 1 = APPROVED, 2 = REJECTED
    struct ProposalResult {
        uint8   outcome;
        uint256 timestamp;
    }

    // proposalId (bytes32 of UUID) => voting-window status
    mapping(bytes32 => uint8) public proposalStatus;

    // proposalId => voter => VoteRecord
    mapping(bytes32 => mapping(address => VoteRecord)) public votes;

    // proposalId => list of voters (for enumeration / independent re-tally)
    mapping(bytes32 => address[]) public voters;

    // proposalId => attested tally result
    mapping(bytes32 => ProposalResult) public results;

    // proposalId => keccak256 of the canonical proposal content, captured when the
    // voting window opens. Makes the off-chain proposal text tamper-evident: anyone
    // can re-hash the canonical fields (title/description/rationale/budget/scope/
    // target) and compare — so "what was voted on, and why" is verifiable, not just
    // the vote itself.
    mapping(bytes32 => bytes32) public proposalContentHash;

    event ProposalOpened(
        bytes32 indexed proposalId,
        bytes32         contentHash,
        uint256         timestamp
    );
    event ProposalClosed(bytes32 indexed proposalId, uint256 timestamp);

    event VoteCast(
        bytes32 indexed proposalId,
        address indexed voter,
        uint8           option,
        uint256         weight,
        uint256         timestamp
    );

    event ProposalResultRecorded(
        bytes32 indexed proposalId,
        uint8           outcome,
        uint256         timestamp
    );

    /**
     * @param admin          Address granted DEFAULT_ADMIN_ROLE + RECORDER_ROLE.
     * @param prTokenAddress PR token contract used to read voting weight.
     */
    constructor(address admin, address prTokenAddress) {
        require(prTokenAddress != address(0), "PR token required");
        prToken = IPrToken(prTokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RECORDER_ROLE, admin);
    }

    // ── Voting window (process administration — cannot forge votes) ───────────

    /**
     * @notice Open a proposal's voting window. Process role only — the platform
     *         decides WHEN voting is open, never WHO voted or HOW.
     */
    function openProposal(bytes32 proposalId, bytes32 contentHash)
        external
        onlyRole(RECORDER_ROLE)
    {
        require(proposalStatus[proposalId] == STATUS_NONE, "Already initialised");
        proposalStatus[proposalId] = STATUS_OPEN;
        proposalContentHash[proposalId] = contentHash;
        emit ProposalOpened(proposalId, contentHash, block.timestamp);
    }

    /**
     * @notice Close a proposal's voting window. No further votes accepted.
     */
    function closeProposal(bytes32 proposalId) external onlyRole(RECORDER_ROLE) {
        require(proposalStatus[proposalId] == STATUS_OPEN, "Not open");
        proposalStatus[proposalId] = STATUS_CLOSED;
        emit ProposalClosed(proposalId, block.timestamp);
    }

    // ── User-signed voting ────────────────────────────────────────────────────

    /**
     * @notice Cast YOUR vote. `msg.sender` is the voter — the platform cannot
     *         call this on anyone's behalf. Weight = caller's PR balance.
     * @param proposalId  UUID of the proposal (packed as bytes32).
     * @param option      0=YES, 1=NO, 2=ABSTAIN.
     */
    function castVote(bytes32 proposalId, uint8 option) external {
        require(proposalStatus[proposalId] == STATUS_OPEN, "Voting not open");
        require(option <= 2, "Invalid vote option");
        require(votes[proposalId][msg.sender].timestamp == 0, "Already voted");

        uint256 weight = prToken.balanceOf(msg.sender);
        require(weight > 0, "No participation rights");

        votes[proposalId][msg.sender] = VoteRecord({
            voter:     msg.sender,
            option:    option,
            weight:    weight,
            timestamp: block.timestamp
        });
        voters[proposalId].push(msg.sender);

        emit VoteCast(proposalId, msg.sender, option, weight, block.timestamp);
    }

    // ── Tally attestation (independently verifiable from VoteCast events) ──────

    /**
     * @notice Record the final tally outcome. Platform attestation only — anyone
     *         can re-derive the tally from the on-chain VoteCast events and check
     *         it against this value. Requires the window to be closed first.
     * @param proposalId  UUID packed as bytes32.
     * @param outcome     1=APPROVED, 2=REJECTED.
     */
    function recordResult(
        bytes32 proposalId,
        uint8   outcome
    ) external onlyRole(RECORDER_ROLE) {
        require(outcome == 1 || outcome == 2, "Invalid outcome");
        require(proposalStatus[proposalId] == STATUS_CLOSED, "Voting not closed");
        require(results[proposalId].timestamp == 0, "Result already recorded");

        results[proposalId] = ProposalResult({
            outcome:   outcome,
            timestamp: block.timestamp
        });

        emit ProposalResultRecorded(proposalId, outcome, block.timestamp);
    }

    // ── Community opinions (annotations) — authored by the user ───────────────

    // annotationHash => proposalId (non-zero means anchored)
    mapping(bytes32 => bytes32) public opinions;

    event OpinionAnchored(
        bytes32 indexed proposalId,
        bytes32 indexed annotationHash,
        address indexed author,
        uint256 timestamp
    );

    /**
     * @notice Anchor YOUR community opinion hash on-chain. `msg.sender` is the
     *         author — the recorded author is the real signer, not the platform.
     * @param proposalId     UUID of the proposal (packed as bytes32).
     * @param annotationHash keccak256 of (annotationId + proposalId + authorAddress + quotedText).
     */
    function recordOpinion(
        bytes32 proposalId,
        bytes32 annotationHash
    ) external {
        require(opinions[annotationHash] == bytes32(0), "Opinion already anchored");
        opinions[annotationHash] = proposalId;
        emit OpinionAnchored(proposalId, annotationHash, msg.sender, block.timestamp);
    }

    // ── Ward-memory anchor (platform-recorded outcome record) ─────────────────

    // proposalId => latest ward-memory record hash
    mapping(bytes32 => bytes32) public memories;

    event MemoryAnchored(
        bytes32 indexed proposalId,
        bytes32 indexed memoryHash,
        address indexed recorder,
        uint256 timestamp
    );

    /**
     * @notice Anchor a proposal's ward-memory record hash on-chain.
     * @dev No dedup guard: an outcome may legitimately be corrected/re-recorded.
     *      The mapping holds the latest hash; the event log is the immutable history.
     * @param proposalId UUID of the proposal (packed as bytes32).
     * @param memoryHash keccak256 of (proposalId + rationale + alternatives + outcome + outcomeRecordedAt + recorder).
     */
    function recordMemory(
        bytes32 proposalId,
        bytes32 memoryHash
    ) external onlyRole(RECORDER_ROLE) {
        memories[proposalId] = memoryHash;
        emit MemoryAnchored(proposalId, memoryHash, msg.sender, block.timestamp);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getResult(bytes32 proposalId) external view returns (ProposalResult memory) {
        return results[proposalId];
    }

    function getVoters(bytes32 proposalId) external view returns (address[] memory) {
        return voters[proposalId];
    }

    function getVote(
        bytes32 proposalId,
        address voter
    ) external view returns (VoteRecord memory) {
        return votes[proposalId][voter];
    }

    function voteCount(bytes32 proposalId) external view returns (uint256) {
        return voters[proposalId].length;
    }
}
