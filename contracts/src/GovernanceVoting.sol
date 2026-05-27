// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GovernanceVoting — UjamaaDAO On-Chain Vote Anchor
 * @notice Records proposal votes immutably on-chain for auditability.
 *         The backend DB remains the source of truth for tallying/quorum;
 *         this contract is the tamper-proof audit trail.
 *
 * Vote options (mirrors backend VoteOption enum):
 *   0 = YES, 1 = NO, 2 = ABSTAIN
 */
contract GovernanceVoting is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    enum VoteOption { YES, NO, ABSTAIN }

    struct VoteRecord {
        address voter;
        uint8   option;    // 0=YES 1=NO 2=ABSTAIN
        uint256 weight;    // impact-point weight at time of vote
        uint256 timestamp;
    }

    // 0 = pending, 1 = APPROVED, 2 = REJECTED
    struct ProposalResult {
        uint8   outcome;   // 1=APPROVED 2=REJECTED (0 = not yet tallied)
        uint256 timestamp;
    }

    // proposalId (bytes32 of UUID) => voter => VoteRecord
    mapping(bytes32 => mapping(address => VoteRecord)) public votes;

    // proposalId => list of voters (for enumeration)
    mapping(bytes32 => address[]) public voters;

    // proposalId => tally result
    mapping(bytes32 => ProposalResult) public results;

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

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RECORDER_ROLE, admin);
    }

    /**
     * @notice Record a vote on-chain. Called by the backend minter wallet
     *         after the off-chain DB write succeeds.
     * @param proposalId  UUID of the proposal (packed as bytes32).
     * @param voter       Wallet address of the voter.
     * @param option      0=YES, 1=NO, 2=ABSTAIN.
     * @param weight      IP weight at time of vote (no decimals).
     */
    function recordVote(
        bytes32 proposalId,
        address voter,
        uint8   option,
        uint256 weight
    ) external onlyRole(RECORDER_ROLE) {
        require(option <= 2, "Invalid vote option");
        require(
            votes[proposalId][voter].timestamp == 0,
            "Already voted"
        );

        votes[proposalId][voter] = VoteRecord({
            voter:     voter,
            option:    option,
            weight:    weight,
            timestamp: block.timestamp
        });
        voters[proposalId].push(voter);

        emit VoteCast(proposalId, voter, option, weight, block.timestamp);
    }

    /**
     * @notice Record the final tally result for a proposal.
     * @param proposalId  UUID packed as bytes32.
     * @param outcome     1=APPROVED, 2=REJECTED.
     */
    function recordResult(
        bytes32 proposalId,
        uint8   outcome
    ) external onlyRole(RECORDER_ROLE) {
        require(outcome == 1 || outcome == 2, "Invalid outcome");
        require(results[proposalId].timestamp == 0, "Result already recorded");

        results[proposalId] = ProposalResult({
            outcome:   outcome,
            timestamp: block.timestamp
        });

        emit ProposalResultRecorded(proposalId, outcome, block.timestamp);
    }

    // annotationHash => proposalId (non-zero means anchored)
    mapping(bytes32 => bytes32) public opinions;

    event OpinionAnchored(
        bytes32 indexed proposalId,
        bytes32 indexed annotationHash,
        address indexed author,
        uint256 timestamp
    );

    /**
     * @notice Anchor a community opinion hash on-chain.
     * @param proposalId     UUID of the proposal (packed as bytes32).
     * @param annotationHash keccak256 of (annotationId + proposalId + authorAddress + quotedText).
     */
    function recordOpinion(
        bytes32 proposalId,
        bytes32 annotationHash
    ) external onlyRole(RECORDER_ROLE) {
        require(opinions[annotationHash] == bytes32(0), "Opinion already anchored");
        opinions[annotationHash] = proposalId;
        emit OpinionAnchored(proposalId, annotationHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Get the tally result for a proposal.
     */
    function getResult(bytes32 proposalId) external view returns (ProposalResult memory) {
        return results[proposalId];
    }

    /**
     * @notice Get all voter addresses for a proposal.
     */
    function getVoters(bytes32 proposalId) external view returns (address[] memory) {
        return voters[proposalId];
    }

    /**
     * @notice Get a specific voter's record.
     */
    function getVote(
        bytes32 proposalId,
        address voter
    ) external view returns (VoteRecord memory) {
        return votes[proposalId][voter];
    }

    /**
     * @notice Total number of votes cast on a proposal.
     */
    function voteCount(bytes32 proposalId) external view returns (uint256) {
        return voters[proposalId].length;
    }
}
