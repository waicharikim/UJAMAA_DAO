// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovernanceVoting.sol";

/// Minimal PR token stub — only `balanceOf` is read by GovernanceVoting.
contract MockPrToken {
    mapping(address => uint256) public balanceOf;

    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }
}

contract GovernanceVotingTest is Test {
    GovernanceVoting voting;
    MockPrToken pr;

    address admin    = address(1);
    address recorder = address(2);
    address voter1   = address(3);
    address voter2   = address(4);

    bytes32 constant PROPOSAL_A = keccak256("proposal-uuid-aaa");
    bytes32 constant PROPOSAL_B = keccak256("proposal-uuid-bbb");

    function setUp() public {
        pr = new MockPrToken();
        pr.setBalance(voter1, 100);
        pr.setBalance(voter2, 75);

        vm.startPrank(admin);
        voting = new GovernanceVoting(admin, address(pr));
        voting.grantRole(voting.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    bytes32 internal constant CONTENT_HASH = keccak256("canonical-proposal-content");

    function _open(bytes32 proposalId) internal {
        vm.prank(recorder);
        voting.openProposal(proposalId, CONTENT_HASH);
    }

    // ── Voting window ─────────────────────────────────────────────────────────

    function test_OpenProposal() public {
        vm.prank(recorder);
        vm.expectEmit(true, false, false, true);
        emit GovernanceVoting.ProposalOpened(PROPOSAL_A, CONTENT_HASH, block.timestamp);
        voting.openProposal(PROPOSAL_A, CONTENT_HASH);
        assertEq(voting.proposalStatus(PROPOSAL_A), 1);
        // The canonical content hash is anchored so the off-chain text is tamper-evident.
        assertEq(voting.proposalContentHash(PROPOSAL_A), CONTENT_HASH);
    }

    function test_RevertOpenTwice() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        vm.expectRevert("Already initialised");
        voting.openProposal(PROPOSAL_A, CONTENT_HASH);
    }

    function test_RevertOpenUnauthorized() public {
        vm.prank(voter1);
        vm.expectRevert();
        voting.openProposal(PROPOSAL_A, CONTENT_HASH);
    }

    function test_CloseProposal() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        voting.closeProposal(PROPOSAL_A);
        assertEq(voting.proposalStatus(PROPOSAL_A), 2);
    }

    // ── User-signed voting ────────────────────────────────────────────────────

    function test_CastYesVote() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_A, 0);

        GovernanceVoting.VoteRecord memory r = voting.getVote(PROPOSAL_A, voter1);
        assertEq(r.voter, voter1);
        assertEq(r.option, 0);
        assertEq(r.weight, 100); // weight = caller's PR balance
        assertGt(r.timestamp, 0);
    }

    function test_CastNoVote() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_A, 1);
        assertEq(voting.getVote(PROPOSAL_A, voter1).option, 1);
    }

    function test_CastAbstainVote() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_A, 2);
        assertEq(voting.getVote(PROPOSAL_A, voter1).option, 2);
    }

    function test_VoteCountAndVoters() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_A, 0);
        vm.prank(voter2);
        voting.castVote(PROPOSAL_A, 1);

        assertEq(voting.voteCount(PROPOSAL_A), 2);
        address[] memory v = voting.getVoters(PROPOSAL_A);
        assertEq(v[0], voter1);
        assertEq(v[1], voter2);
    }

    function test_VotesIsolatedByProposal() public {
        _open(PROPOSAL_A);
        _open(PROPOSAL_B);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_A, 0);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_B, 1);

        assertEq(voting.getVote(PROPOSAL_A, voter1).option, 0);
        assertEq(voting.getVote(PROPOSAL_B, voter1).option, 1);
    }

    function test_RevertDuplicateVote() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        voting.castVote(PROPOSAL_A, 0);
        vm.prank(voter1);
        vm.expectRevert("Already voted");
        voting.castVote(PROPOSAL_A, 1);
    }

    function test_RevertInvalidOption() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        vm.expectRevert("Invalid vote option");
        voting.castVote(PROPOSAL_A, 3);
    }

    function test_RevertVotingNotOpen() public {
        // never opened
        vm.prank(voter1);
        vm.expectRevert("Voting not open");
        voting.castVote(PROPOSAL_A, 0);
    }

    function test_RevertAfterClose() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        voting.closeProposal(PROPOSAL_A);
        vm.prank(voter1);
        vm.expectRevert("Voting not open");
        voting.castVote(PROPOSAL_A, 0);
    }

    function test_RevertNoParticipationRights() public {
        _open(PROPOSAL_A);
        // voter with zero PR cannot vote
        address poor = address(99);
        vm.prank(poor);
        vm.expectRevert("No participation rights");
        voting.castVote(PROPOSAL_A, 0);
    }

    /// @dev THE trustless property: nobody can vote on another account's behalf.
    ///      castVote has no `voter` param — the platform (recorder/admin) calling
    ///      it can only ever record a vote for ITSELF (and needs its own PR).
    function test_PlatformCannotForgeAnothersVote() public {
        _open(PROPOSAL_A);

        // Recorder tries to vote — it has no PR, so it cannot even vote for itself.
        vm.prank(recorder);
        vm.expectRevert("No participation rights");
        voting.castVote(PROPOSAL_A, 0);

        // And voter1's slot remains empty: the platform never touched it.
        assertEq(voting.getVote(PROPOSAL_A, voter1).timestamp, 0);
        assertEq(voting.voteCount(PROPOSAL_A), 0);
    }

    function test_EmitsVoteCastEvent() public {
        _open(PROPOSAL_A);
        vm.prank(voter1);
        vm.expectEmit(true, true, false, true);
        emit GovernanceVoting.VoteCast(PROPOSAL_A, voter1, 0, 100, block.timestamp);
        voting.castVote(PROPOSAL_A, 0);
    }

    // ── Tally attestation ──────────────────────────────────────────────────────

    function test_RecordResultAfterClose() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        voting.closeProposal(PROPOSAL_A);

        vm.prank(recorder);
        voting.recordResult(PROPOSAL_A, 1);
        assertEq(voting.getResult(PROPOSAL_A).outcome, 1);
    }

    function test_RevertResultWhenNotClosed() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        vm.expectRevert("Voting not closed");
        voting.recordResult(PROPOSAL_A, 1);
    }

    function test_RevertDuplicateResult() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        voting.closeProposal(PROPOSAL_A);
        vm.prank(recorder);
        voting.recordResult(PROPOSAL_A, 1);
        vm.prank(recorder);
        vm.expectRevert("Result already recorded");
        voting.recordResult(PROPOSAL_A, 2);
    }

    function test_RevertInvalidOutcome() public {
        _open(PROPOSAL_A);
        vm.prank(recorder);
        voting.closeProposal(PROPOSAL_A);
        vm.prank(recorder);
        vm.expectRevert("Invalid outcome");
        voting.recordResult(PROPOSAL_A, 0);
    }

    function test_ResultUnauthorized() public {
        vm.prank(voter1);
        vm.expectRevert();
        voting.recordResult(PROPOSAL_A, 1);
    }

    // ── Opinions (user-authored) ───────────────────────────────────────────────

    function test_RecordOpinionByAuthor() public {
        bytes32 h = keccak256("annotation-1");
        vm.prank(voter1);
        vm.expectEmit(true, true, true, true);
        emit GovernanceVoting.OpinionAnchored(PROPOSAL_A, h, voter1, block.timestamp);
        voting.recordOpinion(PROPOSAL_A, h);
        assertEq(voting.opinions(h), PROPOSAL_A);
    }

    function test_RevertDuplicateOpinion() public {
        bytes32 h = keccak256("annotation-1");
        vm.prank(voter1);
        voting.recordOpinion(PROPOSAL_A, h);
        vm.prank(voter2);
        vm.expectRevert("Opinion already anchored");
        voting.recordOpinion(PROPOSAL_A, h);
    }

    // ── Ward-memory (platform-recorded) ────────────────────────────────────────

    function test_RecordMemory() public {
        bytes32 memoryHash = keccak256("ward-memory-record-1");
        vm.prank(recorder);
        vm.expectEmit(true, true, true, true);
        emit GovernanceVoting.MemoryAnchored(PROPOSAL_A, memoryHash, recorder, block.timestamp);
        voting.recordMemory(PROPOSAL_A, memoryHash);
        assertEq(voting.memories(PROPOSAL_A), memoryHash);
    }

    function test_RecordMemoryOverwrites() public {
        bytes32 firstHash  = keccak256("ward-memory-record-1");
        bytes32 secondHash = keccak256("ward-memory-record-corrected");
        vm.prank(recorder);
        voting.recordMemory(PROPOSAL_A, firstHash);
        vm.prank(recorder);
        voting.recordMemory(PROPOSAL_A, secondHash);
        assertEq(voting.memories(PROPOSAL_A), secondHash);
    }

    function test_RecordMemoryUnauthorized() public {
        vm.prank(voter1);
        vm.expectRevert();
        voting.recordMemory(PROPOSAL_A, keccak256("nope"));
    }
}
