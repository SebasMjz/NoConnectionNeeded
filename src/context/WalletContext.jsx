import React, { createContext, useContext, useState, useEffect } from 'react';

const WalletContext = createContext();

const STORAGE_KEY = 'pollar_wallet_v3';
const AUTH_STORAGE_KEY = 'pollar_auth_user';
const USERS_STORAGE_KEY = 'pollar_users';
const SETTINGS_KEY = 'pollar_settings';
const BIOMETRIC_CREDS_KEY = 'pollar_biometric_creds';
const LINKED_WALLETS_KEY = 'pollar_linked_wallets';

function buildWalletState(kp, name = 'Mi Billetera', asset = 'XLM') {
  return {
    id: 'w_' + kp.publicKey.slice(0, 8),
    name,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    isReadOnly: false,
    asset,
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
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { biometricEnabled: false, darkMode: true };
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [linkedWallets, setLinkedWallets] = useState(() => {
    try {
      const saved = localStorage.getItem(LINKED_WALLETS_KEY);
      if (saved) {
        const wallets = JSON.parse(saved);
        if (wallets.length > 0) return wallets;
      }
      // Migrate from v2
      const oldSaved = localStorage.getItem('pollar_offline_wallet_v2_real');
      if (oldSaved) {
        const old = JSON.parse(oldSaved);
        if (old.deviceA?.secretKey) {
          const migrated = [buildWalletState(
            { publicKey: old.deviceA.publicKey, secretKey: old.deviceA.secretKey },
            'Mi Billetera',
            old.deviceA.asset || 'XLM'
          )];
          localStorage.removeItem('pollar_offline_wallet_v2_real');
          return migrated;
        }
      }
    } catch (e) {}
    return [];
  });

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

  const activeWallet = linkedWallets.find(w => w.id === activeWalletId) || linkedWallets[0] || null;

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).transactions || [];
    } catch (e) {}
    return [];
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Persist linked wallets
  useEffect(() => {
    localStorage.setItem(LINKED_WALLETS_KEY, JSON.stringify(linkedWallets));
  }, [linkedWallets]);

  // Persist transactions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, transactions, activeWalletId }));
  }, [transactions, activeWalletId]);

  // Persist auth
  useEffect(() => {
    if (currentUser) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
  }, [currentUser]);

  const refreshBalance = async (publicKey) => {
    if (!publicKey) return;
    try {
      const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`);
      if (res.ok) {
        const data = await res.json();
        const xlm = data.balances?.find(b => b.asset_type === 'native')?.balance || '0';
        setLinkedWallets(prev => prev.map(w => 
          w.publicKey === publicKey ? { ...w, mainBalance: parseFloat(xlm), allBalances: data.ballets || [] } : w
        ));
      }
    } catch (e) { console.warn('Balance fetch error:', e); }
  };

  const updateSettings = (s) => { const u = { ...settings, ...s }; setSettings(u); localStorage.setItem(SETTINGS_KEY, JSON.stringify(u)); };

  const addWallet = (kp, name, asset = 'XLM') => {
    const w = buildWalletState(kp, name, asset);
    setLinkedWallets(prev => [...prev, w]);
    return w;
  };

  const removeWallet = (id) => {
    setLinkedWallets(prev => prev.filter(w => w.id !== id));
    if (activeWalletId === id) {
      const rem = linkedWallets.filter(w => w.id !== id);
      setActiveWalletId(rem.length > 0 ? rem[0].id : null);
    }
  };

  const login = async (privateKey, name = 'Mi Billetera') => {
    try {
      const { Keypair } = await import('@stellar/stellar-sdk');
      const kp = Keypair.fromSecret(privateKey);
      const user = { address: kp.publicKey(), name };
      setCurrentUser(user);
      const existing = linkedWallets.find(w => w.publicKey === kp.publicKey());
      if (!existing) addWallet(kp, name);
      else setActiveWalletId(existing.id);
      return user;
    } catch (e) { throw new Error('Clave privada inválida: ' + e.message); }
  };

  const loginAsDemo = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let pk = 'G';
    for (let i = 0; i < 55; i++) pk += chars[Math.floor(Math.random() * 32)];
    const user = { address: pk, name: 'Demo Wallet' };
    setCurrentUser(user);
    return user;
  };

  const logout = () => { setCurrentUser(null); localStorage.removeItem(AUTH_STORAGE_KEY); };

  // P2P: Create offline payment
  const createOfflinePayment = async (payee, amount, memo = 'Pago') => {
    if (!activeWallet) throw new Error('No hay wallet activa');
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) throw new Error('Monto inválido');
    
    const { computeCanonicalTxHash, signWithStellarKey } = await import('../services/stellarCrypto');
    const nonce = (activeWallet.currentNonce || 0) + 1;
    const payload = { id: `TX-${nonce}-${Date.now().toString(36).toUpperCase()}`, payer: activeWallet.publicKey, payee, amount: num, asset: activeWallet.asset || 'XLM', nonce, memo, timestamp: Date.now() };
    const txHash = await computeCanonicalTxHash(payload);
    const payerSignature = await signWithStellarKey(activeWallet.secretKey, txHash);
    return { payload, txHash, payerSignature, payeeSignature: null, status: 'PENDING' };
  };

  // P2P: Counter-sign
  const receiveAndCounterSign = async (tx) => {
    if (!activeWallet) throw new Error('No hay wallet activa');
    const { computeCanonicalTxHash, verifyStellarSignature, counterSignPaymentReceipt } = await import('../services/stellarCrypto');
    const hash = await computeCanonicalTxHash(tx.payload);
    if (hash !== tx.txHash) throw new Error('Hash inválido');
    if (!verifyStellarSignature(tx.payload.payer, tx.txHash, tx.payerSignature)) throw new Error('Firma pagador inválida');
    const payeeSig = await counterSignPaymentReceipt(activeWallet.secretKey, tx.txHash, tx.payerSignature);
    
    setLinkedWallets(prev => prev.map(w => {
      if (w.publicKey === activeWallet.publicKey) return { ...w, receivedOffline: (w.receivedOffline || 0) + tx.payload.amount };
      if (w.publicKey === tx.payload.payer) return { ...w, spentOffline: (w.spentOffline || 0) + tx.payload.amount };
      return w;
    }));
    
    const finalized = { ...tx, payeeSignature: payeeSig, status: 'COUNTER_SIGNED' };
    setTransactions(prev => [finalized, ...prev]);
    return finalized;
  };

  // Direct on-chain (for Debug panel)
  const sendDirect = async (toAddress, amount = '1.0000000', memo = 'DEBUG') => {
    if (!activeWallet?.secretKey) throw new Error('Requiere clave secreta');
    const { Horizon, Keypair, TransactionBuilder, Operation, Asset, Networks, Memo } = await import('@stellar/stellar-sdk');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    const src = await server.loadAccount(activeWallet.publicKey);
    const tx = new TransactionBuilder(src, { fee: '100', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: toAddress, asset: Asset.native(), amount }))
      .addMemo(Memo.text(memo)).setTimeout(60).build();
    tx.sign(Keypair.fromSecret(activeWallet.secretKey));
    const result = await server.submitTransaction(tx);
    await refreshBalance(activeWallet.publicKey);
    await refreshBalance(toAddress);
    return result;
  };

  return (
    <WalletContext.Provider value={{
      currentUser, settings, updateSettings, linkedWallets, activeWallet, activeWalletId, setActiveWalletId,
      addWallet, removeWallet, transactions, isSyncing, isOnline: isOnline && !isSimulatingOffline,
      isSimulatingOffline, setIsSimulatingOffline, login, loginAsDemo, logout, refreshBalance,
      createOfflinePayment, receiveAndCounterSign, sendDirect,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
