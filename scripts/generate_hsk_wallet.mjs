/**
 * Genera una wallet compatible con ethers.js para HSK
 * Ejecutar: node scripts/generate_hsk_wallet.mjs
 */
import crypto from 'crypto';

// secp256k1 curve parameters
const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const G = {
  x: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
  y: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8')
};

function mod(k, p) {
  return ((k % p) + p) % p;
}

function modInv(a, p) {
  if (a === 0n) throw new Error('Inverse of 0');
  let lm = 1n, hm = 0n;
  let low = mod(a, p), high = p;
  while (low > 1n) {
    const r = high / low;
    const nm = hm - lm * r;
    const new_ = high - low * r;
    hm = lm; lm = nm; high = low; low = new_;
  }
  return mod(lm, p);
}

function pointAdd(P, Q) {
  if (P === null) return Q;
  if (Q === null) return P;
  if (P.x === Q.x && P.y !== Q.y) return null;
  
  let lam;
  if (P.x === Q.x && P.y === Q.y) {
    lam = mod(3n * P.x * P.x * modInv(2n * P.y, p), p);
  } else {
    lam = mod((Q.y - P.y) * modInv(Q.x - P.x, p), p);
  }
  
  const x3 = mod(lam * lam - P.x - Q.x, p);
  const y3 = mod(lam * (P.x - x3) - P.y, p);
  return { x: x3, y: y3 };
}

function pointMul(k, P) {
  let R = null;
  let Q = P;
  while (k > 0n) {
    if (k & 1n) R = pointAdd(R, Q);
    Q = pointAdd(Q, Q);
    k >>= 1n;
  }
  return R;
}

function keccak256(bytes) {
  // Simple keccak256 implementation
  const createHash = (await import('crypto')).createHash;
  return createHash('sha3-256').update(bytes).digest();
}

// Generate private key
const privateKeyBytes = crypto.randomBytes(32);
const privateKey = '0x' + privateKeyBytes.toString('hex');

// Generate public key (uncompressed, without 0x04 prefix)
const privKeyBigInt = BigInt('0x' + privateKeyBytes.toString('hex'));
const pubKeyPoint = pointMul(privKeyBigInt, G);
const pubKeyX = pubKeyPoint.x.toString(16).padStart(64, '0');
const pubKeyY = pubKeyPoint.y.toString(16).padStart(64, '0');
const pubKeyUncompressed = Buffer.from(pubKeyX + pubKeyY, 'hex');

// Ethereum address = last 20 bytes of keccak256(publicKey)
const hash = crypto.createHash('sha3-256').update(pubKeyUncompressed).digest();
const address = '0x' + hash.slice(-20).toString('hex');

console.log('=== WALLET HSK COMPATIBLE CON ETHERS.JS ===');
console.log('Address:', address);
console.log('Private Key:', privateKey);
console.log('');
console.log('INSTRUCCIONES:');
console.log('1. Ve a https://faucet.hskchain.net/faucet');
console.log('2. Pega el address:', address);
console.log('3. Espera recibir HSK testnet');
console.log('4. Guarda la private key en .env:');
console.log('   RELAYER_PRIVATE_KEY=' + privateKey);
console.log('5. Ejecuta deployment:');
console.log('   node contracts/evm/deploy_hsk.mjs --network hskTestnet --private-key ' + privateKey);
