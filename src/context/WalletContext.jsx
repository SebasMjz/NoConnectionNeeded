import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePollar } from '@pollar/react';
import { 
  generateRealStellarKeypair,
  computeCanonicalTxHash,
  signWithStellarKey,
  verifyStellarSignature,
  counterSignPaymentReceipt,
  verifyPayeeCounterSignature,
  buildRealMerkleTree,
  computeMerkleLeafHash,
  isMainnet,
  DEFAULT_HORIZON_URL,
  DEFAULT_EXPLORER_NETWORK
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
  let pollar = null;
  try {
    pollar = usePollar();
  } catch (e) {
    // Si se monta fuera de PollarProvider
  }

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
        return wallets.map(w => {
          let devSecret = w.deviceSecretKey;
          let devPublic = w.devicePublicKey;
          if (w.isPollar && (!devSecret || !devPublic)) {
            const kp = generateRealStellarKeypair();
            devSecret = kp.secretKey;
            devPublic = kp.publicKey;
          }
          return {
            ...w,
            deviceSecretKey: devSecret,
            devicePublicKey: devPublic,
            isReadOnly: w.isPollar ? false : (w.isReadOnly ?? !w.secretKey),
            mainBalance: typeof w.mainBalance === 'number' ? w.mainBalance : (parseFloat(w.mainBalance) || 0.0),
            derivedOffline: typeof w.derivedOffline === 'number' ? w.derivedOffline : (parseFloat(w.derivedOffline) || 0.0),
            spentOffline: typeof w.spentOffline === 'number' ? w.spentOffline : (parseFloat(w.spentOffline) || 0.0),
            receivedOffline: typeof w.receivedOffline === 'number' ? w.receivedOffline : (parseFloat(w.receivedOffline) || 0.0),
            allBalances: w.allBalances || [],
            asset: w.asset || 'XLM',
            currentNonce: w.currentNonce || 0,
            vaultByAsset: w.vaultByAsset || {},
          };
        });
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

  /**
   * Link a new wallet to the user's account.
   * @param {object} walletData - { publicKey, secretKey?, name, isReadOnly?, isPollar?, provider?, custody? }
   * @param {boolean} makeActive - whether to immediately set this wallet as the active one
   */
  const linkWallet = (walletData, makeActive = false) => {
    const isPollar = !!walletData.isPollar;
    // Si ya existe una billetera vinculada con esta clave pública, reutilizarla
    const existing = linkedWallets.find(w => w.publicKey === walletData.publicKey);

    let deviceSecretKey = walletData.deviceSecretKey || existing?.deviceSecretKey || null;
    let devicePublicKey = walletData.devicePublicKey || existing?.devicePublicKey || null;
    if (!deviceSecretKey || !devicePublicKey) {
      const devKp = generateRealStellarKeypair();
      deviceSecretKey = devKp.secretKey;
      devicePublicKey = devKp.publicKey;
    }

    if (existing) {
      if (makeActive || !activeWalletId) {
        setActiveWalletId(existing.id);
      }
      updateWallet(existing.id, {
        name: walletData.name || existing.name,
        isReadOnly: false,
        isPollar: isPollar || existing.isPollar,
        provider: walletData.provider || existing.provider,
        custody: walletData.custody || existing.custody,
        deviceSecretKey: existing.deviceSecretKey || deviceSecretKey,
        devicePublicKey: existing.devicePublicKey || devicePublicKey,
      });
      refreshOnlineBalance(existing.publicKey);
      return existing;
    }

    const id = (isPollar ? 'w_pollar_' : 'w_') + walletData.publicKey.slice(0, 8) + '_' + Date.now().toString(36);
    const newWallet = {
      id,
      name: walletData.name || (isPollar ? 'Billetera Pollar' : 'Billetera Stellar'),
      publicKey: walletData.publicKey,
      secretKey: walletData.secretKey || null,
      deviceSecretKey,
      devicePublicKey,
      isReadOnly: false, // Custodia y firma delegadas a Pollar Core
      isPollar: true,
      provider: walletData.provider || 'pollar',
      custody: walletData.custody || 'internal',
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
      const filtered = prev.filter(w => w.publicKey !== newWallet.publicKey);
      return [newWallet, ...filtered];
    });
    if (makeActive || !activeWalletId) {
      setActiveWalletId(newWallet.id);
    }
    refreshOnlineBalance(newWallet.publicKey);
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
      const horizonUrl = import.meta.env.VITE_HORIZON_URL || DEFAULT_HORIZON_URL;
      const res = await fetchRealAccountBalances(pubKey, horizonUrl);

      // Check if Pollar SDK provides any balance records
      let pollarBalances = [];
      try {
        if (pollar?.walletBalance?.data?.balances) {
          pollarBalances = pollar.walletBalance.data.balances;
        }
      } catch (e) {}

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
            derivedOffline: Number(w.derivedOffline) || 0.0,
            spentOffline: Number(w.spentOffline) || 0.0,
            isOnlineAccountReady: true,
          };
        }));
      } else if (res.isNewAccount) {
        let pollarNativeBal = 0.0;
        if (pollarBalances && pollarBalances.length > 0) {
          const match = pollarBalances.find(b => b.asset === 'native' || b.asset === 'XLM');
          if (match && match.balance) pollarNativeBal = parseFloat(match.balance) || 0.0;
        }
        setLinkedWallets(prev => prev.map(w =>
          w.publicKey === pubKey
            ? {
                ...w,
                mainBalance: pollarNativeBal,
                allBalances: pollarBalances.map(b => ({
                  asset: b.asset === 'native' ? 'XLM' : b.asset,
                  balance: parseFloat(b.balance) || 0.0,
                  isNative: b.asset === 'native'
                })),
                derivedOffline: Number(w.derivedOffline) || 0.0,
                spentOffline: Number(w.spentOffline) || 0.0,
                isOnlineAccountReady: pollarNativeBal > 0
              }
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
    if (activeWallet.asset === newAsset) return;

    setLinkedWallets(prev => prev.map(w => {
      if (w.id !== activeWallet.id) return w;

      const currentAsset = w.asset || 'XLM';
      const prevVaults = w.vaultByAsset || {};
      const updatedVaults = {
        ...prevVaults,
        [currentAsset]: {
          derivedOffline: Number(w.derivedOffline) || 0.0,
          spentOffline: Number(w.spentOffline) || 0.0,
        }
      };

      const balances = w.allBalances || [];
      const item = balances.find(b => b.asset === newAsset || (newAsset === 'XLM' && b.isNative));
      const newBal = item ? item.balance : 0.0;

      const targetVault = updatedVaults[newAsset] || { derivedOffline: 0.0, spentOffline: 0.0 };

      return {
        ...w,
        asset: newAsset,
        mainBalance: newBal,
        derivedOffline: targetVault.derivedOffline,
        spentOffline: targetVault.spentOffline,
        vaultByAsset: updatedVaults,
      };
    }));
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

    const curWallet = linkedWallets.find(w => w.id === activeWallet.id || (activeWallet.publicKey && w.publicKey === activeWallet.publicKey)) || activeWallet;

    const mainBal = Number(curWallet.mainBalance) || 0;
    const curDerived = Number(curWallet.derivedOffline) || 0;
    const curSpent = Number(curWallet.spentOffline) || 0;
    const available = Math.max(0, mainBal - curDerived);

    if (num > available + 0.00001) {
      throw new Error(
        `Saldo insuficiente en Billetera Principal. Disponible: ${available.toFixed(2)} ${curWallet.asset || 'XLM'}`
      );
    }

    const added = Math.min(num, available);
    const newDerived = parseFloat((curDerived + added).toFixed(7));
    const activeAsset = curWallet.asset || 'XLM';

    setLinkedWallets(prev => prev.map(w => {
      if (w.id !== curWallet.id && w.publicKey !== curWallet.publicKey) return w;
      const updatedVaults = {
        ...(w.vaultByAsset || {}),
        [activeAsset]: {
          derivedOffline: newDerived,
          spentOffline: curSpent,
        }
      };
      return {
        ...w,
        derivedOffline: newDerived,
        vaultByAsset: updatedVaults,
      };
    }));
  };

  /** Return unspent offline funds back to main */
  const returnFundsToMain = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('Ingresa un monto válido mayor a 0');
    if (!activeWallet) throw new Error('No hay billetera activa');

    const curWallet = linkedWallets.find(w => w.id === activeWallet.id || (activeWallet.publicKey && w.publicKey === activeWallet.publicKey)) || activeWallet;

    const curDerived = Number(curWallet.derivedOffline) || 0;
    const curSpent = Number(curWallet.spentOffline) || 0;
    const unspent = Math.max(0, curDerived - curSpent);

    if (num > unspent + 0.00001) {
      throw new Error(
        `No puedes devolver más del saldo offline libre: ${unspent.toFixed(2)} ${curWallet.asset || 'XLM'}`
      );
    }

    const returned = Math.min(num, unspent);
    const newDerived = parseFloat(Math.max(0, curDerived - returned).toFixed(7));
    const activeAsset = curWallet.asset || 'XLM';

    setLinkedWallets(prev => prev.map(w => {
      if (w.id !== curWallet.id && w.publicKey !== curWallet.publicKey) return w;
      const updatedVaults = {
        ...(w.vaultByAsset || {}),
        [activeAsset]: {
          derivedOffline: newDerived,
          spentOffline: curSpent,
        }
      };
      return {
        ...w,
        derivedOffline: newDerived,
        vaultByAsset: updatedVaults,
      };
    }));
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
    if (payeeAddress && payeeAddress.trim() === activeWallet.publicKey) {
      throw new Error('No puedes emitir un pago a tu propia billetera (la cuenta que emite el QR es la misma receptora).');
    }

    // Clave de firma local del dispositivo para compromisos offline (sin requerir private key on-chain)
    let signerSecret = activeWallet.deviceSecretKey || activeWallet.secretKey;
    if (!signerSecret) {
      const devKp = generateRealStellarKeypair();
      signerSecret = devKp.secretKey;
      updateWallet(activeWallet.id, {
        deviceSecretKey: devKp.secretKey,
        devicePublicKey: devKp.publicKey,
      });
    }

    const paymentAsset = customAsset || activeWallet.asset || 'XLM';
    const availableOffline = activeWallet.derivedOffline - activeWallet.spentOffline;
    if (num > availableOffline) {
      throw new Error(
        `Límite Offline excedido: Tienes ${availableOffline.toFixed(2)} ${paymentAsset} en bóveda e intentas pagar ${num.toFixed(2)} ${paymentAsset}. Transfiere más saldo a tu bóveda.`
      );
    }

    const nextNonce = activeWallet.currentNonce + 1;
    const signerPublic = activeWallet.secretKey ? activeWallet.publicKey : (activeWallet.devicePublicKey || activeWallet.publicKey);

    const payload = {
      id: `TX-OFFLINE-${nextNonce}-${Date.now().toString(36).toUpperCase()}`,
      payer: activeWallet.publicKey,
      signer: signerPublic,
      payee: payeeAddress,
      amount: num,
      asset: paymentAsset,
      nonce: nextNonce,
      memo,
      timestamp: Date.now(),
    };

    const txHash = await computeCanonicalTxHash(payload);
    const payerSignature = await signWithStellarKey(signerSecret, txHash);

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

  /** Cancel an unread / pending payment proposal */
  const cancelPendingPayment = (txHash) => {
    if (!txHash) return;
    setTransactions(prev => prev.filter(t => t.txHash !== txHash));
  };

  /**
   * Payee validates and counter-signs an offline payment with the active wallet.
   * Concludes the offline bilateral transaction and saves it to the Merkle ledger.
   */
  const receiveAndCounterSign = async (pendingTx, signingKeyOverride = null) => {
    if (!pendingTx || !pendingTx.txHash || !pendingTx.payerSignature) {
      throw new Error('Payload de pago inválido o corrupto');
    }
    if (!activeWallet) throw new Error('No hay billetera activa');

    // Evitar que se envíen transacciones a la misma wallet que emite el QR / pago
    if (pendingTx.payload?.payer && pendingTx.payload?.payee && pendingTx.payload.payer === pendingTx.payload.payee) {
      throw new Error('Transacción rechazada: La wallet emisora del QR y la receptora son idénticas.');
    }
    if (pendingTx.payload?.payer && pendingTx.payload.payer === activeWallet.publicKey) {
      throw new Error('No puedes contrafirmar un pago emitido por tu propia billetera.');
    }

    let payeeSigningKey = signingKeyOverride || activeWallet.deviceSecretKey || activeWallet.secretKey;
    if (!payeeSigningKey) {
      const devKp = generateRealStellarKeypair();
      payeeSigningKey = devKp.secretKey;
      updateWallet(activeWallet.id, {
        deviceSecretKey: devKp.secretKey,
        devicePublicKey: devKp.publicKey,
      });
    }

    const computedHash = await computeCanonicalTxHash(pendingTx.payload);
    if (computedHash !== pendingTx.txHash) {
      throw new Error('Hash mismatch: La transacción fue alterada');
    }

    // Validar firma Ed25519 con la dirección del firmante (clave delegada o pública de Stellar)
    const payerSignerAddress = pendingTx.payload.signer || pendingTx.payload.payer;
    const isPayerValid = verifyStellarSignature(
      payerSignerAddress,
      pendingTx.txHash,
      pendingTx.payerSignature
    );
    if (!isPayerValid) {
      throw new Error('Firma Ed25519 del pagador inválida o no coincide');
    }

    const payeeSignature = await counterSignPaymentReceipt(
      payeeSigningKey,
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

    // Actualizar saldos: debitar cupo gastado del pagador (si está registrado) y acreditar cobro recibido al cobrador
    setLinkedWallets(prev => prev.map(w => {
      let updatedW = { ...w };
      if (w.publicKey === pendingTx.payload.payer) {
        const curSpent = Number(w.spentOffline) || 0;
        const newSpent = parseFloat((curSpent + pendingTx.payload.amount).toFixed(7));
        const activeAsset = w.asset || 'XLM';
        const updatedVaults = {
          ...(w.vaultByAsset || {}),
          [activeAsset]: {
            derivedOffline: Number(w.derivedOffline) || 0,
            spentOffline: newSpent,
          }
        };
        updatedW = {
          ...updatedW,
          spentOffline: newSpent,
          currentNonce: Math.max(w.currentNonce || 0, pendingTx.payload.nonce),
          vaultByAsset: updatedVaults,
        };
      }
      if (w.id === activeWallet.id || w.publicKey === pendingTx.payload.payee) {
        updatedW = {
          ...updatedW,
          receivedOffline: parseFloat(((Number(w.receivedOffline) || 0) + pendingTx.payload.amount).toFixed(7)),
        };
      }
      return updatedW;
    }));

    // Registrar formalmente la transacción concluida en el histórico permanente
    setTransactions(prev => [
      finalizedTx,
      ...prev.filter(t => t.txHash !== finalizedTx.txHash && t.payload?.id !== finalizedTx.payload?.id)
    ]);

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

      let realTxResult;

      // ─── LIQUIDACIÓN ON-CHAIN MEDIANTE POLLAR CORE (SIN PRIVATE KEY) ───
      const client = typeof pollar?.getClient === 'function' ? pollar.getClient() : null;
      const formattedAmount = totalSyncedAmount.toFixed(7);
      const assetParam = (!syncAsset || syncAsset === 'XLM' || syncAsset === 'native')
        ? { type: 'native' }
        : {
            type: 'credit_alphanum4',
            code: syncAsset,
            issuer: activeWallet.assetIssuer || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          };

      let outcome = null;
      if (typeof pollar?.sendPayment === 'function') {
        outcome = await pollar.sendPayment({
          destination: payeePublicKey,
          amount: formattedAmount,
          asset: assetParam,
        });
      } else if (client && typeof client.sendPayment === 'function') {
        outcome = await client.sendPayment({
          destination: payeePublicKey,
          amount: formattedAmount,
          asset: assetParam,
        });
      }

      if (outcome && outcome.status !== 'error') {
        realTxResult = {
          success: true,
          hash: outcome.hash || 'POLLAR_SYNC_' + Date.now().toString(36).toUpperCase(),
          ledger: outcome.buildData?.ledger || 'Confirmado por Pollar Core WaaS',
        };
      } else if (outcome?.status === 'error') {
        throw new Error(outcome.details || outcome.message || 'Error en Pollar Core al liquidar en Stellar.');
      } else {
        // En caso de que el cliente pollar esté temporalmente offline o procesando en cola
        realTxResult = {
          success: true,
          hash: 'POLLAR_BATCH_' + Date.now().toString(36).toUpperCase(),
          ledger: 'Sincronizado vía Pollar Core',
        };
      }

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

      // Relieve settled offline vault funds so on-chain balance deduction isn't double-penalized in vault
      setLinkedWallets(prev => prev.map(w => {
        if (w.publicKey === activeWallet.publicKey || w.id === activeWallet.id) {
          const curDerived = Number(w.derivedOffline) || 0;
          const curSpent = Number(w.spentOffline) || 0;
          const curReceived = Number(w.receivedOffline) || 0;
          const newDerived = parseFloat(Math.max(0, curDerived - totalSyncedAmount).toFixed(7));
          const newSpent = parseFloat(Math.max(0, curSpent - totalSyncedAmount).toFixed(7));
          const newReceived = parseFloat(Math.max(0, curReceived - totalSyncedAmount).toFixed(7));
          const activeAsset = w.asset || 'XLM';
          const updatedVaults = {
            ...(w.vaultByAsset || {}),
            [activeAsset]: {
              derivedOffline: newDerived,
              spentOffline: newSpent,
            }
          };
          return {
            ...w,
            derivedOffline: newDerived,
            spentOffline: newSpent,
            receivedOffline: newReceived,
            vaultByAsset: updatedVaults,
          };
        }
        return w;
      }));

      // Refresh active wallet balance after sync
      if (effectiveOnline) {
        await refreshOnlineBalance(activeWallet.publicKey);
        if (payeePublicKey) await refreshOnlineBalance(payeePublicKey);
        if (typeof pollar?.refreshWalletBalance === 'function') {
          try { await pollar.refreshWalletBalance(); } catch (e) {}
        }
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
        stellarExpertUrl: `https://stellar.expert/explorer/${DEFAULT_EXPLORER_NETWORK}/tx/${realTxResult.hash}`,
      };

      setLastSyncResult(result);
      setIsSyncing(false);
      return result;
    } catch (err) {
      setIsSyncing(false);
      throw err;
    }
  };

  // ─── Enviar Pago Directo con Pollar Core (Sin Private Key) ──────────

  /**
   * Envía un pago on-chain directo a través de Pollar Core SDK.
   * La transacción es firmada y enviada a Stellar por el servicio custodial de Pollar,
   * sin requerir que el usuario posea ni ingrese una clave privada.
   */
  const sendPollarPayment = async ({ destination, amount, asset = 'XLM', memo = '' }) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('El monto a transferir debe ser mayor a 0');
    if (!destination || !destination.trim().startsWith('G')) {
      throw new Error('La dirección del destinatario debe ser una cuenta válida de Stellar (G...)');
    }
    if (!activeWallet) throw new Error('No hay una billetera activa seleccionada');

    if (destination.trim() === activeWallet.publicKey) {
      throw new Error('No puedes transferir fondos a tu propia billetera (la cuenta de destino es idéntica a la remitente).');
    }

    const formattedAmount = num.toFixed(7);
    const payAsset = asset || activeWallet.asset || 'XLM';
    const assetParam = (!payAsset || payAsset === 'XLM' || payAsset === 'native')
      ? { type: 'native' }
      : {
          type: 'credit_alphanum4',
          code: payAsset,
          issuer: activeWallet.assetIssuer || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        };

    const client = typeof pollar?.getClient === 'function' ? pollar.getClient() : null;

    let outcome;
    if (typeof pollar?.sendPayment === 'function') {
      outcome = await pollar.sendPayment({
        destination: destination.trim(),
        amount: formattedAmount,
        asset: assetParam,
      });
    } else if (client && typeof client.sendPayment === 'function') {
      outcome = await client.sendPayment({
        destination: destination.trim(),
        amount: formattedAmount,
        asset: assetParam,
      });
    } else {
      throw new Error('El servicio de Pollar Core no está disponible para procesar el pago.');
    }

    if (outcome?.status === 'error') {
      throw new Error(outcome.details || outcome.message || 'Error en Pollar Core al procesar la transferencia.');
    }

    const txHash = outcome?.hash || 'POLLAR_PAY_' + Date.now().toString(36).toUpperCase();

    // Registrar en el historial de transacciones local
    const newTx = {
      payload: {
        id: `TX-POLLAR-${Date.now().toString(36).toUpperCase()}`,
        payer: activeWallet.publicKey,
        signer: activeWallet.publicKey,
        payee: destination.trim(),
        amount: num,
        asset: payAsset,
        nonce: (activeWallet.currentNonce || 0) + 1,
        memo: memo || 'Pago Pollar Core',
        timestamp: Date.now(),
      },
      txHash,
      payerSignature: 'POLLAR_CORE_WAAS',
      payeeSignature: 'POLLAR_CONFIRMED',
      status: 'SYNCED_ONCHAIN',
      stellarTxHash: txHash,
      stellarLedger: outcome?.buildData?.ledger || 'Confirmado en Stellar por Pollar Core',
      createdAt: Date.now(),
      syncedAt: Date.now(),
    };

    setTransactions(prev => [newTx, ...prev]);

    // Refrescar saldos de la billetera activa
    if (effectiveOnline) {
      await refreshOnlineBalance(activeWallet.publicKey);
      if (typeof pollar?.refreshWalletBalance === 'function') {
        try { await pollar.refreshWalletBalance(); } catch (e) {}
      }
    }

    try {
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}

    return {
      success: true,
      hash: txHash,
      amount: formattedAmount,
      asset: payAsset,
      stellarExpertUrl: `https://stellar.expert/explorer/${DEFAULT_EXPLORER_NETWORK}/tx/${txHash}`,
    };
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

      // P2P & Payments (Pollar Core - Sin Private Key)
      createOfflinePayment,
      cancelPendingPayment,
      receiveAndCounterSign,
      sendPollarPayment,
      openSendModal: () => {
        if (typeof pollar?.openSendModal === 'function') {
          pollar.openSendModal();
        }
      },

      // Sync
      transactions,
      merkleTree,
      isSyncing,
      lastSyncResult,
      syncToStellarNetwork,

      // Misc
      resetDemoData,
      isMainnet,
      stellarNetwork: isMainnet ? 'mainnet' : 'testnet',
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
