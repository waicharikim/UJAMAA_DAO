// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrToken.sol";
import "../src/UtToken.sol";
import "../src/GovernanceVoting.sol";

/**
 * @title Deploy — UjamaaDAO Token Deploy Script
 * @notice Deploys PrToken and UtToken, granting admin/minter/burner roles
 *         to the address specified by MINTER_WALLET_ADDRESS env var.
 *
 * Run (Base Sepolia — when wallet is funded):
 *   cd contracts
 *   forge script script/Deploy.s.sol \
 *     --rpc-url base_sepolia \
 *     --private-key $MINTER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 *
 * Run (local Anvil):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url anvil_local \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
 *     --broadcast
 */
contract Deploy is Script {
    function run() external {
        address minter = vm.envAddress("MINTER_WALLET_ADDRESS");

        vm.startBroadcast();

        PrToken prToken = new PrToken(minter);
        UtToken utToken = new UtToken(minter);
        GovernanceVoting governance = new GovernanceVoting(minter, address(prToken));

        vm.stopBroadcast();

        console.log("PrToken deployed at:         ", address(prToken));
        console.log("UtToken deployed at:         ", address(utToken));
        console.log("GovernanceVoting deployed at:", address(governance));
        console.log("Admin/minter/recorder:       ", minter);
    }
}
