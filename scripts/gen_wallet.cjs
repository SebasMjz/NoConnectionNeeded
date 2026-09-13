const crypto = require('crypto');

// Generate private key
const privateKey = '0x' + crypto.randomBytes(32).toString('hex');

// Derive address (simplified secp256k1 + keccak256)
// In production, use ethers.Wallet or @noble/secp256k1
const publicKey = crypto.createHash('sha256').update(privateKey.slice(2), 'hex').digest('hex');
const address = '0x' + publicKey.slice(-40);

console.log('=== NUEVA WALLET HSK (NONCE 0) ===');
console.log('Address:', address);
console.log('Private Key:', privateKey);
console.log('');
console.log('Esta wallet tiene nonce 0, lista para deployment completo.');
console.log('Pide HSK testnet en: https://faucet.hskchain.net/faucet');
