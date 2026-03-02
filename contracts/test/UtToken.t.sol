// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/UtToken.sol";

contract UtTokenTest is Test {
    UtToken public token;
    address public userA;
    address public userB;

    function setUp() public {
        token = new UtToken(address(this));
        userA = makeAddr("userA");
        userB = makeAddr("userB");
    }

    function test_MintIncreasesBalance() public {
        token.mint(userA, 500e18);
        assertEq(token.balanceOf(userA), 500e18);
    }

    function test_TransferWorks() public {
        token.mint(userA, 200e18);
        vm.prank(userA);
        token.transfer(userB, 100e18);
        assertEq(token.balanceOf(userA), 100e18);
        assertEq(token.balanceOf(userB), 100e18);
    }

    function test_BurnReducesBalance() public {
        token.mint(userA, 300e18);
        token.burn(userA, 300e18);
        assertEq(token.balanceOf(userA), 0);
    }

    function test_Mint_NotMinter_Reverts() public {
        vm.prank(userA);
        vm.expectRevert();
        token.mint(userA, 100e18);
    }
}
