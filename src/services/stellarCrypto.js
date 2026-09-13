import { Keypair } from '@stellar/stellar-sdk';
import QRCode from 'qrcode';

// Pure JS SHA-256 fallback for non-secure contexts (crypto.subtle unavailable)
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Pure(input) {
  const msg = new TextEncoder().encode(input);
  const msgLen = msg.length;
  const bitLen = msgLen * 8;
  const padLen = (56 - ((msgLen + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(msg);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Int32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i-15]>>>7)^(w[i-15]>>>18)^(w[i-15]>>>3)) | 0;
      const s1 = ((w[i-2]>>>17)^(w[i-2]>>>19)^(w[i-2]>>>10)) | 0;
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e>>>6)^(e>>>11)^(e>>>25)) | 0;
      const ch = (e&f)^(~e&g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = ((a>>>2)^(a>>>13)^(a>>>22)) | 0;
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
    h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}

const hasCryptoSubtle = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';

// Canonical SHA-256 hashing using WebCrypto with pure JS fallback
export async function sha256Hex(dataString) {
  if (hasCryptoSubtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hashBuffer)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256Pure(dataString);
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
      isNative: b.asset_type === 'native',
      limit: b.limit ? parseFloat(b.limit) : null
    }));

    const nativeBal = balances.find(b => b.isNative)?.balance || 0;

    return {
      success: true,
      exists: true,
      sequence: account.sequence,
      balances,
      primaryBalance: nativeBal,
      primaryAsset: 'XLM',
      nativeBalance: nativeBal
    };
  } catch (err) {
    const isNotFound = err.name === 'NotFoundError' || err.status === 404 || (err.response && err.response.status === 404);
    return {
      success: false,
      exists: !isNotFound,
      isNewAccount: isNotFound,
      primaryBalance: 0,
      primaryAsset: 'XLM',
      balances: [],
      message: isNotFound ? 'Cuenta no inicializada en el ledger de Stellar.' : err.message
    };
  }
}

/**
 * Computes deterministic canonical SHA-256 hash for transaction payload
 */
export async function computeCanonicalTxHash(payload) {
  const parts = [
    payload.id,
    payload.payer,
    payload.payee,
    parseFloat(payload.amount).toFixed(7),
    payload.asset,
    payload.nonce.toString(),
    payload.timestamp.toString(),
    payload.memo || ''
  ];
  if (payload.signer && payload.signer !== payload.payer) {
    parts.push(payload.signer);
  }

  return sha256Hex(parts.join('|'));
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
 * Serializes an invoice into a compact, low-density representation for simple QR codes
 */
export function serializeCompactInvoice({ payee, amount, asset = 'XLM', memo = '' }) {
  return {
    t: 'inv',
    p: payee,
    a: typeof amount === 'number' ? amount : (parseFloat(amount) || 0),
    c: asset,
    m: memo || ''
  };
}

/**
 * Serializes a signed payment into a compact payload, stripping redundant hash/null fields
 * to drastically reduce QR code complexity and module count.
 */
export function serializeCompactPayment(tx) {
  const payload = tx.payload || tx;
  const compact = {
    t: 'pay',
    id: payload.id,
    p: payload.payer,
    r: payload.payee,
    a: payload.amount,
    c: payload.asset,
    n: payload.nonce,
    ts: payload.timestamp,
    m: payload.memo || '',
    sig: tx.payerSignature
  };
  if (payload.signer && payload.signer !== payload.payer) {
    compact.s = payload.signer;
  }
  return compact;
}

/**
 * Robust parser that unpacks both compact (v2) and legacy (v1) QR data,
 * handling invoices (cobro) and signed payments (pago) without errors.
 */
export async function parsePaymentQrData(rawInput) {
  if (!rawInput) throw new Error('Contenido vacío');

  let data = rawInput;
  if (typeof rawInput === 'string') {
    let clean = rawInput.trim();
    try {
      data = JSON.parse(clean);
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
    } catch (err) {
      if (clean.includes('{') && clean.includes('}')) {
        const jsonStart = clean.indexOf('{');
        const jsonEnd = clean.lastIndexOf('}');
        data = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error('Formato JSON no válido');
      }
    }
  }

  // 1. Invoice parsing (QR de Cobro)
  if (
    data.t === 'inv' ||
    data.type === 'POLLAR_INVOICE' ||
    data.type === 'INVOICE' ||
    (data.p && !data.sig && !data.r) ||
    (data.payee && !data.payer && !data.sig)
  ) {
    const rawAmt = data.a !== undefined ? data.a : (data.amount !== undefined ? data.amount : 0);
    return {
      type: 'INVOICE',
      payee: data.p || data.payee,
      amount: typeof rawAmt === 'number' ? rawAmt : (parseFloat(rawAmt) || 0),
      asset: data.c || data.asset || 'XLM',
      memo: data.m !== undefined ? data.m : (data.memo || '')
    };
  }

  // 2. Compact payment payload (v2 - Pago Firmado)
  if (data.t === 'pay' || (data.p && data.r && data.sig)) {
    const txPayload = {
      id: data.id || `TX-OFFLINE-${Date.now().toString(36).toUpperCase()}`,
      payer: data.p,
      signer: data.s || data.p,
      payee: data.r,
      amount: typeof data.a === 'number' ? data.a : parseFloat(data.a),
      asset: data.c || 'XLM',
      nonce: parseInt(data.n || 1, 10),
      memo: data.m || '',
      timestamp: parseInt(data.ts || Date.now(), 10)
    };
    const txHash = data.txHash || await computeCanonicalTxHash(txPayload);
    return {
      type: 'PAYMENT',
      tx: {
        payload: txPayload,
        txHash,
        payerSignature: data.sig,
        payeeSignature: null,
        status: 'PENDING_COUNTER_SIGN'
      }
    };
  }

  // 3. Legacy payment payload (v1)
  if (data.type === 'POLLAR_PAYMENT_PAYLOAD' || data.txHash || data.tx || (data.payload && data.payerSignature)) {
    const tx = data.tx || data;
    return {
      type: 'PAYMENT',
      tx
    };
  }

  throw new Error('Formato QR no compatible');
}

/**
 * Generates Simple, High-Readability Black & White QR Code Data URL.
 * Uses Error Correction 'L' (Low 7%) to drastically decrease module density,
 * producing larger, cleaner pixel squares that scan instantly on any camera.
 */
export async function generateQrDataUrl(dataObject, colorDark = '#000000', colorLight = '#FFFFFF') {
  const jsonString = typeof dataObject === 'string' ? dataObject : JSON.stringify(dataObject);
  return QRCode.toDataURL(jsonString, {
    width: 340,
    margin: 1,
    color: {
      dark: colorDark,
      light: colorLight
    },
    errorCorrectionLevel: 'L'
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
 * Loads an account from Horizon with validation
 */
export async function loadOrCreateAccount(server, publicKey) {
  try {
    return await server.loadAccount(publicKey);
  } catch (err) {
    if (err.name === 'NotFoundError' || err.status === 404 || (err.response && err.response.status === 404)) {
      throw new Error(`La cuenta ${publicKey} no existe en Stellar Testnet. Fondea la cuenta con Friendbot primero.`);
    }
    throw err;
  }
}

/**
 * Submits a real batch settlement transaction to Stellar Horizon Testnet
 */
export async function submitRealStellarBatchTransaction({
  payerSecretKey,
  payerPublicKey,
  payeePublicKey,
  amount,
  assetCode = 'XLM',
  assetIssuer = '',
  merkleRootHash,
  horizonUrl = 'https://horizon-testnet.stellar.org'
}) {
  const { Horizon, TransactionBuilder, Operation, Asset, Memo, Networks, Keypair } = await import('@stellar/stellar-sdk');
  const server = new Horizon.Server(horizonUrl);

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Monto inválido para liquidación on-chain: ${amount}`);
  }
  if (payerPublicKey && payeePublicKey && payerPublicKey.trim() === payeePublicKey.trim()) {
    throw new Error('No se pueden enviar transacciones a la misma wallet que emite el pago/QR (la cuenta de origen y destino son idénticas).');
  }
  const txAmount = numAmount.toFixed(7);

  console.log('[Stellar Testnet] Cargando cuenta pagadora:', payerPublicKey);
  const sourceAccount = await loadOrCreateAccount(server, payerPublicKey);

  // Determine asset
  const isNative = !assetCode || assetCode === 'XLM' || assetCode === 'native';
  let targetAsset;
  if (isNative) {
    targetAsset = Asset.native();
  } else {
    if (!assetIssuer) {
      const trustline = sourceAccount.balances.find(b => b.asset_code === assetCode);
      if (trustline && trustline.asset_issuer) {
        targetAsset = new Asset(assetCode, trustline.asset_issuer);
      } else {
        throw new Error(`No se encontró el emisor (issuer) para el token ${assetCode} en la cuenta.`);
      }
    } else {
      targetAsset = new Asset(assetCode, assetIssuer);
    }
  }

  // Check payer on-chain balance
  const payerBalanceObj = sourceAccount.balances.find(b => 
    isNative ? b.asset_type === 'native' : b.asset_code === assetCode
  );
  const payerBalance = payerBalanceObj ? parseFloat(payerBalanceObj.balance) : 0;
  if (payerBalance < numAmount) {
    throw new Error(`Saldo insuficiente en Stellar Testnet: Tienes ${payerBalance.toFixed(7)} ${assetCode} y requieres transferir ${txAmount} ${assetCode}.`);
  }

  // Check destination account
  console.log('[Stellar Testnet] Verificando cuenta receptora:', payeePublicKey);
  let payeeExists = true;
  try {
    await server.loadAccount(payeePublicKey);
  } catch (err) {
    if (err.name === 'NotFoundError' || err.status === 404 || (err.response && err.response.status === 404)) {
      payeeExists = false;
    }
  }

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

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  });

  if (!payeeExists) {
    if (isNative) {
      if (numAmount < 1.0) {
        throw new Error(`La cuenta receptora no está inicializada en Stellar y el monto (${txAmount} XLM) es inferior al mínimo requerido para activarla (1.0 XLM).`);
      }
      txBuilder.addOperation(
        Operation.createAccount({
          destination: payeePublicKey,
          startingBalance: txAmount
        })
      );
    } else {
      throw new Error(`La cuenta receptora no existe en Stellar y no puede recibir tokens ${assetCode} sin antes haber sido creada y haber establecido una línea de confianza (trustline).`);
    }
  } else {
    txBuilder.addOperation(
      Operation.payment({
        destination: payeePublicKey,
        asset: targetAsset,
        amount: txAmount
      })
    );
  }

  const transaction = txBuilder
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
    amount: txAmount,
    asset: assetCode,
    merkleRoot: merkleRootHash,
    stellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${result.hash}`
  };
}
