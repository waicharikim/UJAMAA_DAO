// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GroupTreasury.sol";

contract GroupTreasuryTest is Test {
    GroupTreasury treasury;

    address admin    = address(1);
    address recorder = address(2);
    address stranger = address(3);

    bytes32 constant TX_A    = keccak256("wallet-tx-uuid-aaa");
    bytes32 constant TX_B    = keccak256("wallet-tx-uuid-bbb");
    bytes32 constant GROUP_A = keccak256("group-uuid-aaa");
    bytes32 constant HASH_1  = keccak256("ledger-row-canonical-1");
    bytes32 constant HASH_2  = keccak256("ledger-row-canonical-2");

    event TreasuryTxAnchored(
        bytes32 indexed txId,
        bytes32 indexed groupId,
        bytes32 dataHash,
        uint8 kind,
        address indexed recorder,
        uint256 timestamp
    );

    function setUp() public {
        vm.startPrank(admin);
        treasury = new GroupTreasury(admin);
        treasury.grantRole(treasury.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    function test_constructor_grantsAdminBothRoles() public view {
        assertTrue(treasury.hasRole(treasury.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(treasury.hasRole(treasury.RECORDER_ROLE(), admin));
    }

    function test_recordTransaction_storesHashAndEmits() public {
        vm.expectEmit(true, true, true, false);
        emit TreasuryTxAnchored(TX_A, GROUP_A, HASH_1, 0, recorder, block.timestamp);

        vm.prank(recorder);
        treasury.recordTransaction(TX_A, GROUP_A, HASH_1, 0);

        assertEq(treasury.getAnchor(TX_A), HASH_1);
        assertTrue(treasury.isAnchored(TX_A));
        assertFalse(treasury.isAnchored(TX_B));
    }

    function test_recordTransaction_debitKind() public {
        vm.prank(recorder);
        treasury.recordTransaction(TX_B, GROUP_A, HASH_2, 1);
        assertEq(treasury.getAnchor(TX_B), HASH_2);
    }

    function test_reanchor_overwritesLatestHash() public {
        vm.startPrank(recorder);
        treasury.recordTransaction(TX_A, GROUP_A, HASH_1, 0);
        treasury.recordTransaction(TX_A, GROUP_A, HASH_2, 0); // correction
        vm.stopPrank();
        assertEq(treasury.getAnchor(TX_A), HASH_2);
    }

    function test_recordTransaction_revertsForNonRecorder() public {
        vm.prank(stranger);
        vm.expectRevert();
        treasury.recordTransaction(TX_A, GROUP_A, HASH_1, 0);
    }

    function test_recordTransaction_revertsOnZeroTxId() public {
        vm.prank(recorder);
        vm.expectRevert(bytes("txId=0"));
        treasury.recordTransaction(bytes32(0), GROUP_A, HASH_1, 0);
    }

    function test_recordTransaction_revertsOnBadKind() public {
        vm.prank(recorder);
        vm.expectRevert(bytes("bad kind"));
        treasury.recordTransaction(TX_A, GROUP_A, HASH_1, 2);
    }

    function test_constructor_revertsOnZeroAdmin() public {
        vm.expectRevert(bytes("admin=0"));
        new GroupTreasury(address(0));
    }
}
