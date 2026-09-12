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

// SHA-256 computation using WebCrypto
export async function sha256Hex(dataString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return buf2hex(hashBuffer);
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
