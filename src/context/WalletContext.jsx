import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Network } from '@capacitor/network';
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
  depositToVault,
  depositTokenToVault,
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

  // Active EVM Chain: 'avalancheFuji' (Default) | 'sepolia' | 'baseSepolia'
  const [activeEvmChain, setActiveEvmChain] = useState('avalancheFuji');

  // Device Selection: 'device_a' (Payer) | 'device_b' (Payee/Merchant) | 'dual_sim' (Split View)
  const [activeDevice, setActiveDevice] = useState('device_a');
  
  // Real Hardware and Active Connectivity Detection
  const [isHardwareOnline, setIsHardwareOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncStatus, setAutoSyncStatus] = useState(null);

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

  // Single EVM Account per device installation
  const [evmWallet, setEvmWallet] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.evmWallet) return parsed.evmWallet;
        if (parsed.evmDeviceA) return parsed.evmDeviceA;
      }
    } catch (e) {}
    const keys = generateRealEvmKeypair();
    return {
      name: 'Mi Billetera EVM',
      publicKey: keys.address,
      secretKey: keys.privateKey,
      address: keys.address,
      privateKey: keys.privateKey,
      asset: 'USDC',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      receivedOffline: 0.0,
      nativeBalance: 0.0,
      currentNonce: 0,
      network: 'evm'
    };
  });

  // Single Stellar Account per device installation
  const [stellarWallet, setStellarWallet] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.stellarWallet) return parsed.stellarWallet;
        if (parsed.stellarDeviceA) return parsed.stellarDeviceA;
      }
    } catch (e) {}
    const keys = generateRealStellarKeypair();
    return {
      name: 'Mi Billetera Stellar',
      publicKey: keys.publicKey,
      secretKey: keys.secretKey,
      asset: 'USDT',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      receivedOffline: 0.0,
      currentNonce: 0,
      network: 'stellar'
    };
  });

  // Offline Transactions and Merkle Tree State
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.transactions)) return parsed.transactions;
      }
    } catch (e) {}
    return [];
  });
  const [merkleTree, setMerkleTree] = useState({
    rootHash: '',
    leaves: [],
    levels: [],
    transactionCount: 0
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Active Device Pointer based on activeNetwork: Single unified wallet per device!
  const isEvm = activeNetwork === 'evm';
  const myWallet = isEvm ? evmWallet : stellarWallet;
  const setMyWallet = (updater) => {
    if (isEvm) setEvmWallet(updater);
    else setStellarWallet(updater);
  };

  // Backwards compatible aliases for components:
  const deviceA = myWallet;
  const deviceB = myWallet;
  const setDeviceA = setMyWallet;
  const setDeviceB = setMyWallet;

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.evmWallet) {
          setEvmWallet(parsed.evmWallet);
        } else if (parsed.evmDeviceA) {
          setEvmWallet(parsed.evmDeviceA);
        }
        if (parsed.stellarWallet) {
          setStellarWallet(parsed.stellarWallet);
        } else if (parsed.stellarDeviceA) {
          setStellarWallet(parsed.stellarDeviceA);
        }
        if (parsed.activeNetwork) setActiveNetwork(parsed.activeNetwork);
        if (parsed.activeEvmChain) setActiveEvmChain(parsed.activeEvmChain);
        if (parsed.transactions) setTransactions(parsed.transactions);
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    }
  }, []);

  // Active probe function to test actual internet packet reachability
  const probeRealInternet = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2600);

      // Probe Cloudflare CDN trace (fast, reliable, CORS enabled)
      const res = await fetch(`https://cloudflare.com/cdn-cgi/trace?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch (err) {
      // Secondary fallback probe to Avalanche Fuji RPC
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 2600);
        const rpcUrl = EVM_NETWORKS[activeEvmChain]?.rpcUrl || 'https://api.avax-test.network/ext/bc/C/rpc';
        const res2 = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'net_version', params: [] }),
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
        return res2.ok;
      } catch (err2) {
        return false;
      }
    }
  };

  const checkConnectivityNow = async () => {
    const online = await probeRealInternet();
    setIsHardwareOnline(online);
    return online;
  };

  // Multi-tier Network Connectivity Listener (Capacitor Native + DOM + Active Heartbeat)
  useEffect(() => {
    let isMounted = true;
    let capListener = null;

    const verifyAndUpdate = async () => {
      const online = await probeRealInternet();
      if (isMounted) {
        setIsHardwareOnline(online);
      }
    };

    // Initial immediate probe
    verifyAndUpdate();

    // 1. Capacitor Native Network Plugin Listener (Android ConnectivityManager)
    try {
      Network.getStatus().then(status => {
        if (!isMounted) return;
        if (status && status.connected === false) {
          setIsHardwareOnline(false);
        } else {
          verifyAndUpdate();
        }
      }).catch(() => {});

      Network.addListener('networkStatusChange', status => {
        if (!isMounted) return;
        console.log('[Network] Native status change:', status);
        if (status && status.connected === false) {
          setIsHardwareOnline(false);
        } else {
          verifyAndUpdate();
        }
      }).then(handle => {
        capListener = handle;
      }).catch(() => {});
    } catch (e) {
      console.warn('[Network] Capacitor listener fallback:', e);
    }

    // 2. Web DOM Events
    const onOnline = () => verifyAndUpdate();
    const onOffline = () => {
      if (isMounted) setIsHardwareOnline(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        verifyAndUpdate();
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    // 3. Periodic Ping Heartbeat (every 3.5s when visible)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        verifyAndUpdate();
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      if (capListener && typeof capListener.remove === 'function') {
        capListener.remove();
      }
    };
  }, [activeEvmChain]);

  // Effective online state: must be hardware connected AND not simulating offline
  const effectiveOnline = isHardwareOnline && !isSimulatingOffline;

  // Save to localStorage
  useEffect(() => {
    const state = {
      activeNetwork,
      activeEvmChain,
      evmWallet,
      stellarWallet,
      transactions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem('pollar_active_network', activeNetwork);
  }, [activeNetwork, activeEvmChain, evmWallet, stellarWallet, transactions]);

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
        const address = (targetPubKey || evmWallet.address || evmWallet.publicKey || '').trim();
        const res = address ? await fetchRealEvmAccountBalances(address, activeEvmChain) : null;

        if (res && res.success) {
          setEvmWallet(prev => {
            let derivedOffline = prev.derivedOffline;
            let spentOffline = prev.spentOffline;
            // When smart contract data is retrieved, sync available offline capacity with live on-chain escrow
            if (res.tokenVaultState) {
              const contractAvail = res.tokenVaultState.availableToSpend;
              derivedOffline = contractAvail;
              spentOffline = 0.0;
            } else if (res.vaultState && prev.asset === 'ETH') {
              derivedOffline = res.vaultState.availableToSpend;
              spentOffline = 0.0;
            }
            return {
              ...prev,
              mainBalance: res.usdcBalance,
              nativeBalance: res.nativeBalance,
              asset: 'USDC',
              symbol: res.nativeSymbol,
              vaultState: res.vaultState,
              tokenVaultState: res.tokenVaultState,
              derivedOffline,
              spentOffline
            };
          });

          // If the token vault shows totalSettled > 0 on-chain, mark any pending payer txs as settled!
          if (res.tokenVaultState && res.tokenVaultState.totalSettled > 0) {
            setTransactions(prev => {
              let updated = false;
              const mapped = prev.map(tx => {
                if (tx.status !== 'SYNCED_ONCHAIN' && tx.payload?.payer?.toLowerCase() === address.toLowerCase()) {
                  updated = true;
                  return {
                    ...tx,
                    status: 'SYNCED_ONCHAIN',
                    syncedBy: 'Smart Contract Escrow (Liquidado en Avalanche Fuji)',
                    syncedAt: Date.now()
                  };
                }
                return tx;
              });
              return updated ? mapped : prev;
            });
          }
        }

        setIsRefreshingBalance(false);
        return res;
      } else {
        const pubKey = targetPubKey || stellarWallet.publicKey;
        const { fetchRealAccountBalances } = await import('../services/stellarCrypto');
        const horizonUrl = import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org';
        const res = await fetchRealAccountBalances(pubKey, horizonUrl);
        if (res.success) {
          setStellarWallet(prev => ({
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

  // Automatic Synchronization whenever internet is restored or available
  const isAutoSyncingRef = useRef(false);

  useEffect(() => {
    if (!autoSyncEnabled || !effectiveOnline) return;

    const pendingTxs = transactions.filter(tx => tx.status !== 'SYNCED_ONCHAIN');
    if (pendingTxs.length === 0) return;

    if (isAutoSyncingRef.current || isSyncing) return;

    console.log(`[AutoSync] Conexión activa detectada con ${pendingTxs.length} transacción(es) pendiente(s). Sincronizando automáticamente...`);

    setAutoSyncStatus({
      status: 'syncing',
      message: `Conexión detectada: Sincronizando ${pendingTxs.length} transacción(es) en Avalanche Fuji...`,
      timestamp: Date.now()
    });

    const timer = setTimeout(async () => {
      if (isAutoSyncingRef.current || isSyncing) return;
      isAutoSyncingRef.current = true;

      try {
        // Refresh balance to inspect latest on-chain escrow state
        await refreshOnlineBalance();

        // Check again if transactions are still pending after balance refresh
        const currentPending = transactions.filter(tx => tx.status !== 'SYNCED_ONCHAIN');
        if (currentPending.length === 0) {
          setAutoSyncStatus({
            status: 'success',
            message: 'Transacciones verificadas y confirmadas on-chain.',
            timestamp: Date.now()
          });
          setTimeout(() => setAutoSyncStatus(null), 4000);
          return;
        }

        const res = await syncToNetwork('AUTO_ONLINE');
        setAutoSyncStatus({
          status: 'success',
          message: `¡Sincronizado automáticamente en ${isEvm ? 'Avalanche Fuji' : 'Stellar'}! (Bloque #${res.blockNumber || res.stellarLedger || 'Reciente'})`,
          timestamp: Date.now()
        });

        setTimeout(() => setAutoSyncStatus(null), 5000);
      } catch (err) {
        console.warn('[AutoSync] Notice during auto-sync:', err.message);
        const isGasErr = err.code === 'INSUFFICIENT_GAS' || (err.message && (err.message.includes('Gas') || err.message.includes('gas') || err.message.includes('insufficient')));
        setAutoSyncStatus({
          status: 'error',
          message: isGasErr
            ? 'Requiere una fracción de AVAX para cubrir el gas de la red.'
            : `Auto-sync en pausa: ${err.message || 'Error de conexión'}`,
          timestamp: Date.now(),
          isGasError: isGasErr
        });
      } finally {
        isAutoSyncingRef.current = false;
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [effectiveOnline, transactions, autoSyncEnabled, isEvm]);

  // Link / Import custom account (EVM 0x... / Private Key or Stellar Secret/Public Key)
  const linkCustomAccount = async (inputKey) => {
    const clean = inputKey.trim();
    if (clean.startsWith('0x') || clean.length === 64 || clean.length === 66) {
      const imported = importEvmAccount(clean);
      setEvmWallet(prev => ({
        ...prev,
        publicKey: imported.publicKey,
        address: imported.address,
        secretKey: imported.secretKey || prev.secretKey,
        privateKey: imported.privateKey || prev.privateKey,
        isReadOnly: imported.isReadOnly
      }));
      const balRes = await fetchRealEvmAccountBalances(imported.address, activeEvmChain);
      if (balRes.success) {
        setEvmWallet(prev => ({
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
      setStellarWallet(prev => ({
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
  const createOfflinePayment = async (payeeAddress, amount, memo = 'Pago Offline Avalanche') => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('El monto debe ser mayor a 0');

    const availableOffline = (deviceA.derivedOffline || 0) - (deviceA.spentOffline || 0);
    if (num > availableOffline) {
      throw new Error(`Saldo insuficiente en Bóveda Offline: Tienes ${availableOffline.toFixed(2)} ${deviceA.asset} disponibles offline. Transfiere o deposita fondos a tu bóveda antes de pagar.`);
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
      status: 'EMITIDO_OFFLINE',
      network: isEvm ? 'EVM' : 'Stellar',
      createdAt: Date.now(),
    };

    // Immediately deduct from available offline vault on payer device
    setMyWallet(prev => ({
      ...prev,
      spentOffline: (prev.spentOffline || 0) + num,
      currentNonce: nextNonce
    }));

    // Add to payer's transaction history
    setTransactions(prev => [pendingTx, ...prev]);

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
        myWallet.secretKey
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
        myWallet.secretKey,
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

    // Update receiver's wallet: increment receivedOffline ONLY!
    setMyWallet(prev => ({
      ...prev,
      receivedOffline: (prev.receivedOffline || 0) + pendingTx.payload.amount,
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
      const currentSubmitter = myWallet?.name || 'Mi Billetera Avalanche';
      const submitterAccount = myWallet;

      let syncResult;

      if (isEvm) {
        // Extract real payer and payee from the batch transactions
        const batchPayer = pendingSyncTxs[0]?.payload?.payer || myWallet.publicKey;
        const batchPayee = pendingSyncTxs[0]?.payload?.payee || myWallet.publicKey;

        // Broadcast to EVM (Sepolia / HSK / Base)
        const evmRes = await submitRealEvmBatchTransaction({
          submitterPrivateKey: submitterAccount.secretKey,
          submitterAddress: submitterAccount.publicKey,
          payerPrivateKey: myWallet.publicKey?.toLowerCase() === batchPayer?.toLowerCase() ? myWallet.secretKey : null,
          payerAddress: batchPayer,
          payeeAddress: batchPayee,
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
          usedVaultContract: evmRes.usedVaultContract
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

      // Update balances after settlement on this device (receiver gets funds credited)
      const isPayeeOnThisDevice = myWallet.publicKey?.toLowerCase() === batchPayee?.toLowerCase();
      if (isPayeeOnThisDevice) {
        setMyWallet(prev => ({
          ...prev,
          mainBalance: prev.mainBalance + totalSyncedAmount,
          receivedOffline: Math.max(0, (prev.receivedOffline || 0) - totalSyncedAmount),
        }));
      }

      setLastSyncResult(syncResult);
      setIsSyncing(false);

      if (effectiveOnline) {
        refreshOnlineBalance().catch(e => console.warn('Post-sync balance refresh notice:', e));
      }

      return syncResult;
    } catch (err) {
      setIsSyncing(false);
      throw err;
    }
  };

  // Fund EVM Smart Contract Vault (locks AVAX in AvalancheVault for Payer A)
  const fundEvmVault = async (amountEth = '0.001') => {
    if (!isEvm) throw new Error('El depósito en bóveda sólo está disponible en redes EVM.');
    const res = await depositToVault({
      privateKey: deviceA.secretKey,
      amountEth,
      networkId: activeEvmChain
    });
    await refreshOnlineBalance();
    return res;
  };

  // Fund EVM Smart Contract Vault with ERC-20 Tokens (USDC / USDT)
  const fundEvmTokenVault = async (amountTokens = '1') => {
    if (!isEvm) throw new Error('El depósito en bóveda sólo está disponible en redes EVM.');
    const network = EVM_NETWORKS[activeEvmChain] || EVM_NETWORKS.avalancheFuji;
    if (!network.usdcAddress) {
      throw new Error(`No hay token USDC configurado para ${network.name}`);
    }
    const res = await depositTokenToVault({
      privateKey: deviceA.secretKey,
      tokenAddress: network.usdcAddress,
      amountTokens,
      decimals: network.usdcDecimals || 6,
      networkId: activeEvmChain
    });
    await refreshOnlineBalance();
    return res;
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
        network: EVM_NETWORKS[activeEvmChain]?.name || 'Avalanche Fuji Testnet',
        faucetUrl: EVM_NETWORKS[activeEvmChain]?.faucetUrl || 'https://core.app/tools/testnet-faucet/?subnet=c&token=c',
        ethFaucetUrl: EVM_NETWORKS[activeEvmChain]?.ethFaucetUrl || 'https://core.app/tools/testnet-faucet/?subnet=c&token=c'
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
    const email = customEmail || 'usuario.avalanche@gmail.com';
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

  const loginAsPreset = (presetType = 'mi_billetera') => {
    const pub = (isEvm ? evmWallet : stellarWallet).publicKey;
    const user = {
      id: 'usr_' + (pub ? pub.slice(0, 8) : 'wallet'),
      email: 'mi.billetera@avax.network',
      name: 'Mi Billetera Avalanche',
      provider: 'preset',
      role: 'device_a',
      publicKey: pub,
      connectedAt: Date.now()
    };
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
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

    const evm = generateRealEvmKeypair();
    const st = generateRealStellarKeypair();

    setEvmWallet({
      name: 'Mi Billetera Avalanche',
      publicKey: evm.address,
      secretKey: evm.privateKey,
      address: evm.address,
      privateKey: evm.privateKey,
      asset: 'USDC',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      receivedOffline: 0.0,
      nativeBalance: 0.0,
      currentNonce: 0,
      network: 'evm'
    });

    setStellarWallet({
      name: 'Mi Billetera Stellar',
      publicKey: st.publicKey,
      secretKey: st.secretKey,
      asset: 'USDT',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      receivedOffline: 0.0,
      currentNonce: 0,
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
      isHardwareOnline,
      isSimulatingOffline,
      setIsSimulatingOffline,
      autoSyncEnabled,
      setAutoSyncEnabled,
      autoSyncStatus,
      setAutoSyncStatus,
      checkConnectivityNow,
      myWallet,
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
      fundEvmVault,
      fundEvmTokenVault,
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
