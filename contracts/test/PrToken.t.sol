// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrToken.sol";

contract PrTokenTest is Test {
    PrToken public token;
    address public user;

    event ParticipationRightsAwarded(address indexed user, uint256 amount);

    function setUp() public {
        token = new PrToken(address(this));
        user = makeAddr("user");
    }

    function test_MintIncreasesBalance() public {
        token.mint(user, 100e18);
        assertEq(token.balanceOf(user), 100e18);
    }

    function test_MintEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ParticipationRightsAwarded(user, 100e18);
        token.mint(user, 100e18);
    }

    function test_Transfer_Reverts() public {
        token.mint(user, 100e18);
        vm.prank(user);
        vm.expectRevert(bytes("PR: non-transferable"));
        token.transfer(address(1), 1);
    }

    function test_TransferFrom_Reverts() public {
        token.mint(user, 100e18);
        vm.prank(user);
        vm.expectRevert(bytes("PR: non-transferable"));
        token.transferFrom(user, address(1), 1);
    }

    function test_Approve_Reverts() public {
        vm.prank(user);
        vm.expectRevert(bytes("PR: non-transferable"));
        token.approve(address(1), 100e18);
    }

    function test_Allowance_ReturnsZero() public view {
        assertEq(token.allowance(user, address(1)), 0);
    }

    function test_BurnReducesBalance() public {
        token.mint(user, 100e18);
        token.burn(user, 100e18);
        assertEq(token.balanceOf(user), 0);
    }

    function test_Mint_NotMinter_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        token.mint(user, 100e18);
    }

    function test_Burn_NotBurner_Reverts() public {
        token.mint(user, 100e18);
        vm.prank(user);
        vm.expectRevert();
        token.burn(user, 100e18);
    }
}
