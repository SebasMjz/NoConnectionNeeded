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
import confetti from 'canvas-confetti';

const WalletContext = createContext();

const STORAGE_KEY = 'pollar_offline_wallet_v2_real';

export function WalletProvider({ children }) {
  // Device Selection: 'device_a' (Payer) | 'device_b' (Payee/Merchant) | 'dual_sim' (Split View)
  const [activeDevice, setActiveDevice] = useState('device_a');
  
  // Real or Simulated Network Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false); // Purely local by default

  // Device A (Payer) Wallet State with genuine Stellar Ed25519 Keys
  const [deviceA, setDeviceA] = useState(() => {
    // Generate real Stellar keypair if none saved
    const keys = generateRealStellarKeypair();
    return {
      name: 'Billetera Principal (Pagador A)',
      publicKey: keys.publicKey,     // Genuine Stellar G...
      secretKey: keys.secretKey,     // Genuine Stellar S...
      asset: 'USDT',
      mainBalance: 100.0,
      derivedOffline: 10.0,         // 10.00 USDT allocated for offline vault
      spentOffline: 0.0,
      currentNonce: 0,
    };
  });

  // Device B (Payee / Merchant) Wallet State with genuine Stellar Ed25519 Keys
  const [deviceB, setDeviceB] = useState(() => {
    const keys = generateRealStellarKeypair();
    return {
      name: 'Terminal Comercio (Cobrador B)',
      publicKey: keys.publicKey,     // Genuine Stellar G...
      secretKey: keys.secretKey,     // Genuine Stellar S...
      asset: 'USDT',
      mainBalance: 25.0,
      receivedOffline: 0.0,
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

  // Load from localStorage with validation
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.deviceA && parsed.deviceA.secretKey && parsed.deviceA.secretKey.startsWith('S')) {
          setDeviceA(parsed.deviceA);
        } else {
          setDeviceA(prev => ({ ...prev, ...generateRealStellarKeypair() }));
        }

        if (parsed.deviceB && parsed.deviceB.secretKey && parsed.deviceB.secretKey.startsWith('S')) {
          setDeviceB(parsed.deviceB);
        } else {
          setDeviceB(prev => ({ ...prev, ...generateRealStellarKeypair() }));
        }

        if (parsed.transactions) setTransactions(parsed.transactions);
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    } else {
      // Ensure real Stellar keys exist from the start
      const keysA = generateRealStellarKeypair();
      const keysB = generateRealStellarKeypair();
      setDeviceA(prev => ({ ...prev, publicKey: keysA.publicKey, secretKey: keysA.secretKey }));
      setDeviceB(prev => ({ ...prev, publicKey: keysB.publicKey, secretKey: keysB.secretKey }));
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

  // Current effective online state
  const effectiveOnline = isOnline && !isSimulatingOffline;
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Fetch real on-chain balance from Horizon Testnet
  const refreshOnlineBalance = async (targetPubKey = null) => {
    const pubKey = targetPubKey || deviceA.publicKey;
    if (!pubKey) return;
    setIsRefreshingBalance(true);

    try {
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
    } catch (err) {
      console.warn('Error fetching on-chain balance:', err);
      setIsRefreshingBalance(false);
    }
  };

  // Auto-fetch balance on mount if online
  useEffect(() => {
    if (effectiveOnline && deviceA.publicKey) {
      refreshOnlineBalance(deviceA.publicKey);
    }
  }, [deviceA.publicKey, effectiveOnline]);

  // Link any custom Stellar account (S... or G...)
  const linkCustomAccount = async (inputKey) => {
    const { importStellarAccount } = await import('../services/stellarCrypto');
    const imported = importStellarAccount(inputKey);

    setDeviceA(prev => ({
      ...prev,
      publicKey: imported.publicKey,
      secretKey: imported.secretKey || prev.secretKey,
      isReadOnly: imported.isReadOnly
    }));

    const balanceRes = await refreshOnlineBalance(imported.publicKey);
    return {
      publicKey: imported.publicKey,
      balance: balanceRes?.primaryBalance || 0,
      asset: balanceRes?.primaryAsset || 'XLM'
    };
  };

  // Fund with Friendbot on Testnet (+10,000 XLM)
  const requestFriendbotFunding = async (pubKey = null) => {
    const target = pubKey || deviceA.publicKey;
    const { fundWithFriendbot } = await import('../services/stellarCrypto');
    const res = await fundWithFriendbot(target);
    await new Promise(r => setTimeout(r, 2500));
    await refreshOnlineBalance(target);
    return res;
  };

  // Save to localStorage
  useEffect(() => {
    const state = {
      deviceA,
      deviceB,
      transactions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [deviceA, deviceB, transactions]);

  // Recalculate real Merkle Tree whenever transactions change
  useEffect(() => {
    buildRealMerkleTree(transactions).then(tree => {
      setMerkleTree(tree);
    });
  }, [transactions]);

  // 1. Allocate funds from Main Wallet to Offline Vault
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

  // 2. Return unspent offline funds back to Main Wallet
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

  // 3. Create & Sign Real Offline Payment (Payer / Device A)
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
      nonce: nextNonce,
      memo: memo,
      timestamp: Date.now(),
    };

    // 1. Calculate canonical SHA-256 hash of payload
    const txHash = await computeCanonicalTxHash(payload);

    // 2. Real Ed25519 signature with Payer's secret key
    const payerSignature = await signWithStellarKey(deviceA.secretKey, txHash);

    const pendingTx = {
      payload,
      txHash,
      payerSignature,
      payeeSignature: null,
      status: 'PENDING_COUNTER_SIGN',
      createdAt: Date.now(),
    };

    return pendingTx;
  };

  // 4. Payee processes, validates signature, counter-signs, and stores in Merkle Tree
  const receiveAndCounterSign = async (pendingTx, submitterDevice = 'device_b') => {
    if (!pendingTx || !pendingTx.txHash || !pendingTx.payerSignature) {
      throw new Error('Payload de pago inválido o corrupto');
    }

    // 1. Verify TxHash integrity
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

    // 3. Payee creates genuine Ed25519 Counter-Signature
    const payeeSignature = await counterSignPaymentReceipt(
      deviceB.secretKey,
      pendingTx.txHash,
      pendingTx.payerSignature
    );

    const finalizedTx = {
      ...pendingTx,
      payeeSignature,
      status: 'GUARDADO_LOCAL_OFFLINE',
      counterSignedAt: Date.now(),
    };

    // 4. Compute Merkle Leaf Hash
    const leafHash = await computeMerkleLeafHash(finalizedTx);
    finalizedTx.merkleLeafHash = leafHash;

    // 5. Update Payer Vault (Local Discount)
    setDeviceA(prev => ({
      ...prev,
      spentOffline: prev.spentOffline + pendingTx.payload.amount,
      currentNonce: Math.max(prev.currentNonce, pendingTx.payload.nonce),
    }));

    // 6. Update Payee Balance
    setDeviceB(prev => ({
      ...prev,
      receivedOffline: prev.receivedOffline + pendingTx.payload.amount,
    }));

    // 7. Add to transaction list
    setTransactions(prev => [finalizedTx, ...prev]);

    // Confetti effect
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {}

    return finalizedTx;
  };

  // 5. Real Sync to Stellar Testnet Horizon / Pollar Gateway
  const syncToStellarNetwork = async (triggerSource = 'USER_MANUAL') => {
    setIsSyncing(true);

    try {
      const pendingSyncTxs = transactions.filter(tx => tx.status !== 'SYNCED_ONCHAIN');
      
      if (pendingSyncTxs.length === 0) {
        setIsSyncing(false);
        return { message: 'Todas las transacciones ya están confirmadas en Stellar.' };
      }

      const totalSyncedAmount = pendingSyncTxs.reduce((acc, tx) => acc + tx.payload.amount, 0);

      // Broadcast directly to Stellar Testnet Horizon with Merkle Root in Memo
      const { submitRealStellarBatchTransaction } = await import('../services/stellarCrypto');
      const realTxResult = await submitRealStellarBatchTransaction({
        payerSecretKey: deviceA.secretKey,
        payerPublicKey: deviceA.publicKey,
        payeePublicKey: deviceB.publicKey,
        amount: totalSyncedAmount > 0 ? totalSyncedAmount : 1.0,
        merkleRootHash: merkleTree.rootHash || '0000000000000000000000000000000000000000000000000000000000000000',
        horizonUrl: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org'
      });

      const currentSubmitter = activeDevice === 'device_b' ? 'Dispositivo B (Comercio)' : 'Dispositivo A (Pagador)';

      setTransactions(prev => prev.map(tx => {
        if (tx.status !== 'SYNCED_ONCHAIN') {
          return {
            ...tx,
            status: 'SYNCED_ONCHAIN',
            syncedBy: currentSubmitter,
            syncedAt: Date.now(),
            stellarTxHash: realTxResult.hash,
            stellarLedger: realTxResult.ledger,
          };
        }
        return tx;
      }));

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

      const result = {
        success: true,
        batchMerkleRoot: merkleTree.rootHash,
        stellarTxHash: realTxResult.hash,
        stellarLedger: realTxResult.ledger,
        syncedCount: pendingSyncTxs.length,
        totalAmount: totalSyncedAmount,
        syncedBy: currentSubmitter,
        timestamp: Date.now(),
        stellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${realTxResult.hash}`
      };

      setLastSyncResult(result);
      setIsSyncing(false);
      return result;
    } catch (err) {
      setIsSyncing(false);
      throw err;
    }
  };

  // Reset demo state
  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    const keysA = generateRealStellarKeypair();
    const keysB = generateRealStellarKeypair();

    setDeviceA({
      name: 'Billetera Principal (Pagador A)',
      publicKey: keysA.publicKey,
      secretKey: keysA.secretKey,
      asset: 'USDT',
      mainBalance: 100.0,
      derivedOffline: 10.0,
      spentOffline: 0.0,
      currentNonce: 0,
    });
    setDeviceB({
      name: 'Terminal Comercio (Cobrador B)',
      publicKey: keysB.publicKey,
      secretKey: keysB.secretKey,
      asset: 'USDT',
      mainBalance: 25.0,
      receivedOffline: 0.0,
    });
    setTransactions([]);
    setLastSyncResult(null);
  };

  return (
    <WalletContext.Provider value={{
      activeDevice,
      setActiveDevice,
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
