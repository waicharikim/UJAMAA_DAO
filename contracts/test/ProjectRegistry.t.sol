// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ProjectRegistry.sol";

contract ProjectRegistryTest is Test {
    ProjectRegistry registry;

    address admin    = address(1);
    address recorder = address(2);
    address stranger = address(3);

    bytes32 constant PROJECT_A = keccak256("project-uuid-aaa");
    bytes32 constant EVT_CREATED = keccak256("0:project-uuid-aaa");
    bytes32 constant EVT_WORK    = keccak256("2:work-session-uuid");
    bytes32 constant HASH_1   = keccak256("event-canonical-1");
    bytes32 constant HASH_2   = keccak256("event-canonical-2");

    event ProjectEventAnchored(
        bytes32 indexed projectId,
        bytes32 indexed eventId,
        uint8 kind,
        bytes32 dataHash,
        address indexed recorder,
        uint256 timestamp
    );

    function setUp() public {
        vm.startPrank(admin);
        registry = new ProjectRegistry(admin);
        registry.grantRole(registry.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    function test_constructor_grantsAdminBothRoles() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.RECORDER_ROLE(), admin));
    }

    function test_recordEvent_storesHashAndEmits() public {
        vm.expectEmit(true, true, true, false);
        emit ProjectEventAnchored(PROJECT_A, EVT_CREATED, 0, HASH_1, recorder, block.timestamp);

        vm.prank(recorder);
        registry.recordEvent(PROJECT_A, EVT_CREATED, 0, HASH_1);

        assertEq(registry.getAnchor(EVT_CREATED), HASH_1);
        assertTrue(registry.isAnchored(EVT_CREATED));
        assertFalse(registry.isAnchored(EVT_WORK));
    }

    function test_recordEvent_workApprovedKind() public {
        vm.prank(recorder);
        registry.recordEvent(PROJECT_A, EVT_WORK, 2, HASH_2);
        assertEq(registry.getAnchor(EVT_WORK), HASH_2);
    }

    function test_recordEvent_allValidKinds() public {
        vm.startPrank(recorder);
        for (uint8 k = 0; k <= 3; k++) {
            bytes32 id = keccak256(abi.encodePacked(k, "entity"));
            registry.recordEvent(PROJECT_A, id, k, HASH_1);
            assertEq(registry.getAnchor(id), HASH_1);
        }
        vm.stopPrank();
    }

    function test_reanchor_overwritesLatestHash() public {
        vm.startPrank(recorder);
        registry.recordEvent(PROJECT_A, EVT_CREATED, 0, HASH_1);
        registry.recordEvent(PROJECT_A, EVT_CREATED, 0, HASH_2); // correction
        vm.stopPrank();
        assertEq(registry.getAnchor(EVT_CREATED), HASH_2);
    }

    function test_recordEvent_revertsForNonRecorder() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.recordEvent(PROJECT_A, EVT_CREATED, 0, HASH_1);
    }

    function test_recordEvent_revertsOnZeroEventId() public {
        vm.prank(recorder);
        vm.expectRevert(bytes("eventId=0"));
        registry.recordEvent(PROJECT_A, bytes32(0), 0, HASH_1);
    }

    function test_recordEvent_revertsOnBadKind() public {
        vm.prank(recorder);
        vm.expectRevert(bytes("bad kind"));
        registry.recordEvent(PROJECT_A, EVT_CREATED, 4, HASH_1);
    }

    function test_constructor_revertsOnZeroAdmin() public {
        vm.expectRevert(bytes("admin=0"));
        new ProjectRegistry(address(0));
    }
}
