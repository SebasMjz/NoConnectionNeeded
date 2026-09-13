import { ethers } from 'ethers';

// Generate a new wallet compatible with ethers.js
const wallet = ethers.Wallet.createRandom();

console.log('=== WALLET HSK (COMPATIBLE CON ETHERS.JS) ===');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
console.log('');
console.log('INSTRUCCIONES:');
console.log('1. Guarda la private key en .env:');
console.log('   RELAYER_PRIVATE_KEY=' + wallet.privateKey);
console.log('2. Ve al faucet HSK:');
console.log('   https://faucet.hashkey.com');
console.log('3. Pega el address:', wallet.address);
console.log('4. Espera recibir HSK testnet');
console.log('5. Ejecuta deployment:');
console.log('   node contracts/evm/deploy_hsk.mjs --network hskTestnet --private-key ' + wallet.privateKey);
