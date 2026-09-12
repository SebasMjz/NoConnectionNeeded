import {
  generateRealEvmKeypair,
  computeCanonicalEvmTxHash,
  signWithEvmKey,
  verifyEvmSignature,
  counterSignEvmPaymentReceipt,
  verifyPayeeEvmCounterSignature,
  buildRealEvmMerkleTree,
  generateEvmMerkleProof,
  verifyEvmMerkleProof,
  EVM_NETWORKS
} from '../src/services/evmCrypto.js';

console.log('=== Testing EVM Offline Cryptographic Suite ===\n');

// 1. Generate Keypairs
const payer = generateRealEvmKeypair();
const payee = generateRealEvmKeypair();
console.log('1. Payer Address:', payer.address);
console.log('   Payee Address:', payee.address);
if (!payer.address.startsWith('0x') || payer.address.length !== 42) {
  throw new Error('Invalid EVM address format');
}

// 2. Offline Payment Payload
const payload = {
  id: 'evm_tx_123',
  payer: payer.address,
  payee: payee.address,
  amount: 25.5,
  asset: 'USDT',
  network: 'EVM',
  nonce: 1,
  memo: 'Lunch at Cafe',
  timestamp: Date.now()
};

const txHash = computeCanonicalEvmTxHash(payload);
console.log('\n2. Computed EIP Canonical TxHash:', txHash);

// 3. Payer signs offline voucher
const { signature: payerSig } = await signWithEvmKey(payload, payer.privateKey);
console.log('3. Payer Secp256k1 Signature:', payerSig.substring(0, 30) + '...');

const isPayerSigValid = verifyEvmSignature(payer.address, txHash, payerSig);
console.log('   Payer signature valid?', isPayerSigValid);
if (!isPayerSigValid) throw new Error('Payer signature verification failed!');

// 4. Payee counter-signs payment receipt
const { receiptHash, payeeSignature } = await counterSignEvmPaymentReceipt(txHash, payerSig, payee.privateKey);
console.log('\n4. Payee Counter-Signature:', payeeSignature.substring(0, 30) + '...');

const isPayeeSigValid = verifyPayeeEvmCounterSignature(payee.address, txHash, payerSig, payeeSignature);
console.log('   Payee counter-signature valid?', isPayeeSigValid);
if (!isPayeeSigValid) throw new Error('Payee counter-signature verification failed!');

// 5. Build Merkle Tree of offline batch
const dualSignedTx = {
  payload,
  txHash,
  payerSignature: payerSig,
  payeeSignature: payeeSignature,
  status: 'PENDING_OFFLINE'
};

const tree = buildRealEvmMerkleTree([dualSignedTx]);
console.log('\n5. Merkle Root Hash:', tree.rootHash);
console.log('   Transaction count:', tree.transactionCount);
if (!tree.rootHash.startsWith('0x') || tree.rootHash.length !== 66) {
  throw new Error('Invalid Merkle root format');
}

// 6. Generate and verify Merkle proof
const proof = generateEvmMerkleProof([dualSignedTx], 0);
const isProofValid = verifyEvmMerkleProof(proof);
console.log('6. Merkle Proof valid?', isProofValid);
if (!isProofValid) throw new Error('Merkle proof failed!');

console.log('\n7. Supported Networks:', Object.keys(EVM_NETWORKS).join(', '));
console.log('   Sepolia Chain ID:', EVM_NETWORKS.sepolia.chainId);

console.log('\n[SUCCESS] All EVM offline cryptographic tests passed cleanly!');
