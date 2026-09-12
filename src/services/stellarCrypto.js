import { Keypair } from '@stellar/stellar-sdk';
import QRCode from 'qrcode';

// Canonical SHA-256 hashing using WebCrypto
export async function sha256Hex(dataString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

// Pair hashing: SHA256(left + right)
export async function hashPair(left, right) {
  return sha256Hex(left + right);
}

// Convert Hex string to Uint8Array
export function hexToBytes(hexString) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to Hex string
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Real Stellar Keypair Generator (Ed25519 G... / S...)
 */
export function generateRealStellarKeypair() {
  const kp = Keypair.random();
  return {
    publicKey: kp.publicKey(),     // Real Stellar G... address
    secretKey: kp.secret(),        // Real Stellar S... secret key
    rawPublicKeyHex: bytesToHex(kp.rawPublicKey()),
  };
}

/**
 * Import a Stellar Account from a Secret Key (S...) or Public Address (G...)
 */
export function importStellarAccount(inputKey) {
  const cleanKey = inputKey.trim();
  if (cleanKey.startsWith('S')) {
    const kp = Keypair.fromSecret(cleanKey);
    return {
      publicKey: kp.publicKey(),
      secretKey: kp.secret(),
      isReadOnly: false
    };
  } else if (cleanKey.startsWith('G')) {
    return {
      publicKey: cleanKey,
      secretKey: '',
      isReadOnly: true
    };
  }
  throw new Error('Clave inválida. Debe comenzar con G... (clave pública) o S... (clave secreta).');
}

/**
 * Fetches real on-chain account balances from Stellar Horizon
 */
export async function fetchRealAccountBalances(publicKey, horizonUrl = 'https://horizon-testnet.stellar.org') {
  try {
    const { Horizon } = await import('@stellar/stellar-sdk');
    const server = new Horizon.Server(horizonUrl);
    const account = await server.loadAccount(publicKey);
    
    const balances = account.balances.map(b => ({
      asset: b.asset_type === 'native' ? 'XLM' : b.asset_code,
      balance: parseFloat(b.balance),
      issuer: b.asset_issuer || '',
      isNative: b.asset_type === 'native'
    }));

    const nativeBal = balances.find(b => b.isNative)?.balance || 0;
    const usdtBal = balances.find(b => b.asset === 'USDT')?.balance || 0;

    return {
      success: true,
      sequence: account.sequence,
      balances,
      primaryBalance: usdtBal > 0 ? usdtBal : nativeBal,
      primaryAsset: usdtBal > 0 ? 'USDT' : 'XLM',
      nativeBalance: nativeBal
    };
  } catch (err) {
    if (err.name === 'NotFoundError' || err.status === 404 || (err.response && err.response.status === 404)) {
      return {
        success: false,
        isNewAccount: true,
        primaryBalance: 0,
        primaryAsset: 'XLM',
        balances: [],
        message: 'Cuenta no inicializada en el ledger de Stellar.'
      };
    }
    return {
      success: false,
      error: err.message,
      primaryBalance: 0,
      primaryAsset: 'XLM',
      balances: []
    };
  }
}

/**
 * Computes deterministic canonical SHA-256 hash for transaction payload
 */
export async function computeCanonicalTxHash(payload) {
  const canonicalString = [
    payload.id,
    payload.payer,
    payload.payee,
    parseFloat(payload.amount).toFixed(7),
    payload.asset,
    payload.nonce.toString(),
    payload.timestamp.toString(),
    payload.memo || ''
  ].join('|');

  return sha256Hex(canonicalString);
}

/**
 * Real Ed25519 Signature using Stellar Keypair
 */
export async function signWithStellarKey(secretKey, messageHashHex) {
  const kp = Keypair.fromSecret(secretKey);
  const hashBytes = hexToBytes(messageHashHex);
  const signatureBuffer = kp.sign(hashBytes);
  return bytesToHex(signatureBuffer);
}

/**
 * Real Ed25519 Verification using Stellar Public Key
 */
export function verifyStellarSignature(publicKey, messageHashHex, signatureHex) {
  try {
    const kp = Keypair.fromPublicKey(publicKey);
    const hashBytes = hexToBytes(messageHashHex);
    const sigBytes = hexToBytes(signatureHex);
    return kp.verify(hashBytes, sigBytes);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Payee Counter-Signs the Payer's Payment Commitment
 */
export async function counterSignPaymentReceipt(payeeSecretKey, txHash, payerSignature) {
  const receiptPayload = `RECEIPT|${txHash}|${payerSignature}`;
  const receiptHash = await sha256Hex(receiptPayload);
  return signWithStellarKey(payeeSecretKey, receiptHash);
}

/**
 * Verifies Payee's Counter-Signature
 */
export async function verifyPayeeCounterSignature(payeePublicKey, txHash, payerSignature, payeeSignature) {
  const receiptPayload = `RECEIPT|${txHash}|${payerSignature}`;
  const receiptHash = await sha256Hex(receiptPayload);
  return verifyStellarSignature(payeePublicKey, receiptHash, payeeSignature);
}

/**
 * Computes Leaf Hash for the Merkle Tree
 */
export async function computeMerkleLeafHash(tx) {
  const raw = [
    tx.txHash,
    tx.payload.payer,
    tx.payload.payee,
    tx.payload.amount.toFixed(7),
    tx.payload.nonce.toString(),
    tx.payerSignature,
    tx.payeeSignature
  ].join(':');

  return sha256Hex(raw);
}

/**
 * Real Merkle Tree Construction
 */
export async function buildRealMerkleTree(transactions) {
  if (!transactions || transactions.length === 0) {
    const emptyHash = await sha256Hex('POLLAR_EMPTY_MERKLE_TREE');
    return {
      rootHash: emptyHash,
      leaves: [],
      levels: [[{ hash: emptyHash, isLeaf: true }]],
      transactionCount: 0
    };
  }

  const leaves = [];
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const leafHash = await computeMerkleLeafHash(tx);
    tx.merkleLeafHash = leafHash;
    leaves.push({
      hash: leafHash,
      index: i,
      isLeaf: true,
      txData: tx
    });
  }

  const levels = [leaves];
  let currentLevel = leaves;

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      let right = currentLevel[i + 1];
      if (!right) {
        // Duplicate last node for odd trees
        right = { ...left };
      }
      const parentHash = await hashPair(left.hash, right.hash);
      nextLevel.push({
        hash: parentHash,
        left,
        right,
        isLeaf: false
      });
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  const rootHash = currentLevel[0].hash;
  return {
    rootHash,
    leaves,
    levels,
    transactionCount: transactions.length
  };
}

/**
 * Generates Merkle Audit Proof for a given leaf index
 */
export async function generateMerkleProof(transactions, targetIndex) {
  if (targetIndex < 0 || targetIndex >= transactions.length) {
    throw new Error('Transaction index out of bounds');
  }

  const tree = await buildRealMerkleTree(transactions);
  const steps = [];
  let currentIndex = targetIndex;

  for (let l = 0; l < tree.levels.length - 1; l++) {
    const level = tree.levels[l];
    const isEven = currentIndex % 2 === 0;
    const siblingIndex = isEven ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < level.length) {
      steps.push({
        hash: level[siblingIndex].hash,
        position: isEven ? 'right' : 'left'
      });
    } else {
      steps.push({
        hash: level[currentIndex].hash,
        position: 'right'
      });
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    targetIndex,
    leafHash: tree.leaves[targetIndex].hash,
    rootHash: tree.rootHash,
    txHash: transactions[targetIndex].txHash,
    steps
  };
}

/**
 * Verifies Merkle Audit Proof
 */
export async function verifyMerkleProof(proof) {
  let current = proof.leafHash;
  for (const step of proof.steps) {
    if (step.position === 'left') {
      current = await hashPair(step.hash, current);
    } else {
      current = await hashPair(current, step.hash);
    }
  }
  return current === proof.rootHash;
}

/**
 * Generates Reliable High-Res QR Code Data URL
 */
export async function generateQrDataUrl(dataObject, colorDark = '#00f2fe') {
  const jsonString = typeof dataObject === 'string' ? dataObject : JSON.stringify(dataObject);
  return QRCode.toDataURL(jsonString, {
    width: 320,
    margin: 2,
    color: {
      dark: colorDark,
      light: '#07090e'
    },
    errorCorrectionLevel: 'M'
  });
}

/**
 * Funds a Stellar Testnet account automatically using Friendbot
 */
/**
 * Funds a Stellar Testnet account automatically using Friendbot
 */
export async function fundWithFriendbot(publicKey) {
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
    return { success: false, status: response.status };
  } catch (err) {
    console.warn('Friendbot funding notice:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Loads an account from Horizon with auto-funding and retries
 */
export async function loadOrCreateAccount(server, publicKey) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await server.loadAccount(publicKey);
    } catch (e) {
      if (attempt === 0) {
        console.log(`[Stellar Testnet] Creando y fondeando cuenta ${publicKey.substring(0, 10)}...`);
        await fundWithFriendbot(publicKey);
      }
      // Wait for ledger closing (typically 3-4s on Stellar)
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  // Final attempt
  return await server.loadAccount(publicKey);
}

/**
 * Submits a real batch settlement transaction to Stellar Horizon Testnet
 */
export async function submitRealStellarBatchTransaction({
  payerSecretKey,
  payerPublicKey,
  payeePublicKey,
  amount,
  merkleRootHash,
  horizonUrl = 'https://horizon-testnet.stellar.org'
}) {
  const { Horizon, TransactionBuilder, Operation, Asset, Memo, Networks, Keypair } = await import('@stellar/stellar-sdk');
  const server = new Horizon.Server(horizonUrl);

  console.log('[Stellar Testnet] Verificando cuenta pagadora:', payerPublicKey);
  const sourceAccount = await loadOrCreateAccount(server, payerPublicKey);

  console.log('[Stellar Testnet] Verificando cuenta cobradora:', payeePublicKey);
  await loadOrCreateAccount(server, payeePublicKey);

  // Prepare memo hash (32-byte Merkle root)
  let memoObj;
  try {
    if (merkleRootHash && merkleRootHash.length === 64) {
      memoObj = Memo.hash(merkleRootHash);
    } else {
      memoObj = Memo.text(`MRK:${(merkleRootHash || 'POLLAR').substring(0, 24)}`);
    }
  } catch (err) {
    memoObj = Memo.text('POLLAR_OFFLINE_BATCH');
  }

  // Amount in native XLM
  const txAmount = Math.max(0.1, parseFloat(amount) || 1.0).toFixed(7);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(
      Operation.payment({
        destination: payeePublicKey,
        asset: Asset.native(),
        amount: txAmount
      })
    )
    .addMemo(memoObj)
    .setTimeout(60)
    .build();

  // Sign with Payer's secret key
  const kp = Keypair.fromSecret(payerSecretKey);
  transaction.sign(kp);

  console.log('[Stellar Testnet] Transmitiendo a Horizon Testnet...');
  const result = await server.submitTransaction(transaction);
  console.log('[Stellar Testnet] ¡Transacción confirmada en Horizon!', result.hash);

  return {
    success: true,
    hash: result.hash,
    ledger: result.ledger,
    merkleRoot: merkleRootHash,
    stellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${result.hash}`
  };
}
