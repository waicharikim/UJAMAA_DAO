// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PrToken — Participation Rights Token
 * @notice Soulbound (non-transferable) ERC-20 governance token for UjamaaDAO.
 *         Earned through participation; cannot be sold or traded.
 */
contract PrToken is ERC20, AccessControl {
    bytes32 public constant PR_MINTER_ROLE = keccak256("PR_MINTER_ROLE");
    bytes32 public constant PR_BURNER_ROLE = keccak256("PR_BURNER_ROLE");

    event ParticipationRightsAwarded(address indexed user, uint256 amount);

    constructor(address admin) ERC20("Participation Rights", "PR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PR_MINTER_ROLE, admin);
        _grantRole(PR_BURNER_ROLE, admin);
    }

    /**
     * @notice Mint PR tokens to a user's wallet.
     * @param to     Recipient address.
     * @param amount Amount in wei (18 decimals).
     */
    function mint(address to, uint256 amount) external onlyRole(PR_MINTER_ROLE) {
        _mint(to, amount);
        emit ParticipationRightsAwarded(to, amount);
    }

    /**
     * @notice Burn PR tokens from a user's wallet (e.g. penalties).
     * @param from   Address to burn from.
     * @param amount Amount in wei.
     */
    function burn(address from, uint256 amount) external onlyRole(PR_BURNER_ROLE) {
        _burn(from, amount);
    }

    // ── Soulbound overrides ──────────────────────────────────────────────────

    function transfer(address, uint256) public pure override returns (bool) {
        revert("PR: non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("PR: non-transferable");
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert("PR: non-transferable");
    }

    function allowance(address, address) public pure override returns (uint256) {
        return 0;
    }
}
