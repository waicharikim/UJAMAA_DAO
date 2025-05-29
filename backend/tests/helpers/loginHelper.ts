import request from 'supertest';
import app from '../../src/app.js'; // Adjust path based on your project
import { Wallet } from 'ethers';

const TEST_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945384df71b1f68d0e3fcb7e3c54e920f2f11c';
const wallet = new Wallet(TEST_PRIVATE_KEY);

export async function loginAndGetToken(): Promise<string> {
  const walletAddress = wallet.address.toLowerCase();

  // Get nonce for wallet
  const nonceRes = await request(app).get('/api/auth/nonce').query({ walletAddress });
  if (nonceRes.status !== 200) throw new Error('Failed to get nonce');
  const nonce = nonceRes.body.nonce;

  // Sign nonce message
  const message = `Login nonce: ${nonce}`;
  const signature = await wallet.signMessage(message);

  // Verify signature and obtain JWT token
  const verifyRes = await request(app)
    .post('/api/auth/verify')
    .send({ walletAddress, signature });
  if (verifyRes.status !== 200) throw new Error('Failed to verify signature');

  return `Bearer ${verifyRes.body.token}`;
}