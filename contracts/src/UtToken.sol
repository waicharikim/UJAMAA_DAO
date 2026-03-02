// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title UtToken — Utility Token
 * @notice Standard ERC-20 internal points for UjamaaDAO.
 *         Earned UT has no cash-out path per platform rules.
 */
contract UtToken is ERC20, AccessControl {
    bytes32 public constant UT_MINTER_ROLE = keccak256("UT_MINTER_ROLE");
    bytes32 public constant UT_BURNER_ROLE = keccak256("UT_BURNER_ROLE");

    constructor(address admin) ERC20("Utility Token", "UT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UT_MINTER_ROLE, admin);
        _grantRole(UT_BURNER_ROLE, admin);
    }

    /**
     * @notice Mint UT tokens to a user's wallet.
     * @param to     Recipient address.
     * @param amount Amount in wei (18 decimals).
     */
    function mint(address to, uint256 amount) external onlyRole(UT_MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burn UT tokens from a user's wallet.
     * @param from   Address to burn from.
     * @param amount Amount in wei.
     */
    function burn(address from, uint256 amount) external onlyRole(UT_BURNER_ROLE) {
        _burn(from, amount);
    }
}
