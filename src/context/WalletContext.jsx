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
import { getBiometricService } from '../services/BiometricService';
import confetti from 'canvas-confetti';

const WalletContext = createContext();

const STORAGE_KEY = 'pollar_wallet_v3';
const AUTH_STORAGE_KEY = 'pollar_auth_user';
const USERS_STORAGE_KEY = 'pollar_users';
const SETTINGS_KEY = 'pollar_settings';
const BIOMETRIC_CREDS_KEY = 'pollar_biometric_creds';
const LINKED_WALLETS_KEY = 'pollar_linked_wallets';

/** Create a fresh wallet state object from a keypair */
function buildWalletState(kp, name = 'Mi Billetera') {
  return {
    id: 'w_' + kp.publicKey.slice(0, 8),
    name,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    isReadOnly: false,
    asset: 'XLM',
    mainBalance: 0.0,
    derivedOffline: 0.0,
    spentOffline: 0.0,
    receivedOffline: 0.0,
    currentNonce: 0,
    allBalances: [],
    isOnlineAccountReady: false,
    createdAt: Date.now(),
  };
}

export function WalletProvider({ children }) {
  // ─── App Settings ──────────────────────────────────────────────────
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { biometricEnabled: false, darkMode: true };
  });

  // ─── Auth Session ──────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // ─── Linked Wallets (array) ─────────────────────────────────────────
  const [linkedWallets, setLinkedWallets] = useState(() => {
    try {
      const saved = localStorage.getItem(LINKED_WALLETS_KEY);
      if (saved) {
        const wallets = JSON.parse(saved);
        // Sanitize any legacy mock balances
        return wallets.map(w => ({
          ...w,
          mainBalance: [100.0, 25.0].includes(w.mainBalance) ? 0.0 : (w.mainBalance || 0.0),
          derivedOffline: w.derivedOffline === 10.0 ? 0.0 : (w.derivedOffline || 0.0),
          spentOffline: w.spentOffline === 10.0 ? 0.0 : (w.spentOffline || 0.0),
          receivedOffline: w.receivedOffline || 0.0,
          allBalances: w.allBalances || [],
          asset: w.asset || 'XLM',
          currentNonce: w.currentNonce || 0,
        }));
      }
    } catch (e) {}
    return [];
  });

  // ─── Active Wallet ID ──────────────────────────────────────────────
  const [activeWalletId, setActiveWalletId] = useState(() => {
    try {
      const saved = localStorage.getItem(LINKED_WALLETS_KEY);
      if (saved) {
        const wallets = JSON.parse(saved);
        if (wallets.length > 0) return wallets[0].id;
      }
    } catch (e) {}
    return null;
  });

  // Derived: the currently active wallet object
  const activeWallet = linkedWallets.find(w => w.id === activeWalletId) || linkedWallets[0] || null;

  // ─── Network State ─────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  const effectiveOnline = isOnline && !isSimulatingOffline;

  // ─── Transactions & Merkle ─────────────────────────────────────────
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.transactions || [];
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

  // ─── Persist linked wallets ─────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(LINKED_WALLETS_KEY, JSON.stringify(linkedWallets));
  }, [linkedWallets]);

  // ─── Persist transactions ───────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions }));
  }, [transactions]);

  // ─── Network listeners ──────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Rebuild Merkle on tx change ────────────────────────────────────
  useEffect(() => {
    buildRealMerkleTree(transactions).then(tree => setMerkleTree(tree));
  }, [transactions]);

  // ─── Auto-fetch balance on active wallet change ─────────────────────
  useEffect(() => {
    if (effectiveOnline && activeWallet?.publicKey) {
      refreshOnlineBalance(activeWallet.publicKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWallet?.publicKey, effectiveOnline]);

  // ─── Wallet Management ──────────────────────────────────────────────

  /**
   * Link a new wallet to the user's account.
   * @param {object} walletData - { publicKey, secretKey?, name, isReadOnly? }
   */
  const linkWallet = (walletData) => {
    const id = 'w_' + walletData.publicKey.slice(0, 8) + '_' + Date.now().toString(36);
    const newWallet = {
      id,
      name: walletData.name || 'Billetera Vinculada',
      publicKey: walletData.publicKey,
      secretKey: walletData.secretKey || null,
      isReadOnly: walletData.isReadOnly || !walletData.secretKey,
      asset: 'XLM',
      mainBalance: 0.0,
      derivedOffline: 0.0,
      spentOffline: 0.0,
      receivedOffline: 0.0,
      currentNonce: 0,
      allBalances: [],
      isOnlineAccountReady: false,
      createdAt: Date.now(),
    };
    setLinkedWallets(prev => {
      const updated = [newWallet, ...prev];
      if (!activeWalletId) setActiveWalletId(newWallet.id);
      return updated;
    });
    if (!activeWalletId) setActiveWalletId(newWallet.id);
    return newWallet;
  };

  /** Remove a wallet from the linked list */
  const unlinkWallet = (walletId) => {
    setLinkedWallets(prev => {
      const updated = prev.filter(w => w.id !== walletId);
      if (activeWalletId === walletId && updated.length > 0) {
        setActiveWalletId(updated[0].id);
      } else if (updated.length === 0) {
        setActiveWalletId(null);
      }
      return updated;
    });
  };

  /** Set which wallet is the active one */
  const selectActiveWallet = (walletId) => {
    setActiveWalletId(walletId);
  };

  /** Update fields of a specific wallet in the list */
  const updateWallet = (walletId, updates) => {
    setLinkedWallets(prev =>
      prev.map(w => w.id === walletId ? { ...w, ...updates } : w)
    );
  };

  // ─── Balance Refresh ────────────────────────────────────────────────

  const refreshOnlineBalance = async (targetPubKey = null) => {
    const pubKey = targetPubKey || activeWallet?.publicKey;
    if (!pubKey) return;
    setIsRefreshingBalance(true);
    try {
      const { fetchRealAccountBalances } = await import('../services/stellarCrypto');
      const horizonUrl = import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org';
      const res = await fetchRealAccountBalances(pubKey, horizonUrl);

      if (res.success) {
        setLinkedWallets(prev => prev.map(w => {
          if (w.publicKey !== pubKey) return w;
          const activeAsset = w.asset || 'XLM';
          const assetBalItem = res.balances.find(b =>
            b.asset === activeAsset || (activeAsset === 'XLM' && b.isNative)
          );
          const activeBal = assetBalItem
            ? assetBalItem.balance
            : (activeAsset === 'XLM' ? res.nativeBalance : 0.0);
          return {
            ...w,
            mainBalance: activeBal,
            allBalances: res.balances,
            isOnlineAccountReady: true,
          };
        }));
      } else if (res.isNewAccount) {
        setLinkedWallets(prev => prev.map(w =>
          w.publicKey === pubKey
            ? { ...w, mainBalance: 0.0, allBalances: [], isOnlineAccountReady: false }
            : w
        ));
      }
      setIsRefreshingBalance(false);
      return res;
    } catch (err) {
      console.warn('Error fetching on-chain balance:', err);
      setIsRefreshingBalance(false);
    }
  };

  // ─── Asset Selector ─────────────────────────────────────────────────

  const changeSelectedAsset = (newAsset) => {
    if (!activeWallet) return;
    const balances = activeWallet.allBalances || [];
    const item = balances.find(b => b.asset === newAsset || (newAsset === 'XLM' && b.isNative));
    const newBal = item ? item.balance : 0.0;
    updateWallet(activeWallet.id, {
      asset: newAsset,
      mainBalance: newBal,
      derivedOffline: 0.0,
      spentOffline: 0.0,
    });
  };

  // ─── Link custom Stellar account ────────────────────────────────────

  const linkCustomAccount = async (inputKey, walletName = null) => {
    const { importStellarAccount } = await import('../services/stellarCrypto');
    const imported = importStellarAccount(inputKey);

    const wallet = linkWallet({
      publicKey: imported.publicKey,
      secretKey: imported.secretKey || null,
      name: walletName || `Stellar (${imported.publicKey.slice(0, 6)}...)`,
      isReadOnly: imported.isReadOnly,
    });

    const balanceRes = await refreshOnlineBalance(imported.publicKey);
    return {
      publicKey: imported.publicKey,
      balance: balanceRes?.primaryBalance || 0,
      asset: balanceRes?.primaryAsset || 'XLM',
      walletId: wallet.id,
    };
  };

  // ─── Friendbot ──────────────────────────────────────────────────────

  const requestFriendbotFunding = async (pubKey = null) => {
    const target = pubKey || activeWallet?.publicKey;
    if (!target) throw new Error('No hay billetera activa para fondear');
    const { fundWithFriendbot } = await import('../services/stellarCrypto');
    const res = await fundWithFriendbot(target);
    await new Promise(r => setTimeout(r, 2000));
    await refreshOnlineBalance(target);
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#0062FF', '#10B981', '#F59E0B', '#60A5FA', '#34D399'],
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 40, 80]);
      }
    } catch (e) {}
    return res;
  };

  // ─── Offline Vault Operations ───────────────────────────────────────

  /** Allocate from main on-chain balance to offline vault */
  const allocateOfflineFunds = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('Ingresa un monto válido mayor a 0');
    if (!activeWallet) throw new Error('No hay billetera activa');

    const available = activeWallet.mainBalance - activeWallet.derivedOffline;
    if (num > available) {
      throw new Error(
        `Saldo insuficiente en Billetera Principal. Disponible: ${available.toFixed(2)} ${activeWallet.asset}`
      );
    }
    updateWallet(activeWallet.id, {
      derivedOffline: activeWallet.derivedOffline + num,
    });
  };

  /** Return unspent offline funds back to main */
  const returnFundsToMain = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('Ingresa un monto válido mayor a 0');
    if (!activeWallet) throw new Error('No hay billetera activa');

    const unspent = activeWallet.derivedOffline - activeWallet.spentOffline;
    if (num > unspent) {
      throw new Error(
        `No puedes devolver más del saldo offline libre: ${unspent.toFixed(2)} ${activeWallet.asset}`
      );
    }
    updateWallet(activeWallet.id, {
      derivedOffline: activeWallet.derivedOffline - num,
    });
  };

  // ─── P2P Offline Payment ────────────────────────────────────────────

  /**
   * Create & sign an offline payment from the active wallet.
   * @param {string} payeeAddress - Stellar public key of the recipient
   * @param {number|string} amount
   * @param {string} memo
   * @param {string|null} customAsset
   */
  const createOfflinePayment = async (payeeAddress, amount, memo = 'Pago Offline Pollar', customAsset = null) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('El monto debe ser mayor a 0');
    if (!activeWallet) throw new Error('No hay billetera activa');
    if (activeWallet.isReadOnly) throw new Error('Esta billetera es de sólo lectura. Importa la clave secreta para firmar.');

    const paymentAsset = customAsset || activeWallet.asset || 'XLM';
    const availableOffline = activeWallet.derivedOffline - activeWallet.spentOffline;
    if (num > availableOffline) {
      throw new Error(
        `Límite Offline excedido: Tienes ${availableOffline.toFixed(2)} ${paymentAsset} en bóveda e intentas pagar ${num.toFixed(2)} ${paymentAsset}. Transfiere más saldo a tu bóveda.`
      );
    }

    const nextNonce = activeWallet.currentNonce + 1;
    const payload = {
      id: `TX-OFFLINE-${nextNonce}-${Date.now().toString(36).toUpperCase()}`,
      payer: activeWallet.publicKey,
      payee: payeeAddress,
      amount: num,
      asset: paymentAsset,
      nonce: nextNonce,
      memo,
      timestamp: Date.now(),
    };

    const txHash = await computeCanonicalTxHash(payload);
    const payerSignature = await signWithStellarKey(activeWallet.secretKey, txHash);

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

  /**
   * Payee validates and counter-signs an offline payment with the active wallet.
   */
  const receiveAndCounterSign = async (pendingTx) => {
    if (!pendingTx || !pendingTx.txHash || !pendingTx.payerSignature) {
      throw new Error('Payload de pago inválido o corrupto');
    }
    if (!activeWallet) throw new Error('No hay billetera activa');
    if (activeWallet.isReadOnly) throw new Error('Esta billetera es de sólo lectura. Importa la clave secreta para contrafirmar.');

    const computedHash = await computeCanonicalTxHash(pendingTx.payload);
    if (computedHash !== pendingTx.txHash) {
      throw new Error('Hash mismatch: La transacción fue alterada');
    }

    const isPayerValid = verifyStellarSignature(
      pendingTx.payload.payer,
      pendingTx.txHash,
      pendingTx.payerSignature
    );
    if (!isPayerValid) {
      throw new Error('Firma Ed25519 del pagador inválida o no coincide');
    }

    const payeeSignature = await counterSignPaymentReceipt(
      activeWallet.secretKey,
      pendingTx.txHash,
      pendingTx.payerSignature
    );

    const finalizedTx = {
      ...pendingTx,
      payeeSignature,
      status: 'GUARDADO_LOCAL_OFFLINE',
      counterSignedAt: Date.now(),
    };

    const leafHash = await computeMerkleLeafHash(finalizedTx);
    finalizedTx.merkleLeafHash = leafHash;

    // Update spentOffline for the payer wallet (by public key match)
    setLinkedWallets(prev => prev.map(w => {
      if (w.publicKey === pendingTx.payload.payer) {
        return {
          ...w,
          spentOffline: w.spentOffline + pendingTx.payload.amount,
          currentNonce: Math.max(w.currentNonce, pendingTx.payload.nonce),
        };
      }
      // If active wallet is the payee, accrue receivedOffline
      if (w.id === activeWallet.id && w.publicKey === pendingTx.payload.payee) {
        return {
          ...w,
          receivedOffline: w.receivedOffline + pendingTx.payload.amount,
        };
      }
      return w;
    }));

    // Also update receivedOffline for active wallet if it's the payee
    if (activeWallet.publicKey === pendingTx.payload.payee) {
      updateWallet(activeWallet.id, {
        receivedOffline: activeWallet.receivedOffline + pendingTx.payload.amount,
      });
    }

    setTransactions(prev => [finalizedTx, ...prev]);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch (e) {}

    return finalizedTx;
  };

  // ─── On-Chain Sync ──────────────────────────────────────────────────

  const syncToStellarNetwork = async () => {
    if (!activeWallet) throw new Error('No hay billetera activa');
    setIsSyncing(true);

    try {
      const pendingSyncTxs = transactions.filter(tx => tx.status !== 'SYNCED_ONCHAIN');

      if (pendingSyncTxs.length === 0) {
        setIsSyncing(false);
        return { message: 'Todas las transacciones ya están confirmadas en Stellar.' };
      }

      const totalSyncedAmount = pendingSyncTxs.reduce((acc, tx) => acc + tx.payload.amount, 0);
      const syncAsset = pendingSyncTxs[0]?.payload?.asset || activeWallet.asset || 'XLM';
      // Get the payee for the batch (first pending tx's payee)
      const payeePublicKey = pendingSyncTxs[0]?.payload?.payee;

      const { submitRealStellarBatchTransaction } = await import('../services/stellarCrypto');
      const realTxResult = await submitRealStellarBatchTransaction({
        payerSecretKey: activeWallet.secretKey,
        payerPublicKey: activeWallet.publicKey,
        payeePublicKey: payeePublicKey,
        amount: totalSyncedAmount,
        assetCode: syncAsset,
        merkleRootHash: merkleTree.rootHash || '0'.repeat(64),
        horizonUrl: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org',
      });

      setTransactions(prev => prev.map(tx => {
        if (tx.status !== 'SYNCED_ONCHAIN') {
          return {
            ...tx,
            status: 'SYNCED_ONCHAIN',
            syncedAt: Date.now(),
            stellarTxHash: realTxResult.hash,
            stellarLedger: realTxResult.ledger,
          };
        }
        return tx;
      }));

      // Refresh active wallet balance after sync
      if (effectiveOnline) {
        await refreshOnlineBalance(activeWallet.publicKey);
        if (payeePublicKey) await refreshOnlineBalance(payeePublicKey);
      }

      const result = {
        success: true,
        batchMerkleRoot: merkleTree.rootHash,
        stellarTxHash: realTxResult.hash,
        stellarLedger: realTxResult.ledger,
        syncedCount: pendingSyncTxs.length,
        totalAmount: totalSyncedAmount,
        asset: syncAsset,
        timestamp: Date.now(),
        stellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${realTxResult.hash}`,
      };

      setLastSyncResult(result);
      setIsSyncing(false);
      return result;
    } catch (err) {
      setIsSyncing(false);
      throw err;
    }
  };

  // ─── Authentication ─────────────────────────────────────────────────

  const _persistUser = (user) => {
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  };

  const loginWithOAuth = (profile) => {
    const user = {
      id: 'usr_oauth_' + Math.random().toString(36).substring(2, 9),
      email: profile.email || null,
      name: profile.name || profile.email?.split('@')[0] || 'Usuario',
      provider: profile.provider || 'google',
      avatar: profile.avatar || profile.picture || null,
      connectedAt: Date.now(),
    };
    _persistUser(user);
    return user;
  };

  const loginWithEmail = (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      provider: 'email',
      connectedAt: Date.now(),
    };
    _persistUser(user);
    return user;
  };

  const registerUser = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) throw new Error('Email inválido');
    if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

    const storedUsers = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    if (storedUsers[cleanEmail]) throw new Error('Este email ya está registrado');

    const hashBuffer = await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(password + cleanEmail));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    storedUsers[cleanEmail] = { passwordHash: hashHex, createdAt: Date.now() };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(storedUsers));
    return loginWithEmail(cleanEmail);
  };

  const loginWithPassword = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const storedUsers = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    const stored = storedUsers[cleanEmail];
    if (!stored) throw new Error('No existe una cuenta con este email');

    const hashBuffer = await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(password + cleanEmail));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex !== stored.passwordHash) throw new Error('Contraseña incorrecta');
    return loginWithEmail(cleanEmail);
  };

  const loginWithGoogle = (customEmail = null) => {
    return loginWithOAuth({
      email: customEmail || 'usuario.pollar@gmail.com',
      name: customEmail ? customEmail.split('@')[0] : 'Usuario Google',
      provider: 'google',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(customEmail || 'google')}`,
    });
  };

  const loginWithWallet = async (inputKey = null) => {
    let walletPub = activeWallet?.publicKey;
    if (inputKey && inputKey.trim()) {
      const res = await linkCustomAccount(inputKey.trim(), 'Billetera Importada');
      walletPub = res.publicKey;
    }
    const user = {
      id: 'usr_w_' + walletPub.slice(0, 8),
      email: null,
      name: `Stellar (${walletPub.slice(0, 4)}...${walletPub.slice(-4)})`,
      provider: 'wallet',
      publicKey: walletPub,
      connectedAt: Date.now(),
    };
    _persistUser(user);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(BIOMETRIC_CREDS_KEY);
  };

  // ─── Settings ───────────────────────────────────────────────────────

  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  };

  // ─── Biometric ──────────────────────────────────────────────────────

  const biometricService = getBiometricService();
  const isBiometricAvailable = () => biometricService.isAvailable;
  const checkBiometricAvailable = async () => await biometricService.initialize();
  const registerBiometric = async (userId) => await biometricService.registerBiometric(userId);
  const authenticateWithBiometric = async (userId) => await biometricService.authenticateWithBiometric(userId);

  // ─── Reset ──────────────────────────────────────────────────────────

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LINKED_WALLETS_KEY);
    setCurrentUser(null);
    setLinkedWallets([]);
    setActiveWalletId(null);
    setTransactions([]);
    setLastSyncResult(null);
  };

  // ─── Context Value ──────────────────────────────────────────────────

  return (
    <WalletContext.Provider value={{
      // Auth
      currentUser,
      loginWithEmail,
      loginWithPassword,
      loginWithGoogle,
      loginWithOAuth,
      loginWithWallet,
      registerUser,
      logout,

      // Settings
      settings,
      updateSettings,

      // Biometric
      isBiometricAvailable,
      checkBiometricAvailable,
      registerBiometric,
      authenticateWithBiometric,

      // Network
      isOnline: effectiveOnline,
      isSimulatingOffline,
      setIsSimulatingOffline,
      autoSyncEnabled,
      setAutoSyncEnabled,

      // Wallets
      linkedWallets,
      activeWallet,
      activeWalletId,
      linkWallet,
      unlinkWallet,
      selectActiveWallet,
      linkCustomAccount,
      refreshOnlineBalance,
      requestFriendbotFunding,
      isRefreshingBalance,
      changeSelectedAsset,

      // Vault
      allocateOfflineFunds,
      returnFundsToMain,

      // P2P
      createOfflinePayment,
      receiveAndCounterSign,

      // Sync
      transactions,
      merkleTree,
      isSyncing,
      lastSyncResult,
      syncToStellarNetwork,

      // Misc
      resetDemoData,
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
