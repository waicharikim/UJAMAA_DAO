// tests/auth/wallet.service.test.ts
import { describe, it, expect, beforeEach, vi, type MockedObject } from 'vitest';
import { prisma } from '../../src/core/database/client.js';
import { seedLocation, createTestUser, TEST_WARD_ID } from './helpers.js';

// ── Mock external dependencies before importing the service ──────────────────

vi.mock('ethers', () => ({
  ethers: {
    isAddress: vi.fn(),
    verifyMessage: vi.fn(),
  },
}));

vi.mock('../../src/core/blockchain/erc1271.js', () => ({
  verifyErc1271Signature: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/modules/community/services/groupMembership.service.js', () => ({
  groupMembershipService: { enrollInSystemGroups: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../src/modules/economy/services/participationRights.service.js', () => ({
  participationRightsService: { award: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../src/core/utils/eventBus.js', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('../../src/core/utils/email.service.js');

// ── Now import the service (ethers mock is already in place) ─────────────────
import { walletService } from '../../src/modules/auth/services/wallet.service.js';
import { ethers } from 'ethers';
import { verifyErc1271Signature } from '../../src/core/blockchain/erc1271.js';

const VALID_ADDRESS = '0xaabbccddeeaabbccddeeaabbccddeeaabbccddee';
const DUMMY_SIG = '0x' + 'a'.repeat(130);

describe('WalletService', () => {
  beforeEach(async () => {
    await seedLocation();
    // Reset all mocks between tests
    vi.mocked(ethers.isAddress).mockReturnValue(true);
    vi.mocked(ethers.verifyMessage).mockReturnValue(VALID_ADDRESS);
    vi.mocked(verifyErc1271Signature).mockResolvedValue(false);
  });

  // ── 1. generateNonce (valid address) ─────────────────────────────────────
  it('returns a nonce string for a valid address and stores it in memory', async () => {
    const nonce = await walletService.generateNonce(VALID_ADDRESS);

    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  // ── 2. generateNonce (invalid address) ───────────────────────────────────
  it('throws 400 for an invalid wallet address', async () => {
    vi.mocked(ethers.isAddress).mockReturnValue(false);

    await expect(
      walletService.generateNonce('not-an-address')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── 3. verifyAndLogin (new user) ─────────────────────────────────────────
  it('creates a new wallet-only user and returns needsProfileCompletion=true', async () => {
    // New wallet-only users have no email/ward → needsProfileCompletion=true
    await walletService.generateNonce(VALID_ADDRESS);
    vi.mocked(ethers.verifyMessage).mockReturnValue(VALID_ADDRESS);

    const result = await walletService.verifyAndLogin(VALID_ADDRESS, DUMMY_SIG);

    expect(result.needsProfileCompletion).toBe(true);
    expect(result.sessionToken).toBeTruthy();

    // User should be in DB
    const user = await prisma.user.findUnique({
      where: { walletAddress: VALID_ADDRESS.toLowerCase() },
    });
    expect(user).toBeTruthy();
  });

  // ── 4. verifyAndLogin (existing EMAIL_VERIFIED user) ─────────────────────
  it('creates a session for an existing verified user with complete profile', async () => {
    const address = '0xbbbbccccddddeeee1111222233334444aaaabbbb';

    // Create pre-existing user with complete profile
    await prisma.user.create({
      data: {
        walletAddress: address.toLowerCase(),
        email: 'wallet-existing@ujamaa.test',
        name: 'Wallet User',
        verificationLevel: 'EMAIL_VERIFIED',
        emailVerified: true,
        phoneVerified: false,
        communityVerified: false,
        locationVerified: false,
        primaryWardId: TEST_WARD_ID,
        secondaryWardId: TEST_WARD_ID,
      },
    });

    vi.mocked(ethers.isAddress).mockReturnValue(true);
    vi.mocked(ethers.verifyMessage).mockReturnValue(address);

    await walletService.generateNonce(address);
    const result = await walletService.verifyAndLogin(address, DUMMY_SIG);

    expect(result.needsProfileCompletion).toBe(false);
    expect(result.sessionToken).toBeTruthy();
    expect(result.session).toBeTruthy();
  });

  // ── 5. verifyAndLogin (no nonce for address) ──────────────────────────────
  it('throws 401 when no nonce was generated for the wallet address', async () => {
    const unknownAddress = '0x9999aaaa1111bbbb2222cccc3333dddd4444eeee';
    vi.mocked(ethers.isAddress).mockReturnValue(true);

    await expect(
      walletService.verifyAndLogin(unknownAddress, DUMMY_SIG)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  // ── 6. verifyAndLogin (bad signature) ────────────────────────────────────
  it('throws 401 when recovered address does not match wallet address', async () => {
    const address = '0x1111222233334444555566667777888899990000';
    await walletService.generateNonce(address);

    // verifyMessage returns a DIFFERENT address (signature mismatch)
    vi.mocked(ethers.isAddress).mockReturnValue(true);
    vi.mocked(ethers.verifyMessage).mockReturnValue(
      '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead'
    );

    await expect(
      walletService.verifyAndLogin(address, DUMMY_SIG)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  // ── 7. linkWallet (valid) ─────────────────────────────────────────────────
  it('links wallet address to an existing user', async () => {
    const user = await createTestUser('wallet-link@ujamaa.test');
    const linkAddress = '0xccccddddeeee0000111122223333444455556666';

    vi.mocked(ethers.isAddress).mockReturnValue(true);
    vi.mocked(ethers.verifyMessage).mockReturnValue(linkAddress);

    await walletService.generateNonce(linkAddress);
    const result = await walletService.linkWallet(user.id, linkAddress, DUMMY_SIG);

    expect(result.walletAddress).toBe(linkAddress.toLowerCase());

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.walletAddress).toBe(linkAddress.toLowerCase());
  });

  // ── 7b. linkWallet (smart account via ERC-1271) ───────────────────────────
  it('links a smart-account (passkey) wallet via ERC-1271 when EOA recovery does not match', async () => {
    const user = await createTestUser('wallet-aa-link@ujamaa.test');
    const smartAccount = '0x1234123412341234123412341234123412341234';

    vi.mocked(ethers.isAddress).mockReturnValue(true);
    // EOA recovery yields a different address (it's not an EOA signature) ...
    vi.mocked(ethers.verifyMessage).mockReturnValue(
      '0x0000000000000000000000000000000000000000'
    );
    // ... but the deployed smart account validates it via ERC-1271.
    vi.mocked(verifyErc1271Signature).mockResolvedValue(true);

    await walletService.generateNonce(smartAccount);
    const result = await walletService.linkWallet(user.id, smartAccount, DUMMY_SIG);

    expect(result.walletAddress).toBe(smartAccount.toLowerCase());
    expect(verifyErc1271Signature).toHaveBeenCalled();
  });

  // ── 7c. linkWallet (neither EOA nor ERC-1271 validates) ───────────────────
  it('rejects a wallet link when neither EOA recovery nor ERC-1271 validates', async () => {
    const user = await createTestUser('wallet-aa-reject@ujamaa.test');
    const addr = '0x9999888877776666555544443333222211110000';

    vi.mocked(ethers.isAddress).mockReturnValue(true);
    vi.mocked(ethers.verifyMessage).mockReturnValue(
      '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead'
    );
    vi.mocked(verifyErc1271Signature).mockResolvedValue(false);

    await walletService.generateNonce(addr);
    await expect(
      walletService.linkWallet(user.id, addr, DUMMY_SIG)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  // ── 8. linkWallet (wallet already linked to another user) ────────────────
  it('throws 409 if wallet is already linked to a different account', async () => {
    const existingAddress = '0xddddeeeeffffaaaa0000111122223333444455aa';
    const user1 = await createTestUser('wallet-conflict1@ujamaa.test');
    const user2 = await createTestUser('wallet-conflict2@ujamaa.test');

    // Link address to user1 directly
    await prisma.user.update({
      where: { id: user1.id },
      data: { walletAddress: existingAddress.toLowerCase() },
    });

    vi.mocked(ethers.isAddress).mockReturnValue(true);
    vi.mocked(ethers.verifyMessage).mockReturnValue(existingAddress);

    await walletService.generateNonce(existingAddress);

    // user2 tries to link the same address → conflict
    await expect(
      walletService.linkWallet(user2.id, existingAddress, DUMMY_SIG)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // ── 9. disconnectWallet ───────────────────────────────────────────────────
  it('clears walletAddress from user with email fallback', async () => {
    const user = await createTestUser('wallet-disconnect@ujamaa.test');
    const addr = '0xeeee0000111122223333444455556666777788aa';

    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: addr.toLowerCase() },
    });

    const result = await walletService.disconnectWallet(user.id);
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.walletAddress).toBeNull();
  });
});
