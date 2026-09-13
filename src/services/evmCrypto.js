import { ethers } from 'ethers';
import QRCode from 'qrcode';

/**
 * EVM Cryptographic and Settlement Engine for Avalanche
 * Supports Secp256k1 key generation, EIP-191 / EIP-712 offline vouchers,
 * bilateral counter-signing, Keccak-256 Merkle trees, and on-chain settlement
 * for Avalanche Fuji C-Chain, Base, Ethereum Sepolia, and EVM networks.
 */

export const EVM_NETWORKS = {
  avalancheFuji: {
    id: 'avalancheFuji',
    name: 'Avalanche Fuji Testnet',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    backupRpcUrl: 'https://avalanche-fuji-c-chain-rpc.publicnode.com',
    blockExplorer: 'https://testnet.snowtrace.io',
    faucetUrl: 'https://core.app/tools/testnet-faucet/?subnet=c&token=c',
    ethFaucetUrl: 'https://core.app/tools/testnet-faucet/?subnet=c&token=c',
    googleFaucetUrl: 'https://core.app/tools/testnet-faucet/?subnet=c&token=c',
    symbol: 'AVAX',
    nativeToken: 'AVAX',
    tokenSymbol: 'USDC',
    usdcAddress: import.meta.env?.VITE_USDC_ADDRESS || '0x5425890298aed601595a70AB815c96711a31Bc65',
    usdcDecimals: 6,
    vaultAddress: import.meta.env?.VITE_VAULT_ADDRESS || '0xbBB74646C9F5786A39E22f57d3a3e23a47d85eAa',
    forwarderAddress: import.meta.env?.VITE_FORWARDER_ADDRESS || '0x54ffCA414fA2D5bEe30088a7EC99887ea19B454f',
    relayerAddress: '0x73585ded2E86D584eaf2fcB8e62A7803910c146B'
  },
  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    backupRpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    faucetUrl: 'https://faucet.circle.com/',
    ethFaucetUrl: 'https://sepoliafaucet.com/',
    googleFaucetUrl: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
    symbol: 'ETH',
    nativeToken: 'ETH',
    tokenSymbol: 'USDC',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    usdcDecimals: 6,
    vaultAddress: '0x095Db0B333A95c7fC2cEe657857F96C394a2DC5E',
    forwarderAddress: '0xa0c88e92B8d9D49cc256a036f29F47053ad422cC',
    relayerAddress: '0x73585ded2E86D584eaf2fcB8e62A7803910c146B'
  },
  hskTestnet: {
    id: 'hskTestnet',
    name: 'HashKey Chain Testnet',
    chainId: 133,
    rpcUrl: 'https://hashkeychain-testnet.alt.technology',
    blockExplorer: 'https://hashkeychain-testnet-explorer.alt.technology',
    faucetUrl: 'https://faucet.hashkey.com',
    symbol: 'HSK',
    nativeToken: 'HSK',
    tokenSymbol: 'USDC',
    usdcAddress: '',
    usdcDecimals: 18,
    vaultAddress: '0x8901234567890123456789012345678901234567'
  },
  baseSepolia: {
    id: 'baseSepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    faucetUrl: 'https://faucet.circle.com/',
    symbol: 'ETH',
    nativeToken: 'ETH',
    tokenSymbol: 'USDC',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
    vaultAddress: '0x9012345678901234567890123456789012345678'
  }
};

/**
 * Returns dynamic Relayer API URL based on user override, VITE_BACKEND_URL, or ngrok
 */
export function getRelayerUrl() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('pollar_relayer_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
    // If VITE_BACKEND_URL is configured (like ngrok), prioritize it
    if (import.meta.env?.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '');
    }
    // If running in browser on mobile/other host via LAN
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return 'https://c2bf-132-251-224-215.ngrok-free.app';
  }
  return import.meta.env?.VITE_BACKEND_URL || 'https://c2bf-132-251-224-215.ngrok-free.app';
}

/**
 * Generates a genuine EVM Secp256k1 Keypair (0x... address + private key)
 */
export function generateRealEvmKeypair() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    publicKey: wallet.address, // Alias for compatibility with components
    privateKey: wallet.privateKey,
    secretKey: wallet.privateKey, // Alias for compatibility
    mnemonic: wallet.mnemonic?.phrase || ''
  };
}

/**
 * Creates an EVM Wallet from an existing private key
 */
export function getEvmWalletFromKey(privateKey) {
  try {
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    return new ethers.Wallet(formattedKey);
  } catch (err) {
    throw new Error(`Invalid EVM private key: ${err.message}`);
  }
}

/**
 * Computes canonical Keccak-256 hash of an offline payment payload
 */
export function computeCanonicalEvmTxHash(payload) {
  // Sort keys deterministically for canonical serialization
  const canonical = JSON.stringify({
    amount: parseFloat(payload.amount),
    asset: payload.asset || 'USDC',
    id: payload.id,
    memo: payload.memo || '',
    network: payload.network || 'EVM',
    nonce: Number(payload.nonce || 0),
    payee: payload.payee.toLowerCase(),
    payer: payload.payer.toLowerCase(),
    timestamp: Number(payload.timestamp)
  });

  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

/**
 * Signs the transaction payload using the Payer's Secp256k1 private key
 */
export async function signWithEvmKey(payload, privateKey) {
  const wallet = getEvmWalletFromKey(privateKey);
  const txHash = computeCanonicalEvmTxHash(payload);

  // Sign message hash using standard EIP-191 personal sign
  const signature = await wallet.signMessage(ethers.getBytes(txHash));
  return { txHash, signature };
}

/**
 * Verifies an EVM Secp256k1 signature against a txHash
 */
export function verifyEvmSignature(expectedAddress, txHash, signature) {
  try {
    const recovered = ethers.verifyMessage(ethers.getBytes(txHash), signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch (err) {
    console.warn('Error verifying EVM signature:', err);
    return false;
  }
}

/**
 * Payee counter-signs payment receipt to guarantee non-repudiation
 */
export async function counterSignEvmPaymentReceipt(txHash, payerSignature, payeePrivateKey) {
  const payeeWallet = getEvmWalletFromKey(payeePrivateKey);
  const receiptCommitment = `${txHash}:${payerSignature}`;
  const receiptHash = ethers.keccak256(ethers.toUtf8Bytes(receiptCommitment));

  const payeeSignature = await payeeWallet.signMessage(ethers.getBytes(receiptHash));
  return {
    receiptHash,
    payeeSignature
  };
}

/**
 * Validates the Payee's counter-signature
 */
export function verifyPayeeEvmCounterSignature(payeeAddress, txHash, payerSignature, payeeSignature) {
  try {
    const receiptCommitment = `${txHash}:${payerSignature}`;
    const receiptHash = ethers.keccak256(ethers.toUtf8Bytes(receiptCommitment));
    const recovered = ethers.verifyMessage(ethers.getBytes(receiptHash), payeeSignature);
    return recovered.toLowerCase() === payeeAddress.toLowerCase();
  } catch (err) {
    console.warn('Error verifying payee EVM counter-signature:', err);
    return false;
  }
}

/**
 * Computes the Merkle leaf hash for an offline dual-signed transaction
 */
export function computeEvmMerkleLeafHash(tx) {
  const leafData = `${tx.txHash}:${tx.payerSignature}:${tx.payeeSignature}`;
  return ethers.keccak256(ethers.toUtf8Bytes(leafData));
}

/**
 * Combines two hashes into a parent Merkle node: Keccak256(left + right)
 */
export function hashPairEvm(left, right) {
  // Canonical sort to make commutative or direct concatenation
  return ethers.keccak256(ethers.concat([ethers.getBytes(left), ethers.getBytes(right)]));
}

/**
 * Builds the canonical Merkle Tree for a batch of dual-signed transactions
 */
export function buildRealEvmMerkleTree(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      rootHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      leaves: [],
      levels: [[]],
      transactionCount: 0
    };
  }

  // 1. Compute leaves
  const leaves = transactions.map((tx, idx) => {
    const hash = computeEvmMerkleLeafHash(tx);
    return {
      index: idx,
      txId: tx.payload.id,
      hash,
      amount: tx.payload.amount,
      payer: tx.payload.payer,
      payee: tx.payload.payee
    };
  });

  const levels = [leaves];
  let currentLevel = leaves.map(l => l.hash);

  // 2. Build tree upwards
  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(hashPairEvm(currentLevel[i], currentLevel[i + 1]));
      } else {
        // Odd node: duplicate leaf
        nextLevel.push(hashPairEvm(currentLevel[i], currentLevel[i]));
      }
    }
    levels.push(nextLevel.map(h => ({ hash: h })));
    currentLevel = nextLevel;
  }

  const rootHash = currentLevel[0] || '0x0000000000000000000000000000000000000000000000000000000000000000';

  return {
    rootHash,
    leaves,
    levels,
    transactionCount: transactions.length
  };
}

/**
 * Generates an Audit Proof for a specific transaction inside the Merkle Tree
 */
export function generateEvmMerkleProof(transactions, targetIndex) {
  const tree = buildRealEvmMerkleTree(transactions);
  if (targetIndex < 0 || targetIndex >= transactions.length) {
    throw new Error('Target index out of bounds');
  }

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
 * Verifies an EVM Merkle Proof off-chain
 */
export function verifyEvmMerkleProof(proof) {
  let current = proof.leafHash;
  for (const step of proof.steps) {
    if (step.position === 'left') {
      current = hashPairEvm(step.hash, current);
    } else {
      current = hashPairEvm(current, step.hash);
    }
  }
  return current === proof.rootHash;
}

/**
 * Generates high-res pure black and white QR Code Data URL
 */
export async function generateEvmQrDataUrl(dataObject, colorDark = '#000000') {
  const jsonString = typeof dataObject === 'string' ? dataObject : JSON.stringify(dataObject);
  return QRCode.toDataURL(jsonString, {
    width: 480,
    margin: 3,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  });
}

/**
 * Queries real native balance from an EVM RPC provider (Sepolia, Base, HSK)
 */
export async function getEvmBalance(address, rpcUrl = EVM_NETWORKS.avalancheFuji.rpcUrl) {
  try {
    const formattedAddress = ethers.getAddress(address.toLowerCase());
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balanceWei = await provider.getBalance(formattedAddress);
    return parseFloat(ethers.formatEther(balanceWei));
  } catch (err) {
    console.warn(`Could not fetch live EVM balance from ${rpcUrl}:`, err.message);
    return null;
  }
}

/**
 * Fetches real on-chain balances for an EVM address:
 * - Native gas currency (Sepolia ETH / HSK)
 * - Real ERC-20 token balance (e.g. Circle Sepolia USDC)
 * - PollarOfflineVault status (locked amount, settled amount)
 */
export async function fetchRealEvmAccountBalances(address, networkId = 'avalancheFuji') {
  const network = EVM_NETWORKS[networkId] || EVM_NETWORKS.avalancheFuji;
  if (!address) {
    return {
      success: false,
      error: 'Dirección no proporcionada',
      usdcBalance: 0,
      nativeBalance: 0,
      asset: network.tokenSymbol || 'USDC',
      nativeSymbol: network.nativeToken || 'ETH'
    };
  }

  let formattedAddress;
  try {
    formattedAddress = ethers.getAddress(address.trim().toLowerCase());
  } catch (e) {
    return {
      success: false,
      error: `Dirección EVM inválida: ${address}`,
      usdcBalance: 0,
      nativeBalance: 0,
      asset: network.tokenSymbol || 'USDC',
      nativeSymbol: network.nativeToken || 'ETH'
    };
  }

  let provider;
  try {
    provider = new ethers.JsonRpcProvider(network.rpcUrl);
  } catch (err) {
    if (network.backupRpcUrl) {
      provider = new ethers.JsonRpcProvider(network.backupRpcUrl);
    } else {
      throw err;
    }
  }

  let nativeBalance = 0;
  let usdcBalance = 0;
  let vaultState = null;
  let tokenVaultState = null;

  // 1. Fetch Real Native Balance (ETH)
  try {
    const rawNative = await provider.getBalance(formattedAddress);
    nativeBalance = parseFloat(ethers.formatEther(rawNative));
  } catch (err) {
    console.warn(`[EVM] Error consultando saldo nativo en ${network.name}:`, err.message);
  }

  // 2. Fetch Real ERC-20 USDC Balance (Official Circle Sepolia Contract)
  if (network.usdcAddress && network.usdcAddress !== ethers.ZeroAddress) {
    try {
      const usdcFormatted = ethers.getAddress(network.usdcAddress.toLowerCase());
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];
      const tokenContract = new ethers.Contract(usdcFormatted, erc20Abi, provider);
      const [rawTokenBal, decimals] = await Promise.all([
        tokenContract.balanceOf(formattedAddress),
        network.usdcDecimals ? Promise.resolve(network.usdcDecimals) : tokenContract.decimals().catch(() => 6)
      ]);
      usdcBalance = parseFloat(ethers.formatUnits(rawTokenBal, decimals));
    } catch (err) {
      console.warn(`[EVM] Error consultando saldo USDC en ${network.name}:`, err.message);
    }
  }

  // 3. Fetch On-Chain Vault status if contract is deployed
  if (network.vaultAddress && network.vaultAddress !== ethers.ZeroAddress) {
    try {
      const vaultFormatted = ethers.getAddress(network.vaultAddress.toLowerCase());
      const vaultAbi = [
        'function getVault(address payer) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
        'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)'
      ];
      const vaultContract = new ethers.Contract(vaultFormatted, vaultAbi, provider);
      const res = await vaultContract.getVault(formattedAddress);
      vaultState = {
        payer: res[0],
        lockedAmount: parseFloat(ethers.formatEther(res[1])),
        totalSettled: parseFloat(ethers.formatEther(res[2])),
        availableToSpend: parseFloat(ethers.formatEther(res[3])),
        lastMerkleRoot: res[4],
        nonce: Number(res[5])
      };

      if (network.usdcAddress && network.usdcAddress !== ethers.ZeroAddress) {
        try {
          const tres = await vaultContract.getTokenVault(formattedAddress, network.usdcAddress);
          tokenVaultState = {
            payer: tres[0],
            lockedAmount: parseFloat(ethers.formatUnits(tres[1], network.usdcDecimals || 6)),
            totalSettled: parseFloat(ethers.formatUnits(tres[2], network.usdcDecimals || 6)),
            availableToSpend: parseFloat(ethers.formatUnits(tres[3], network.usdcDecimals || 6)),
            lastMerkleRoot: tres[4],
            nonce: Number(tres[5])
          };
        } catch (tErr) {}
      }
    } catch (err) {
      // Expected if no deposits have been made yet
    }
  }

  return {
    success: true,
    address: formattedAddress,
    network: network.name,
    chainId: network.chainId,
    usdcBalance,
    nativeBalance,
    asset: network.tokenSymbol || 'USDC',
    nativeSymbol: network.nativeToken || 'ETH',
    vaultState,
    tokenVaultState,
    faucetUrl: network.faucetUrl,
    ethFaucetUrl: network.ethFaucetUrl,
    usdcAddress: network.usdcAddress,
    vaultAddress: network.vaultAddress
  };
}

/**
 * Imports an EVM Account from either a private key (full access) or a public address (read-only)
 */
export function importEvmAccount(keyOrAddress) {
  const clean = keyOrAddress.trim();
  if (clean.length === 64 || (clean.startsWith('0x') && clean.length === 66)) {
    // Private Key
    const wallet = getEvmWalletFromKey(clean);
    return {
      address: wallet.address,
      publicKey: wallet.address,
      privateKey: wallet.privateKey,
      secretKey: wallet.privateKey,
      isReadOnly: false
    };
  } else if (clean.startsWith('0x') && clean.length === 42) {
    // Public Address only (Read Only)
    const formatted = ethers.getAddress(clean.toLowerCase());
    return {
      address: formatted,
      publicKey: formatted,
      privateKey: null,
      secretKey: null,
      isReadOnly: true
    };
  }
  throw new Error('Formato no válido. Ingresa una clave privada hex de 64 caracteres o una dirección 0x...');
}

/**
 * Deposits native ETH / gas token into the PollarOfflineVault smart contract
 */
export async function depositToVault({
  privateKey,
  amountEth,
  networkId = 'avalancheFuji'
}) {
  const network = EVM_NETWORKS[networkId] || EVM_NETWORKS.avalancheFuji;
  const targetVault = network.vaultAddress;

  if (!targetVault || targetVault === ethers.ZeroAddress) {
    throw new Error('No hay contrato de bóveda configurado para esta red.');
  }

  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const vaultAbi = [
    'function depositVault() external payable',
    'function getVault(address payer) external view returns (address, uint256, uint256, uint256, bytes32, uint64)'
  ];

  const vaultContract = new ethers.Contract(targetVault, vaultAbi, signer);
  const valueWei = ethers.parseEther(amountEth.toString());

  console.log(`[EVM] Depositing ${amountEth} ETH into vault ${targetVault} from ${signer.address}...`);
  const tx = await vaultContract.depositVault({ value: valueWei });
  const receipt = await tx.wait(1);

  return {
    success: true,
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    vaultAddress: targetVault,
    explorerUrl: `${network.blockExplorer}/tx/${tx.hash}`
  };
}

/**
 * Deposits ERC-20 tokens (e.g. Circle USDC, USDT) into the PollarOfflineVault smart contract
 */
export async function depositTokenToVault({
  privateKey,
  tokenAddress,
  amountTokens,
  decimals = 6,
  networkId = 'avalancheFuji'
}) {
  const network = EVM_NETWORKS[networkId] || EVM_NETWORKS.avalancheFuji;
  const targetVault = network.vaultAddress;

  if (!targetVault || targetVault === ethers.ZeroAddress) {
    throw new Error('No hay contrato de bóveda configurado para esta red.');
  }

  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const amountUnits = ethers.parseUnits(amountTokens.toString(), decimals);

  // Check user's native gas balance
  const gasBalanceWei = await provider.getBalance(signer.address).catch(() => 0n);
  const gasBalanceEth = parseFloat(ethers.formatEther(gasBalanceWei));
  const relayerUrl = getRelayerUrl();

  // 1. If user has low/zero ETH or on Sepolia, attempt 100% Gasless Deposit via Relayer (EIP-3009)
  let relayerErrMsg = null;
  if (gasBalanceEth < 0.0005) {
    try {
      console.log(`[EVM] Gas bajo (${gasBalanceEth.toFixed(6)} ETH). Intentando depósito gasless con autorización EIP-3009 en ${relayerUrl}...`);
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 7200; // 2 horas

      const domain = {
        name: network.chainId === 43113 ? 'USD Coin' : 'USDC', // Circle official domain name on Avalanche Fuji
        version: '2',
        chainId: network.chainId,
        verifyingContract: tokenAddress
      };

      const types = {
        ReceiveWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ]
      };

      const message = {
        from: signer.address,
        to: targetVault,
        value: amountUnits,
        validAfter,
        validBefore,
        nonce
      };

      const sigHex = await signer.signTypedData(domain, types, message);
      const sig = ethers.Signature.from(sigHex);

      const relayerRes = await fetch(`${relayerUrl}/api/relay/deposit-authorization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          token: tokenAddress,
          from: signer.address,
          amount: amountTokens.toString(),
          validAfter,
          validBefore,
          nonce,
          v: sig.v,
          r: sig.r,
          s: sig.s
        })
      });

      if (relayerRes.ok) {
        const data = await relayerRes.json();
        if (data.success) {
          console.log(`[EVM] ¡Depósito gasless completado por Relayer! Tx: ${data.txHash}`);
          return {
            success: true,
            hash: data.txHash,
            blockNumber: data.blockNumber,
            vaultAddress: targetVault,
            gasless: true,
            explorerUrl: data.explorerUrl
          };
        }
      }
      const errJson = await relayerRes.json().catch(() => ({}));
      relayerErrMsg = errJson.error || errJson.message || `Código HTTP ${relayerRes.status}`;
      console.warn('[EVM] Relayer gasless aviso:', relayerErrMsg);
    } catch (relayErr) {
      relayerErrMsg = relayErr.message;
      console.warn('[EVM] No se pudo procesar vía Relayer gasless:', relayErr.message);
    }

    // If account has 0 ETH, do NOT attempt direct approve/deposit because it will crash with INSUFFICIENT_FUNDS
    if (gasBalanceEth < 0.00003) {
      throw new Error(
        `No se pudo completar el depósito gasless a través del Relayer en ${relayerUrl}. ` +
        `Tu cuenta tiene 0 AVAX en Avalanche Fuji, por lo que requiere el Relayer para patrocinar el gas de la transacción. ` +
        `Asegúrate de que el backend Relayer esté activo y accesible (URL: ${relayerUrl}). ` +
        (relayerErrMsg ? `[Detalle: ${relayerErrMsg}]` : '')
      );
    }
  }

  // 2. Direct On-Chain Transaction fallback (Approve + Deposit)
  const erc20Abi = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)'
  ];
  const vaultAbi = [
    'function depositTokenVault(address token, uint256 amount) external',
    'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)'
  ];

  const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
  const vaultContract = new ethers.Contract(targetVault, vaultAbi, signer);

  // Approve vault if allowance is insufficient
  const currentAllowance = await tokenContract.allowance(signer.address, targetVault);
  if (currentAllowance < amountUnits) {
    console.log(`[EVM] Approving vault to spend ${amountTokens} tokens...`);
    const approveTx = await tokenContract.approve(targetVault, amountUnits);
    await approveTx.wait(1);
  }

  // Deposit into vault
  console.log(`[EVM] Depositing ${amountTokens} tokens into vault from ${signer.address}...`);
  const depositTx = await vaultContract.depositTokenVault(tokenAddress, amountUnits);
  const receipt = await depositTx.wait(1);

  return {
    success: true,
    hash: depositTx.hash,
    blockNumber: receipt.blockNumber,
    vaultAddress: targetVault,
    gasless: false,
    explorerUrl: `${network.blockExplorer}/tx/${depositTx.hash}`
  };
}

/**
 * Submits a batch settlement transaction to an EVM network (Sepolia, HSK, etc.)
 * Calls the PollarVault contract or broadcasts an on-chain settlement event with the Merkle root.
 */
export async function submitRealEvmBatchTransaction({
  submitterPrivateKey,
  submitterAddress,
  payerPrivateKey,
  payerAddress,
  payeeAddress,
  amount,
  merkleRootHash,
  networkId = 'avalancheFuji'
}) {
  const network = EVM_NETWORKS[networkId] || EVM_NETWORKS.avalancheFuji;
  const targetVault = network.vaultAddress;
  console.log(`[EVM] Preparing batch settlement for ${network.name}...`);

  const keyToUse = submitterPrivateKey || payerPrivateKey;
  if (!keyToUse) {
    throw new Error('Se requiere la clave privada del remitente para firmar la transacción on-chain.');
  }

  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const signer = new ethers.Wallet(keyToUse, provider);
  const broadcasterAddress = signer.address;

  // Ensure root hash has 0x prefix and is 32 bytes hex
  const formattedRoot = merkleRootHash && merkleRootHash.startsWith('0x')
    ? merkleRootHash
    : `0x${merkleRootHash || '0000000000000000000000000000000000000000000000000000000000000000'}`;

  // 1. Pre-flight Gas Verification
  const gasBalance = await provider.getBalance(broadcasterAddress);
  const gasBalanceEth = parseFloat(ethers.formatEther(gasBalance));
  console.log(`[EVM] Submitter ${broadcasterAddress} gas balance: ${gasBalanceEth.toFixed(6)} ${network.symbol || 'AVAX'}`);

  const minGasRequired = ethers.parseEther('0.00003');
  if (gasBalance < minGasRequired) {
    // Attempt Gasless Settlement via Relayer
    try {
      console.log(`[EVM] Submitter no tiene suficiente gas (${gasBalanceEth.toFixed(6)} ${network.symbol || 'AVAX'}). Transmitiendo liquidación gasless mediante Relayer...`);
      const relayerUrl = getRelayerUrl();
      const relayerRes = await fetch(`${relayerUrl}/api/relay/settle-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          payer: payerAddress,
          payee: payeeAddress,
          token: network.usdcAddress,
          amount: amount.toString(),
          merkleRoot: formattedRoot,
          nonce: Math.floor(Date.now() / 1000)
        })
      });

      if (relayerRes.ok) {
        const data = await relayerRes.json();
        if (data.success) {
          console.log(`[EVM] ¡Liquidación de lote completada exitosamente por Relayer! Tx: ${data.txHash}`);
          return {
            success: true,
            hash: data.txHash,
            blockNumber: data.blockNumber,
            merkleRoot: formattedRoot,
            vaultAddress: targetVault,
            anchorRecipient: payeeAddress,
            network: network.name,
            relayed: true,
            usedVaultContract: data.usedVault,
            explorerUrl: data.explorerUrl
          };
        }
      }
    } catch (relayErr) {
      console.warn('[EVM] Relayer no respondió para liquidación:', relayErr.message);
    }

    const err = new Error(
      `Gas insuficiente en la cuenta transmisora (${broadcasterAddress.slice(0, 6)}...${broadcasterAddress.slice(-4)}). Saldo: ${gasBalanceEth.toFixed(6)} AVAX. Para registrar este lote en la red Avalanche Fuji Testnet requieres una fracción de AVAX (ej: 0.005 AVAX) para cubrir el gas de la red.`
    );
    err.code = 'INSUFFICIENT_GAS';
    err.submitterAddress = broadcasterAddress;
    err.gasBalance = gasBalanceEth;
    err.faucetUrl = network.ethFaucetUrl || 'https://core.app/tools/testnet-faucet/?subnet=c&token=c';
    err.googleFaucetUrl = network.googleFaucetUrl || 'https://core.app/tools/testnet-faucet/?subnet=c&token=c';
    throw err;
  }

  const vaultAbi = [
    'function settleBatch(address payer, address payable payee, uint256 settleAmount, bytes32 merkleRoot, uint64 batchNonce) external',
    'function settleTokenBatch(address payer, address payee, address token, uint256 settleAmount, bytes32 merkleRoot, uint64 batchNonce) external',
    'function depositVault() external payable',
    'function depositTokenVault(address token, uint256 amount) external',
    'function getVault(address payer) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
    'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)'
  ];

  let tx;
  let usedVaultContract = false;

  // 2. Determine Settlement Mechanism: Vault Contract Escrow vs Direct On-Chain Anchor
  if (targetVault && targetVault !== ethers.ZeroAddress) {
    const vaultContract = new ethers.Contract(targetVault, vaultAbi, signer);
    const nonceVal = BigInt(Math.floor(Date.now() / 1000));

    // A. Check ERC-20 Token Vault first (USDC / USDT)
    if (network.usdcAddress && network.usdcAddress !== ethers.ZeroAddress) {
      try {
        const tv = await vaultContract.getTokenVault(payerAddress, network.usdcAddress);
        const tokenLocked = BigInt(tv[1] || 0n);
        const tokenSettled = BigInt(tv[2] || 0n);
        const tokenAvail = tokenLocked > tokenSettled ? tokenLocked - tokenSettled : 0n;
        const requestedUnits = ethers.parseUnits(Math.min(1000, parseFloat(amount) || 1.0).toFixed(2), network.usdcDecimals || 6);
        const settleTokenUnits = tokenAvail >= requestedUnits ? requestedUnits : tokenAvail;

        console.log(`[EVM] Token Vault check for payer ${payerAddress}: locked=${ethers.formatUnits(tokenLocked, network.usdcDecimals || 6)}, available=${ethers.formatUnits(tokenAvail, network.usdcDecimals || 6)}, requested=${ethers.formatUnits(requestedUnits, network.usdcDecimals || 6)}`);

        if (tv[0]?.toLowerCase() === payerAddress?.toLowerCase() && tokenAvail > 0n && settleTokenUnits > 0n) {
          console.log(`[EVM] Calling settleTokenBatch on smart contract for ${ethers.formatUnits(settleTokenUnits, network.usdcDecimals || 6)} tokens...`);
          tx = await vaultContract.settleTokenBatch(
            payerAddress,
            payeeAddress,
            network.usdcAddress,
            settleTokenUnits,
            formattedRoot,
            nonceVal
          );
          usedVaultContract = true;
        } else if (tv[0]?.toLowerCase() === payerAddress?.toLowerCase() && tokenLocked > 0n && tokenAvail === 0n && tokenSettled > 0n) {
          console.log(`[EVM] Vault tokens for ${payerAddress} were already settled on-chain. Marking batch as confirmed.`);
          return {
            success: true,
            hash: tv[4] && tv[4] !== ethers.ZeroHash ? tv[4] : '0x' + '0'.repeat(64),
            blockNumber: 'Confirmado On-Chain',
            merkleRoot: formattedRoot,
            vaultAddress: targetVault,
            anchorRecipient: payeeAddress,
            network: network.name,
            explorerUrl: `${network.blockExplorer}/address/${targetVault}`
          };
        }
      } catch (tokenCheckErr) {
        console.warn('[EVM] Token vault check error:', tokenCheckErr.message);
      }
    }

    // B. Check Native ETH Vault if not settled with tokens
    if (!tx) {
      try {
        const v = await vaultContract.getVault(payerAddress);
        const lockedAmount = BigInt(v[1] || 0n);
        const totalSettled = BigInt(v[2] || 0n);
        const available = lockedAmount > totalSettled ? lockedAmount - totalSettled : 0n;
        const settleAmountWei = available > 0n ? (available > ethers.parseEther('0.001') ? ethers.parseEther('0.001') : available) : 0n;

        if (v[0]?.toLowerCase() === payerAddress?.toLowerCase() && available > 0n) {
          console.log(`[EVM] Vault initialized for payer with ${ethers.formatEther(available)} ETH available. Calling settleBatch...`);
          tx = await vaultContract.settleBatch(
            payerAddress,
            payeeAddress,
            settleAmountWei,
            formattedRoot,
            nonceVal
          );
          usedVaultContract = true;
        } else {
          console.log(`[EVM] Vault not pre-funded for payer (${ethers.formatEther(available)} ETH available). Proceeding with on-chain cryptographic settlement anchor.`);
        }
      } catch (vaultCheckErr) {
        console.warn('[EVM] Vault verification notice:', vaultCheckErr.message);
      }
    }
  }

  // 3. Direct On-Chain Settlement Anchor (if vault escrow wasn't funded)
  // Sends to payeeAddress (an EOA, which permanently anchors the Merkle root in tx input data without reverting)
  if (!tx) {
    const anchorRecipient = (payeeAddress && payeeAddress !== ethers.ZeroAddress) ? payeeAddress : broadcasterAddress;
    const payloadData = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify({
      protocol: 'POLLAR_OFFLINE_SETTLEMENT_V1',
      vault: targetVault || null,
      payer: payerAddress,
      payee: payeeAddress,
      merkleRoot: formattedRoot,
      amount: amount.toString(),
      timestamp: Date.now()
    })));

    console.log(`[EVM] Broadcasting on-chain settlement anchor transaction to ${anchorRecipient}...`);
    tx = await signer.sendTransaction({
      to: anchorRecipient,
      value: 0n,
      data: payloadData
    });
  }

  console.log(`[EVM] Settlement transaction submitted to ${network.name}: ${tx.hash}`);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`La transacción on-chain (${tx.hash}) fue revertida o no confirmada por la red.`);
  }

  console.log(`[EVM] Transaction confirmed in block #${receipt.blockNumber}!`);

  return {
    success: true,
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    merkleRoot: formattedRoot,
    vaultAddress: usedVaultContract ? targetVault : null,
    anchorRecipient: payeeAddress,
    network: network.name,
    explorerUrl: `${network.blockExplorer}/tx/${tx.hash}`
  };
}
