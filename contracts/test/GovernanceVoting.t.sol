// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovernanceVoting.sol";

contract GovernanceVotingTest is Test {
    GovernanceVoting voting;
    address admin   = address(1);
    address recorder = address(2);
    address voter1  = address(3);
    address voter2  = address(4);

    bytes32 constant PROPOSAL_A = keccak256("proposal-uuid-aaa");
    bytes32 constant PROPOSAL_B = keccak256("proposal-uuid-bbb");

    function setUp() public {
        vm.startPrank(admin);
        voting = new GovernanceVoting(admin);
        voting.grantRole(voting.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    function test_RecordYesVote() public {
        vm.prank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);

        GovernanceVoting.VoteRecord memory r = voting.getVote(PROPOSAL_A, voter1);
        assertEq(r.voter, voter1);
        assertEq(r.option, 0);
        assertEq(r.weight, 100);
        assertGt(r.timestamp, 0);
    }

    function test_RecordNoVote() public {
        vm.prank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 1, 50);

        GovernanceVoting.VoteRecord memory r = voting.getVote(PROPOSAL_A, voter1);
        assertEq(r.option, 1);
    }

    function test_RecordAbstainVote() public {
        vm.prank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 2, 0);

        GovernanceVoting.VoteRecord memory r = voting.getVote(PROPOSAL_A, voter1);
        assertEq(r.option, 2);
    }

    function test_VoteCountIncrements() public {
        vm.startPrank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);
        voting.recordVote(PROPOSAL_A, voter2, 1, 75);
        vm.stopPrank();

        assertEq(voting.voteCount(PROPOSAL_A), 2);
    }

    function test_GetVotersReturnsAll() public {
        vm.startPrank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);
        voting.recordVote(PROPOSAL_A, voter2, 1, 75);
        vm.stopPrank();

        address[] memory v = voting.getVoters(PROPOSAL_A);
        assertEq(v.length, 2);
        assertEq(v[0], voter1);
        assertEq(v[1], voter2);
    }

    function test_VotesAreIsolatedByProposal() public {
        vm.prank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);

        // voter1 can vote on a different proposal
        vm.prank(recorder);
        voting.recordVote(PROPOSAL_B, voter1, 1, 100);

        assertEq(voting.getVote(PROPOSAL_A, voter1).option, 0);
        assertEq(voting.getVote(PROPOSAL_B, voter1).option, 1);
        assertEq(voting.voteCount(PROPOSAL_A), 1);
        assertEq(voting.voteCount(PROPOSAL_B), 1);
    }

    function test_RevertOnDuplicateVote() public {
        vm.prank(recorder);
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);

        vm.prank(recorder);
        vm.expectRevert("Already voted");
        voting.recordVote(PROPOSAL_A, voter1, 1, 100);
    }

    function test_RevertOnInvalidOption() public {
        vm.prank(recorder);
        vm.expectRevert("Invalid vote option");
        voting.recordVote(PROPOSAL_A, voter1, 3, 100);
    }

    function test_RevertWhenNotRecorder() public {
        vm.prank(voter1);
        vm.expectRevert();
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);
    }

    function test_EmitsVoteCastEvent() public {
        vm.prank(recorder);
        vm.expectEmit(true, true, false, true);
        emit GovernanceVoting.VoteCast(PROPOSAL_A, voter1, 0, 100, block.timestamp);
        voting.recordVote(PROPOSAL_A, voter1, 0, 100);
    }

    // ── recordResult tests ───────────────────────────────────────────────────

    function test_RecordApprovedResult() public {
        vm.prank(recorder);
        voting.recordResult(PROPOSAL_A, 1);

        GovernanceVoting.ProposalResult memory r = voting.getResult(PROPOSAL_A);
        assertEq(r.outcome, 1);
        assertGt(r.timestamp, 0);
    }

    function test_RecordRejectedResult() public {
        vm.prank(recorder);
        voting.recordResult(PROPOSAL_A, 2);

        GovernanceVoting.ProposalResult memory r = voting.getResult(PROPOSAL_A);
        assertEq(r.outcome, 2);
    }

    function test_RevertOnDuplicateResult() public {
        vm.prank(recorder);
        voting.recordResult(PROPOSAL_A, 1);

        vm.prank(recorder);
        vm.expectRevert("Result already recorded");
        voting.recordResult(PROPOSAL_A, 2);
    }

    function test_RevertOnInvalidOutcome() public {
        vm.prank(recorder);
        vm.expectRevert("Invalid outcome");
        voting.recordResult(PROPOSAL_A, 0);

        vm.prank(recorder);
        vm.expectRevert("Invalid outcome");
        voting.recordResult(PROPOSAL_A, 3);
    }

    function test_ResultUnauthorized() public {
        vm.prank(voter1);
        vm.expectRevert();
        voting.recordResult(PROPOSAL_A, 1);
    }

    function test_EmitsProposalResultRecordedEvent() public {
        vm.prank(recorder);
        vm.expectEmit(true, false, false, true);
        emit GovernanceVoting.ProposalResultRecorded(PROPOSAL_A, 1, block.timestamp);
        voting.recordResult(PROPOSAL_A, 1);
    }
}
