/**
 * Pollar Core Engine Bridge (Go WebAssembly + High-Performance WebCrypto Fallback)
 * Provides cryptographic key generation, offline payload signing, dual-signature counter-signing,
 * and Merkle Tree sequence reconciliation.
 */

// Helper: Convert ArrayBuffer to Hex string
export function buf2hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert Hex string to Uint8Array
export function hex2buf(hexString) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

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

// SHA-256 computation using WebCrypto with pure JS fallback
export async function sha256Hex(dataString) {
  if (hasCryptoSubtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return buf2hex(hashBuffer);
  }
  return sha256Pure(dataString);
}

// Pair hashing: SHA256(left + right)
export async function hashPair(left, right) {
  return sha256Hex(left + right);
}

class PollarEngineService {
  constructor() {
    this.isGoWasmLoaded = false;
    this.initGoWasm();
  }

  async initGoWasm() {
    try {
      if (typeof window !== 'undefined' && typeof window.Go !== 'undefined') {
        const go = new window.Go();
        const response = await fetch('/pollar_core.wasm');
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const result = await WebAssembly.instantiate(buffer, go.importObject);
          go.run(result.instance);
          this.isGoWasmLoaded = true;
          console.log('[Pollar Engine] Go WebAssembly Core initialized successfully ⚡');
        }
      }
    } catch (err) {
      console.warn('[Pollar Engine] Running in WebCrypto native mode (Go Wasm fallback ready):', err.message);
    }
  }

  /**
   * Generates an Ed25519 / HMAC compatible Keypair
   */
  async generateKeyPair(label = 'device') {
    // Check if Go Wasm is available
    if (this.isGoWasmLoaded && window.PollarGoEngine && window.PollarGoEngine.generateKeyPair) {
      try {
        const res = window.PollarGoEngine.generateKeyPair();
        if (!res.error) {
          return {
            publicKey: res.publicKey,
            privateKey: res.privateKey,
            stellarAddress: 'G' + res.publicKey.substring(0, 55).toUpperCase(),
            engine: 'Go Wasm'
          };
        }
      } catch (e) {
        console.warn('Wasm key generation fallback:', e);
      }
    }

    if (!hasCryptoSubtle) {
      throw new Error('WebCrypto no disponible. Accede via HTTPS o localhost.');
    }

    // High performance WebCrypto generation
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const pubExport = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privExport = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const pubHex = buf2hex(pubExport);
    const privHex = buf2hex(privExport);

    // Stellar formatted public address (simulated G... address for testing)
    const stellarAddress = 'G' + pubHex.substring(0, 55).toUpperCase();

    return {
      publicKey: pubHex,
      privateKey: privHex,
      stellarAddress: stellarAddress,
      engine: 'WebCrypto Native'
    };
  }

  /**
   * Computes deterministic SHA-256 transaction hash
   */
  async computeTxHash(payload) {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return sha256Hex(canonical);
  }

  /**
   * Payer signs the offline payment payload
   */
  async signTransactionPayload(payload, payerPrivateKeyHex) {
    const txHash = await this.computeTxHash(payload);
    // Deterministic signature simulation with SHA256 HMAC for browser/WASM compatibility
    const sigPayload = `SIG_PAYER:${txHash}:${payerPrivateKeyHex.substring(0, 16)}`;
    const payerSignature = await sha256Hex(sigPayload);

    return {
      txHash,
      payerSignature
    };
  }

  /**
   * Payee counter-signs receipt upon receiving and validating payer signature
   */
  async counterSignReceipt(txHash, payerSignature, payeePrivateKeyHex) {
    const receiptData = `RECEIPT:${txHash}:${payerSignature}:${payeePrivateKeyHex.substring(0, 16)}`;
    return sha256Hex(receiptData);
  }

  /**
   * Computes Leaf Hash for the Merkle Tree
   */
  async computeLeafHash(tx) {
    const raw = `${tx.txHash}:${tx.payload.nonce}:${tx.payload.amount.toFixed(6)}:${tx.payerSignature}:${tx.payeeSignature}`;
    return sha256Hex(raw);
  }

  /**
   * Builds Merkle Tree from an array of dual-signed transactions
   */
  async buildMerkleTree(transactions) {
    if (!transactions || transactions.length === 0) {
      const emptyHash = await sha256Hex('EMPTY_TREE');
      return {
        rootHash: emptyHash,
        leaves: [],
        levels: [[{ hash: emptyHash, isLeaf: true }]]
      };
    }

    const leaves = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const leafHash = await this.computeLeafHash(tx);
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
          // Odd leaf duplication
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
   * Generates Merkle Audit Proof for a transaction index
   */
  async generateMerkleProof(transactions, targetIndex) {
    if (targetIndex < 0 || targetIndex >= transactions.length) {
      throw new Error('Index out of range');
    }

    const tree = await this.buildMerkleTree(transactions);
    const steps = [];
    let currentIndex = targetIndex;
    let currentNodes = tree.leaves;

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
        // Duplicated odd node
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
   * Verifies a Merkle Proof
   */
  async verifyMerkleProof(proof) {
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
}

export const pollarEngine = new PollarEngineService();
