import request from 'supertest';
import app from '../src/app.js';
import { Wallet } from 'ethers';

interface TestUser {
  id: string;
  walletAddress: string;
  email: string;
  jwtToken: string;
}

// Example test private key; replace if needed with your test key
const TEST_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945384df71b1f68d0e3fcb7e3c54e920f2f11c';
const wallet = new Wallet(TEST_PRIVATE_KEY);

/**
 * Create or retrieve a user by walletAddress and authenticate,
 * returning user info with a valid JWT token.
 */
export async function createTestUser(
  email = 'test@example.com',
  name = 'Test User',
  constituencyOrigin = 'TestConstituency',
  countyOrigin = 'TestCounty',
  constituencyLive = 'TestConstituency',
  countyLive = 'TestCounty'
): Promise<TestUser> {
  // Normalize wallet address to lowercase everywhere!
  const walletAddress = wallet.address.toLowerCase();
  console.log('Starting createTestUser flow for wallet:', walletAddress);

  // Try creating user first
  const resCreate = await request(app).post('/api/users').send({
    walletAddress,
    email,
    name,
    constituencyOrigin,
    countyOrigin,
    constituencyLive,
    countyLive,
  });

  console.log('User creation response status:', resCreate.status);

  let userId: string;

  if (resCreate.status === 201) {
    // Created successfully
    userId = resCreate.body.id;
    console.log('User created with ID:', userId);

    // Add a small delay for DB eventual consistency before nonce fetch
    await new Promise((resolve) => setTimeout(resolve, 150));
    console.log('Waited 150ms after user creation for DB consistency');
  } else if (resCreate.status === 409) {
    // User already exists, so fetch user info by wallet (also normalize here)
    console.log('User exists, fetching existing user by wallet address...');

    const userResp = await request(app).get(`/api/users/wallet/${walletAddress}`);

    console.log('Fetch user by wallet status:', userResp.status);

    if (userResp.status !== 200) {
      console.error('Failed to fetch existing user:', userResp.body);
      throw new Error('Could not retrieve existing user ID');
    }

    userId = userResp.body.id;
    console.log('Existing user ID retrieved:', userId);
  } else {
    console.error('Unexpected response from user creation:', resCreate.body);
    throw new Error(`Unexpected response creating user: ${resCreate.status}`);
  }

  // Fetch nonce to initiate login challenge (walletAddress normalized)
  const nonceRes = await request(app).get('/api/auth/nonce').query({ walletAddress });
  console.log('Nonce fetch status:', nonceRes.status);
  if (nonceRes.status !== 200) {
    console.error('Failed to get nonce:', nonceRes.body);
    throw new Error('Failed to get nonce from backend');
  }
  const nonce = nonceRes.body.nonce;
  console.log('Received nonce:', nonce);

  // Sign the nonce message with ethers Wallet
  const message = `Login nonce: ${nonce}`;
  const signature = await wallet.signMessage(message);
  console.log('Signed nonce to produce signature:', signature);

  // Send signature for verification and get JWT token (walletAddress normalized)
  const verifyRes = await request(app).post('/api/auth/verify').send({
    walletAddress,
    signature,
  });

  console.log('Signature verify status:', verifyRes.status);

  if (verifyRes.status !== 200) {
    console.error('Signature verification failed:', verifyRes.body);
    throw new Error(`Signature verification failed: ${JSON.stringify(verifyRes.body)}`);
  }

  const { token, user } = verifyRes.body;
  console.log('Received JWT token for user auth');

  return {
    id: userId,
    walletAddress,
    email,
    jwtToken: `Bearer ${token}`, // Make sure to include Bearer prefix
  };
}