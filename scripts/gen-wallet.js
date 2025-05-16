import { Wallet } from 'ethers';

const wallet = Wallet.createRandom();
console.log('New Wallet Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);