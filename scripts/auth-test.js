import fetch from 'node-fetch';
import { Wallet } from 'ethers';

// Replace with your test wallet's private key (do NOT use real keys)
const PRIVATE_KEY = '0x4b471bc57663dbef67ab155043f2db2659a7c9c9514c252be0787de970fe234b';
const wallet = new Wallet(PRIVATE_KEY);

const BACKEND_URL = 'http://localhost:4000/api/auth'; // Update if needed

async function testLogin() {
  try {
    // Step 1: Fetch nonce for wallet address
    const walletAddress = wallet.address;
    console.log('Wallet address:', walletAddress);

    const nonceResp = await fetch(`${BACKEND_URL}/nonce?walletAddress=${walletAddress}`);
    if (!nonceResp.ok) throw new Error(`Failed to get nonce: ${nonceResp.statusText}`);
    const { nonce } = await nonceResp.json();
    console.log('Received nonce from backend:', nonce);

    // Step 2: Sign the nonce message
    const message = `Login nonce: ${nonce}`;
    const signature = await wallet.signMessage(message);
    console.log('Generated signature:', signature);

    // Step 3: Send signature for verification
    const verifyResp = await fetch(`${BACKEND_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature }),
    });
    if (!verifyResp.ok) {
      const error = await verifyResp.json();
      throw new Error(`Signature verification failed: ${error.error || JSON.stringify(error)}`);
    }

    const { token, user } = await verifyResp.json();
    console.log('Login successful!');
    console.log('User:', user);
    console.log('JWT Token:', token);

  } catch (err) {
    console.error('Error during auth test:', err);
  }
}

testLogin();