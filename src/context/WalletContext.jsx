import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  generateRealStellarKeypair,
  computeCanonicalTxHash,
  signWithStellarKey,
  verifyStellarSignature,
  counterSignPaymentReceipt,
  verifyPayeeCounterSignature,
  buildRealMerkleTree,
  computeMerkleLeafHash
} from '../services/stellarCrypto';
import {
  generateRealEvmKeypair,
  computeCanonicalEvmTxHash,
  signWithEvmKey,
  verifyEvmSignature,
  counterSignEvmPaymentReceipt,
  verifyPayeeEvmCounterSignature,
  buildRealEvmMerkleTree,
  computeEvmMerkleLeafHash,
  submitRealEvmBatchTransaction,
  EVM_NETWORKS,
  getEvmBalance,
  fetchRealEvmAccountBalances,
  importEvmAccount
} from '../services/evmCrypto';
import confetti from 'canvas-confetti';

const WalletContext = createContext();

const STORAGE_KEY = 'pollar_offline_wallet_v3_multichain';
const AUTH_STORAGE_KEY = 'pollar_auth_user';

export function WalletProvider({ children }) {
  // Active Network: 'evm' (Default) | 'stellar'
  const [activeNetwork, setActiveNetwork] = useState(() => {
    try {
      const savedNet = localStorage.getItem('pollar_active_network');
      return savedNet || 'evm';
    } catch (e) {
      return 'evm';
    }
  });

  // Active EVM Chain: 'sepolia' (Default) | 'hskTestnet' | 'baseSepolia'
  const [activeEvmChain, setActiveEvmChain] = useState('sepolia');

  // Device Selection: 'device_a' (Payer) | 'device_b' (Payee/Merchant) | 'dual_sim' (Split View)
  const [activeDevice, setActiveDevice] = useState('device_a');
  
  // Real or Simulated Network Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Authentication & User Session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedUser) return JSON.parse(savedUser);
    } catch (e) {
      console.warn('Error reading auth state:', e);
    }
    return null;
  });

  // --- EVM Accounts ---
  const [evmDeviceA, setEvmDeviceA] = useState(() => {
    const keys = generateRealEvmKeypair();
    return {
      name: 'Billetera Principal EVM (Pagador A)',
      publicKey: keys.address,
      secretKey: keys.privateKey,
      address: keys.address,
      privateKey: keys.privateKey,
      asset: 'USDC',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      nativeBalance: 0.0,
      currentNonce: 0,
      network: 'evm'
    };
  });

  const [evmDeviceB, setEvmDeviceB] = useState(() => {
    const keys = generateRealEvmKeypair();
    return {
      name: 'Terminal Comercio EVM (Cobrador B)',
      publicKey: keys.address,
      secretKey: keys.privateKey,
      address: keys.address,
      privateKey: keys.privateKey,
      asset: 'USDC',
      mainBalance: 0.0,
      receivedOffline: 0.0,
      nativeBalance: 0.0,
      network: 'evm'
    };
  });

  // --- Stellar Accounts ---
  const [stellarDeviceA, setStellarDeviceA] = useState(() => {
    const keys = generateRealStellarKeypair();
    return {
      name: 'Billetera Principal (Pagador A)',
      publicKey: keys.publicKey,
      secretKey: keys.secretKey,
      asset: 'USDT',
      mainBalance: 100.0,
      derivedOffline: 10.0,
      spentOffline: 0.0,
      currentNonce: 0,
      network: 'stellar'
    };
  });

  const [stellarDeviceB, setStellarDeviceB] = useState(() => {
    const keys = generateRealStellarKeypair();
    return {
      name: 'Terminal Comercio (Cobrador B)',
      publicKey: keys.publicKey,
      secretKey: keys.secretKey,
      asset: 'USDT',
      mainBalance: 25.0,
      receivedOffline: 0.0,
      network: 'stellar'
    };
  });

  // Offline Transactions and Merkle Tree State
  const [transactions, setTransactions] = useState([]);
  const [merkleTree, setMerkleTree] = useState({
    rootHash: '',
    leaves: [],
    levels: [],
    transactionCount: 0
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Active Device Pointers based on activeNetwork
  const isEvm = activeNetwork === 'evm';
  const deviceA = isEvm ? evmDeviceA : stellarDeviceA;
  const deviceB = isEvm ? evmDeviceB : stellarDeviceB;

  const setDeviceA = (updater) => {
    if (isEvm) {
      setEvmDeviceA(updater);
    } else {
      setStellarDeviceA(updater);
    }
  };

  const setDeviceB = (updater) => {
    if (isEvm) {
      setEvmDeviceB(updater);
    } else {
      setStellarDeviceB(updater);
    }
  };

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.evmDeviceA) {
          const devA = { ...parsed.evmDeviceA };
          // If stored state has mocked values, reset to real zero
          if (devA.asset?.includes('USDT') || devA.mainBalance === 250) {
            devA.asset = 'USDC';
            devA.mainBalance = 0.0;
            devA.derivedOffline = 0.0;
            devA.spentOffline = 0.0;
            devA.nativeBalance = 0.0;
          }
          setEvmDeviceA(devA);
        }
        if (parsed.evmDeviceB) {
          const devB = { ...parsed.evmDeviceB };
          if (devB.asset?.includes('USDT') || devB.mainBalance === 40) {
            devB.asset = 'USDC';
            devB.mainBalance = 0.0;
            devB.receivedOffline = 0.0;
            devB.nativeBalance = 0.0;
          }
          setEvmDeviceB(devB);
        }
        if (parsed.stellarDeviceA) setStellarDeviceA(parsed.stellarDeviceA);
        if (parsed.stellarDeviceB) setStellarDeviceB(parsed.stellarDeviceB);
        if (parsed.activeNetwork) setActiveNetwork(parsed.activeNetwork);
        if (parsed.activeEvmChain) setActiveEvmChain(parsed.activeEvmChain);
        if (parsed.transactions) setTransactions(parsed.transactions);
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save to localStorage
  useEffect(() => {
    const state = {
      activeNetwork,
      activeEvmChain,
      evmDeviceA,
      evmDeviceB,
      stellarDeviceA,
      stellarDeviceB,
      transactions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem('pollar_active_network', activeNetwork);
  }, [activeNetwork, activeEvmChain, evmDeviceA, evmDeviceB, stellarDeviceA, stellarDeviceB, transactions]);

  // Recalculate Merkle Tree whenever transactions or activeNetwork change
  useEffect(() => {
    if (isEvm) {
      const tree = buildRealEvmMerkleTree(transactions);
      setMerkleTree(tree);
    } else {
      buildRealMerkleTree(transactions).then(tree => {
        setMerkleTree(tree);
      });
    }
  }, [transactions, activeNetwork]);

  // Effective online state
  const effectiveOnline = isOnline && !isSimulatingOffline;

  // Network Switcher
  const switchNetwork = (network) => {
    if (network === 'evm' || network === 'stellar') {
      setActiveNetwork(network);
    }
  };

  const switchEvmChain = (chainIdOrName) => {
    if (EVM_NETWORKS[chainIdOrName]) {
      setActiveEvmChain(chainIdOrName);
    }
  };

  // Refresh balance (EVM real on-chain query or Stellar)
  const refreshOnlineBalance = async (targetPubKey = null) => {
    setIsRefreshingBalance(true);

    try {
      if (isEvm) {
        const addressA = (evmDeviceA.address || evmDeviceA.publicKey || '').trim();
        const addressB = (evmDeviceB.address || evmDeviceB.publicKey || '').trim();

        const [resA, resB] = await Promise.all([
          addressA ? fetchRealEvmAccountBalances(addressA, activeEvmChain) : Promise.resolve(null),
          addressB ? fetchRealEvmAccountBalances(addressB, activeEvmChain) : Promise.resolve(null)
        ]);

        if (resA && resA.success) {
          setEvmDeviceA(prev => ({
            ...prev,
            mainBalance: resA.usdcBalance,
            nativeBalance: resA.nativeBalance,
            asset: 'USDC',
            symbol: resA.nativeSymbol,
            vaultState: resA.vaultState
          }));
        }

        if (resB && resB.success) {
          setEvmDeviceB(prev => ({
            ...prev,
            mainBalance: resB.usdcBalance,
            nativeBalance: resB.nativeBalance,
            asset: 'USDC',
            symbol: resB.nativeSymbol
          }));
        }

        setIsRefreshingBalance(false);
        return resA;
      } else {
        const pubKey = targetPubKey || deviceA.publicKey;
        const { fetchRealAccountBalances } = await import('../services/stellarCrypto');
        const horizonUrl = import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org';
        const res = await fetchRealAccountBalances(pubKey, horizonUrl);
        if (res.success) {
          setDeviceA(prev => ({
            ...prev,
            mainBalance: res.primaryBalance,
            asset: res.primaryAsset,
            allBalances: res.balances
          }));
        }
        setIsRefreshingBalance(false);
        return res;
      }
    } catch (err) {
      console.warn('Error fetching real on-chain balance:', err);
      setIsRefreshingBalance(false);
    }
  };

  // Automatically query real on-chain balances when online or changing network/chain
  useEffect(() => {
    if (effectiveOnline) {
      refreshOnlineBalance();
    }
  }, [activeNetwork, activeEvmChain, effectiveOnline]);

  // Link / Import custom account (EVM 0x... / Private Key or Stellar Secret/Public Key)
  const linkCustomAccount = async (inputKey) => {
    const clean = inputKey.trim();
    if (clean.startsWith('0x') || clean.length === 64 || clean.length === 66) {
      const imported = importEvmAccount(clean);
      setEvmDeviceA(prev => ({
        ...prev,
        publicKey: imported.publicKey,
        address: imported.address,
        secretKey: imported.secretKey || prev.secretKey,
        privateKey: imported.privateKey || prev.privateKey,
        isReadOnly: imported.isReadOnly
      }));
      const balRes = await fetchRealEvmAccountBalances(imported.address, activeEvmChain);
      if (balRes.success) {
        setEvmDeviceA(prev => ({
          ...prev,
          mainBalance: balRes.usdcBalance,
          nativeBalance: balRes.nativeBalance,
          asset: 'USDC'
        }));
      }
      return {
        publicKey: imported.publicKey,
        balance: balRes?.usdcBalance || 0,
        nativeBalance: balRes?.nativeBalance || 0,
        asset: 'USDC'
      };
    } else {
      const { importStellarAccount } = await import('../services/stellarCrypto');
      const imported = importStellarAccount(clean);
      setStellarDeviceA(prev => ({
        ...prev,
        publicKey: imported.publicKey,
        secretKey: imported.secretKey || prev.secretKey,
        isReadOnly: imported.isReadOnly
      }));
      const balRes = await refreshOnlineBalance(imported.publicKey);
      return {
        publicKey: imported.publicKey,
        balance: balRes?.primaryBalance || 0,
        asset: balRes?.primaryAsset || 'XLM'
      };
    }
  };

  // 1. Allocate funds to Offline Vault
  const allocateOfflineFunds = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('Ingresa un monto válido mayor a 0');
    
    const availableInMain = deviceA.mainBalance - deviceA.derivedOffline;
    if (num > availableInMain) {
      throw new Error(`Saldo insuficiente en Billetera Principal. Disponible: ${availableInMain.toFixed(2)} ${deviceA.asset}`);
    }

    setDeviceA(prev => ({
      ...prev,
      derivedOffline: prev.derivedOffline + num
    }));
  };

  // 2. Return unspent funds to Main Wallet
  const returnFundsToMain = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('Ingresa un monto válido mayor a 0');

    const unspentOffline = deviceA.derivedOffline - deviceA.spentOffline;
    if (num > unspentOffline) {
      throw new Error(`No puedes devolver más del saldo offline libre: ${unspentOffline.toFixed(2)} ${deviceA.asset}`);
    }

    setDeviceA(prev => ({
      ...prev,
      derivedOffline: prev.derivedOffline - num
    }));
  };

  // 3. Create & Sign Offline Payment (Device A / Payer)
  const createOfflinePayment = async (payeeAddress, amount, memo = 'Pago Offline Pollar') => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('El monto debe ser mayor a 0');

    const availableOffline = deviceA.derivedOffline - deviceA.spentOffline;
    if (num > availableOffline) {
      throw new Error(`Límite Offline excedido: Tienes ${availableOffline.toFixed(2)} ${deviceA.asset} disponibles offline e intentas pagar ${num.toFixed(2)} ${deviceA.asset}. Transfiere más saldo a tu bóveda.`);
    }

    const nextNonce = deviceA.currentNonce + 1;
    const payload = {
      id: `TX-OFFLINE-${nextNonce}-${Date.now().toString(36).toUpperCase()}`,
      payer: deviceA.publicKey,
      payee: payeeAddress || deviceB.publicKey,
      amount: num,
      asset: deviceA.asset,
      network: isEvm ? 'EVM' : 'Stellar',
      nonce: nextNonce,
      memo: memo,
      timestamp: Date.now(),
    };

    let txHash, payerSignature;

    if (isEvm) {
      // Sign with Secp256k1 (EVM)
      const res = await signWithEvmKey(payload, deviceA.secretKey);
      txHash = res.txHash;
      payerSignature = res.signature;
    } else {
      // Sign with Ed25519 (Stellar)
      txHash = await computeCanonicalTxHash(payload);
      payerSignature = await signWithStellarKey(deviceA.secretKey, txHash);
    }

    const pendingTx = {
      payload,
      txHash,
      payerSignature,
      payeeSignature: null,
      status: 'PENDING_COUNTER_SIGN',
      network: isEvm ? 'EVM' : 'Stellar',
      createdAt: Date.now(),
    };

    return pendingTx;
  };

  // 4. Payee processes, validates, counter-signs, and stores in Merkle Tree
  const receiveAndCounterSign = async (pendingTx, submitterDevice = 'device_b') => {
    if (!pendingTx || !pendingTx.txHash || !pendingTx.payerSignature) {
      throw new Error('Payload de pago inválido o corrupto');
    }

    let payeeSignature, leafHash;

    if (isEvm || pendingTx.network === 'EVM') {
      // 1. Verify TxHash integrity
      const computedHash = computeCanonicalEvmTxHash(pendingTx.payload);
      if (computedHash !== pendingTx.txHash) {
        throw new Error('Hash mismatch: La transacción fue alterada');
      }

      // 2. Verify Payer EVM Secp256k1 Signature
      const isPayerValid = verifyEvmSignature(
        pendingTx.payload.payer,
        pendingTx.txHash,
        pendingTx.payerSignature
      );
      if (!isPayerValid) {
        throw new Error('Firma Secp256k1 del pagador inválida o no coincide');
      }

      // 3. Payee creates EVM Counter-Signature
      const counterRes = await counterSignEvmPaymentReceipt(
        pendingTx.txHash,
        pendingTx.payerSignature,
        deviceB.secretKey
      );
      payeeSignature = counterRes.payeeSignature;

      // 4. Compute EVM Merkle Leaf Hash
      leafHash = computeEvmMerkleLeafHash({
        txHash: pendingTx.txHash,
        payerSignature: pendingTx.payerSignature,
        payeeSignature
      });
    } else {
      // 1. Verify TxHash integrity (Stellar)
      const computedHash = await computeCanonicalTxHash(pendingTx.payload);
      if (computedHash !== pendingTx.txHash) {
        throw new Error('Hash mismatch: La transacción fue alterada');
      }

      // 2. Verify Payer Ed25519 Signature
      const isPayerValid = verifyStellarSignature(
        pendingTx.payload.payer,
        pendingTx.txHash,
        pendingTx.payerSignature
      );
      if (!isPayerValid) {
        throw new Error('Firma Ed25519 del pagador inválida o no coincide');
      }

      // 3. Payee creates Stellar Ed25519 Counter-Signature
      payeeSignature = await counterSignPaymentReceipt(
        deviceB.secretKey,
        pendingTx.txHash,
        pendingTx.payerSignature
      );

      // 4. Compute Stellar Merkle Leaf Hash
      leafHash = await computeMerkleLeafHash({
        ...pendingTx,
        payeeSignature
      });
    }

    const finalizedTx = {
      ...pendingTx,
      payeeSignature,
      merkleLeafHash: leafHash,
      status: 'GUARDADO_LOCAL_OFFLINE',
      counterSignedAt: Date.now(),
    };

    // Update balances
    setDeviceA(prev => ({
      ...prev,
      spentOffline: prev.spentOffline + pendingTx.payload.amount,
      currentNonce: Math.max(prev.currentNonce, pendingTx.payload.nonce),
    }));

    setDeviceB(prev => ({
      ...prev,
      receivedOffline: prev.receivedOffline + pendingTx.payload.amount,
    }));

    setTransactions(prev => [finalizedTx, ...prev]);

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {}

    return finalizedTx;
  };

  // 5. On-Chain Batch Sync (routes to EVM Sepolia or Stellar Horizon)
  const syncToNetwork = async (triggerSource = 'USER_MANUAL') => {
    setIsSyncing(true);

    try {
      const pendingSyncTxs = transactions.filter(tx => tx.status !== 'SYNCED_ONCHAIN');
      
      if (pendingSyncTxs.length === 0) {
        setIsSyncing(false);
        return { message: 'Todas las transacciones ya están confirmadas on-chain.' };
      }

      const totalSyncedAmount = pendingSyncTxs.reduce((acc, tx) => acc + tx.payload.amount, 0);
      const currentSubmitter = activeDevice === 'device_b' ? 'Dispositivo B (Comercio)' : 'Dispositivo A (Pagador)';

      let syncResult;

      if (isEvm) {
        // Broadcast to EVM (Sepolia / HSK / Base)
        const evmRes = await submitRealEvmBatchTransaction({
          payerPrivateKey: deviceA.secretKey,
          payerAddress: deviceA.publicKey,
          payeeAddress: deviceB.publicKey,
          amount: totalSyncedAmount,
          merkleRootHash: merkleTree.rootHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
          networkId: activeEvmChain
        });

        setTransactions(prev => prev.map(tx => {
          if (tx.status !== 'SYNCED_ONCHAIN') {
            return {
              ...tx,
              status: 'SYNCED_ONCHAIN',
              syncedBy: currentSubmitter,
              syncedAt: Date.now(),
              evmTxHash: evmRes.hash,
              blockNumber: evmRes.blockNumber,
              network: evmRes.network,
              explorerUrl: evmRes.explorerUrl
            };
          }
          return tx;
        }));

        syncResult = {
          success: true,
          network: evmRes.network,
          batchMerkleRoot: merkleTree.rootHash,
          txHash: evmRes.hash,
          blockNumber: evmRes.blockNumber,
          syncedCount: pendingSyncTxs.length,
          totalAmount: totalSyncedAmount,
          syncedBy: currentSubmitter,
          timestamp: Date.now(),
          explorerUrl: evmRes.explorerUrl,
          simulatedNotice: evmRes.simulatedNotice
        };
      } else {
        // Broadcast to Stellar Horizon
        const { submitRealStellarBatchTransaction } = await import('../services/stellarCrypto');
        const realTxResult = await submitRealStellarBatchTransaction({
          payerSecretKey: deviceA.secretKey,
          payerPublicKey: deviceA.publicKey,
          payeePublicKey: deviceB.publicKey,
          amount: totalSyncedAmount > 0 ? totalSyncedAmount : 1.0,
          merkleRootHash: merkleTree.rootHash || '0000000000000000000000000000000000000000000000000000000000000000',
          horizonUrl: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org'
        });

        setTransactions(prev => prev.map(tx => {
          if (tx.status !== 'SYNCED_ONCHAIN') {
            return {
              ...tx,
              status: 'SYNCED_ONCHAIN',
              syncedBy: currentSubmitter,
              syncedAt: Date.now(),
              stellarTxHash: realTxResult.hash,
              stellarLedger: realTxResult.ledger,
              explorerUrl: `https://stellar.expert/explorer/testnet/tx/${realTxResult.hash}`
            };
          }
          return tx;
        }));

        syncResult = {
          success: true,
          network: 'Stellar Testnet',
          batchMerkleRoot: merkleTree.rootHash,
          txHash: realTxResult.hash,
          stellarTxHash: realTxResult.hash,
          stellarLedger: realTxResult.ledger,
          syncedCount: pendingSyncTxs.length,
          totalAmount: totalSyncedAmount,
          syncedBy: currentSubmitter,
          timestamp: Date.now(),
          explorerUrl: `https://stellar.expert/explorer/testnet/tx/${realTxResult.hash}`
        };
      }

      // Update balances after settlement
      setDeviceA(prev => ({
        ...prev,
        mainBalance: Math.max(0, prev.mainBalance - totalSyncedAmount),
        derivedOffline: Math.max(0, prev.derivedOffline - totalSyncedAmount),
        spentOffline: Math.max(0, prev.spentOffline - totalSyncedAmount),
      }));

      setDeviceB(prev => ({
        ...prev,
        mainBalance: prev.mainBalance + totalSyncedAmount,
        receivedOffline: Math.max(0, prev.receivedOffline - totalSyncedAmount),
      }));

      setLastSyncResult(syncResult);
      setIsSyncing(false);
      return syncResult;
    } catch (err) {
      setIsSyncing(false);
      throw err;
    }
  };

  // Backwards compatible alias for Stellar sync
  const syncToStellarNetwork = syncToNetwork;

  // Faucet funding (Sepolia / Stellar Friendbot)
  const requestFriendbotFunding = async (pubKey = null) => {
    if (isEvm) {
      // Query live on-chain balances for EVM
      await refreshOnlineBalance();
      return {
        success: true,
        isEvm: true,
        network: EVM_NETWORKS[activeEvmChain]?.name || 'Ethereum Sepolia',
        faucetUrl: EVM_NETWORKS[activeEvmChain]?.faucetUrl || 'https://faucet.circle.com/',
        ethFaucetUrl: EVM_NETWORKS[activeEvmChain]?.ethFaucetUrl || 'https://sepoliafaucet.com/'
      };
    } else {
      const target = pubKey || deviceA.publicKey;
      const { fundWithFriendbot } = await import('../services/stellarCrypto');
      await fundWithFriendbot(target);
      await new Promise(r => setTimeout(r, 2000));
      await refreshOnlineBalance(target);

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.55 },
          colors: ['#0062FF', '#10B981', '#F59E0B', '#60A5FA', '#34D399']
        });
      } catch (e) {}

      return { success: true };
    }
  };

  // Authentication Handlers
  const loginWithEmail = (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      provider: 'email',
      role: 'device_a',
      connectedAt: Date.now()
    };
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  };

  const loginWithGoogle = (customEmail = null) => {
    const email = customEmail || 'usuario.pollar@gmail.com';
    const user = {
      id: 'usr_g_' + Math.random().toString(36).substring(2, 9),
      email,
      name: customEmail ? customEmail.split('@')[0] : 'Demo Google User',
      provider: 'google',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
      role: 'device_a',
      connectedAt: Date.now()
    };
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  };

  const loginWithWallet = async (inputKey = null) => {
    let importedPub = deviceA.publicKey;
    if (inputKey && inputKey.trim()) {
      const res = await linkCustomAccount(inputKey.trim());
      importedPub = res.publicKey;
    }
    const user = {
      id: 'usr_w_' + importedPub.slice(0, 8),
      email: null,
      name: `${isEvm ? 'EVM' : 'Stellar'} (${importedPub.slice(0, 4)}...${importedPub.slice(-4)})`,
      provider: 'wallet',
      publicKey: importedPub,
      role: 'device_a',
      connectedAt: Date.now()
    };
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  };

  const loginAsPreset = (presetType) => {
    if (presetType === 'pagador') {
      setActiveDevice('device_a');
      const user = {
        id: 'usr_payer',
        email: 'demo.pagador@pollar.io',
        name: 'Pagador Demo',
        provider: 'preset',
        role: 'device_a',
        publicKey: deviceA.publicKey,
        connectedAt: Date.now()
      };
      setCurrentUser(user);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return user;
    } else if (presetType === 'comercio') {
      setActiveDevice('device_b');
      const user = {
        id: 'usr_merchant',
        email: 'pos.tienda@pollar.io',
        name: 'Comercio POS Demo',
        provider: 'preset',
        role: 'device_b',
        publicKey: deviceB.publicKey,
        connectedAt: Date.now()
      };
      setCurrentUser(user);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return user;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Reset demo state
  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);

    const evmA = generateRealEvmKeypair();
    const evmB = generateRealEvmKeypair();
    const stA = generateRealStellarKeypair();
    const stB = generateRealStellarKeypair();

    setEvmDeviceA({
      name: 'Billetera Principal EVM (Pagador A)',
      publicKey: evmA.address,
      secretKey: evmA.privateKey,
      address: evmA.address,
      privateKey: evmA.privateKey,
      asset: 'USDC',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      nativeBalance: 0.0,
      currentNonce: 0,
      network: 'evm'
    });
    setEvmDeviceB({
      name: 'Terminal Comercio EVM (Cobrador B)',
      publicKey: evmB.address,
      secretKey: evmB.privateKey,
      address: evmB.address,
      privateKey: evmB.privateKey,
      asset: 'USDC',
      mainBalance: 0.0,
      receivedOffline: 0.0,
      nativeBalance: 0.0,
      network: 'evm'
    });

    setStellarDeviceA({
      name: 'Billetera Principal (Pagador A)',
      publicKey: stA.publicKey,
      secretKey: stA.secretKey,
      asset: 'USDT',
      mainBalance: 100.0,
      derivedOffline: 10.0,
      spentOffline: 0.0,
      currentNonce: 0,
      network: 'stellar'
    });
    setStellarDeviceB({
      name: 'Terminal Comercio (Cobrador B)',
      publicKey: stB.publicKey,
      secretKey: stB.secretKey,
      asset: 'USDT',
      mainBalance: 25.0,
      receivedOffline: 0.0,
      network: 'stellar'
    });

    setTransactions([]);
    setLastSyncResult(null);
  };

  return (
    <WalletContext.Provider value={{
      currentUser,
      loginWithEmail,
      loginWithGoogle,
      loginWithWallet,
      loginAsPreset,
      logout,
      activeDevice,
      setActiveDevice,
      activeNetwork,
      switchNetwork,
      activeEvmChain,
      switchEvmChain,
      isEvm,
      isOnline: effectiveOnline,
      isSimulatingOffline,
      setIsSimulatingOffline,
      autoSyncEnabled,
      setAutoSyncEnabled,
      deviceA,
      deviceB,
      transactions,
      merkleTree,
      isSyncing,
      lastSyncResult,
      allocateOfflineFunds,
      returnFundsToMain,
      createOfflinePayment,
      receiveAndCounterSign,
      syncToNetwork,
      syncToStellarNetwork,
      resetDemoData,
      linkCustomAccount,
      refreshOnlineBalance,
      requestFriendbotFunding,
      isRefreshingBalance
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
