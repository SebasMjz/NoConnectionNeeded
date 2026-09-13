import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const WalletContext = createContext();

// HSK Testnet Config
const HSK_TESTNET = {
  chainId: 133,
  rpcUrl: 'https://testnet.hsk.xyz',
  name: 'HashKey Chain Testnet',
  contracts: {
    forwarder: '0xBFB5078c8afF57226F1f32de999dd0ADd559dcbC',
    vault: '0x7e906F6C41660C218282fe4F5d7C76d8D8604d96',
    usdc: '0x788952C55A04F32C4dC26dEd4858f5D6259f2F15',
  }
};

const RELAYER_URL = 'http://localhost:3001';
const STORAGE_KEY = 'pollar_evm_wallet_v1';
const PENDING_TX_KEY = 'pollar_pending_tx';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const VAULT_ABI = [
  'function depositTokenVault(address token, uint256 amount) external',
  'function withdrawTokenVault(address token, uint256 amount) external',
  'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)'
];

const FORWARDER_ABI = [
  'function getNonce(address from) external view returns (uint256)'
];

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [vaultBalance, setVaultBalance] = useState('0');
  const [hskBalance, setHskBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingTx, setPendingTx] = useState([]);
  const [usdcContract, setUsdcContract] = useState(null);
  const [vaultContract, setVaultContract] = useState(null);
  const [forwarderContract, setForwarderContract] = useState(null);

  // Load pending tx on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PENDING_TX_KEY);
      if (saved) setPendingTx(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // Save pending tx on change
  useEffect(() => {
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(pendingTx));
  }, [pendingTx]);

  // Initialize provider and auto-connect saved wallet
  useEffect(() => {
    const initProvider = async () => {
      try {
        const prov = new ethers.JsonRpcProvider(HSK_TESTNET.rpcUrl, HSK_TESTNET.chainId);
        setProvider(prov);
        const usdc = new ethers.Contract(HSK_TESTNET.contracts.usdc, ERC20_ABI, prov);
        const vault = new ethers.Contract(HSK_TESTNET.contracts.vault, VAULT_ABI, prov);
        const forwarder = new ethers.Contract(HSK_TESTNET.contracts.forwarder, FORWARDER_ABI, prov);
        setUsdcContract(usdc);
        setVaultContract(vault);
        setForwarderContract(forwarder);

        // Auto-connect saved wallet after provider is ready
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const w = JSON.parse(saved);
            const s = new ethers.Wallet(w.privateKey, prov);
            const address = await s.getAddress();
            setSigner(s);
            setWallet({ address, privateKey: w.privateKey });
            const usdcS = new ethers.Contract(HSK_TESTNET.contracts.usdc, ERC20_ABI, s);
            const vaultS = new ethers.Contract(HSK_TESTNET.contracts.vault, VAULT_ABI, s);
            const forwarderS = new ethers.Contract(HSK_TESTNET.contracts.forwarder, FORWARDER_ABI, s);
            setUsdcContract(usdcS);
            setVaultContract(vaultS);
            setForwarderContract(forwarderS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, privateKey: w.privateKey }));
            await refreshBalances(address);
            setCurrentUser({ address, name: `${address.slice(0,6)}...${address.slice(-4)}` });
            console.log('[Wallet] Auto-connected:', address);
          }
        } catch (e) {
          console.error('[Wallet] Auto-connect error:', e);
        }
      } catch (e) {
        console.error('[Wallet] Init error:', e);
      }
    };
    initProvider();
  }, []);

  // Connect with private key (called from UI)
  const connectWithPrivateKey = useCallback(async (privateKey) => {
    if (!provider) {
      // Fallback: create new provider if not initialized
      const prov = new ethers.JsonRpcProvider(HSK_TESTNET.rpcUrl, HSK_TESTNET.chainId);
      setProvider(prov);
      const s = new ethers.Wallet(privateKey, prov);
      const address = await s.getAddress();
      setSigner(s);
      setWallet({ address, privateKey });
      const usdc = new ethers.Contract(HSK_TESTNET.contracts.usdc, ERC20_ABI, s);
      const vault = new ethers.Contract(HSK_TESTNET.contracts.vault, VAULT_ABI, s);
      const forwarder = new ethers.Contract(HSK_TESTNET.contracts.forwarder, FORWARDER_ABI, s);
      setUsdcContract(usdc);
      setVaultContract(vault);
      setForwarderContract(forwarder);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, privateKey }));
      await refreshBalances(address);
      setCurrentUser({ address, name: `${address.slice(0,6)}...${address.slice(-4)}` });
      return;
    }
    setIsConnecting(true);
    try {
      const s = new ethers.Wallet(privateKey, provider);
      const address = await s.getAddress();
      setSigner(s);
      setWallet({ address, privateKey });
      const usdc = new ethers.Contract(HSK_TESTNET.contracts.usdc, ERC20_ABI, s);
      const vault = new ethers.Contract(HSK_TESTNET.contracts.vault, VAULT_ABI, s);
      const forwarder = new ethers.Contract(HSK_TESTNET.contracts.forwarder, FORWARDER_ABI, s);
      setUsdcContract(usdc);
      setVaultContract(vault);
      setForwarderContract(forwarder);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, privateKey }));
      await refreshBalances(address);
      setCurrentUser({ address, name: `${address.slice(0,6)}...${address.slice(-4)}` });
    } catch (e) {
      console.error('[Wallet] Connect error:', e);
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  // Generate demo wallet
  const generateDemoWallet = useCallback(async () => {
    const w = ethers.Wallet.createRandom();
    await connectWithPrivateKey(w.privateKey);
    return w.address;
  }, [connectWithPrivateKey]);

  // Refresh balances
  const refreshBalances = useCallback(async (address) => {
    if (!provider || !usdcContract || !vaultContract || !address) return;
    try {
      const hskBal = await provider.getBalance(address);
      setHskBalance(parseFloat(ethers.formatEther(hskBal)).toFixed(4));
      const usdcBal = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();
      setUsdcBalance(parseFloat(ethers.formatUnits(usdcBal, decimals)).toFixed(2));
      const vaultBal = await vaultContract.getTokenVault(address, HSK_TESTNET.contracts.usdc);
      setVaultBalance(parseFloat(ethers.formatUnits(vaultBal[1], decimals)).toFixed(2));
    } catch (e) {
      console.warn('[Wallet] Balance refresh error:', e.message);
    }
  }, [provider, usdcContract, vaultContract]);

  // Mint MockUSDC
  const mintUSDC = useCallback(async (amount) => {
    if (!usdcContract || !signer) throw new Error('No conectado');
    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);
    const tx = await usdcContract.mint(await signer.getAddress(), amountUnits);
    await tx.wait();
    await refreshBalances(await signer.getAddress());
    return tx.hash;
  }, [usdcContract, signer, refreshBalances]);

  // Deposit to Vault
  const depositToVault = useCallback(async (amount) => {
    if (!usdcContract || !vaultContract || !signer) throw new Error('No conectado');
    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);
    const vaultAddress = HSK_TESTNET.contracts.vault;
    const userAddress = await signer.getAddress();
    const currentAllowance = await usdcContract.allowance(userAddress, vaultAddress);
    if (currentAllowance < amountUnits) {
      const approveTx = await usdcContract.approve(vaultAddress, amountUnits);
      await approveTx.wait();
    }
    const depositTx = await vaultContract.depositTokenVault(HSK_TESTNET.contracts.usdc, amountUnits);
    await depositTx.wait();
    await refreshBalances(userAddress);
    return depositTx.hash;
  }, [usdcContract, vaultContract, signer, refreshBalances]);

  // Withdraw from Vault
  const withdrawFromVault = useCallback(async (amount) => {
    if (!vaultContract || !usdcContract || !signer) throw new Error('No conectado');
    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);
    const tx = await vaultContract.withdrawTokenVault(HSK_TESTNET.contracts.usdc, amountUnits);
    await tx.wait();
    await refreshBalances(await signer.getAddress());
    return tx.hash;
  }, [vaultContract, usdcContract, signer, refreshBalances]);

  // Send USDC
  const sendUSDC = useCallback(async (to, amount) => {
    if (!usdcContract || !signer) throw new Error('No conectado');
    if (!to.startsWith('0x') || to.length !== 42) {
      throw new Error('Direccion invalida');
    }
    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);
    const tx = await usdcContract.transfer(to, amountUnits);
    await tx.wait();
    await refreshBalances(await signer.getAddress());
    return tx.hash;
  }, [usdcContract, signer, refreshBalances]);

  // Gasless meta-transaction
  const sendMetaTransaction = useCallback(async (to, amount) => {
    if (!forwarderContract || !usdcContract || !signer) throw new Error('No conectado');
    const decimals = await usdcContract.decimals();
    const amountUnits = ethers.parseUnits(amount.toString(), decimals);
    const transferData = usdcContract.interface.encodeFunctionData('transfer', [to, amountUnits]);
    const nonce = await forwarderContract.getNonce(await signer.getAddress());
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const domain = {
      name: 'PollarForwarder',
      version: '1',
      chainId: HSK_TESTNET.chainId,
      verifyingContract: HSK_TESTNET.contracts.forwarder,
    };
    const types = {
      ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'data', type: 'bytes' },
      ],
    };
    const request = {
      from: await signer.getAddress(),
      to: HSK_TESTNET.contracts.usdc,
      value: 0,
      gas: 100000,
      nonce: nonce,
      deadline: deadline,
      data: transferData,
    };
    const signature = await signer.signTypedData(domain, types, request);
    const res = await fetch(`${RELAYER_URL}/api/relay/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forwardRequest: request, signature }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    await refreshBalances(await signer.getAddress());
    return result.txHash;
  }, [forwarderContract, usdcContract, signer, refreshBalances]);

  // Add pending transaction (offline mode)
  const addPendingTx = useCallback((tx) => {
    const newTx = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...tx,
      synced: false,
      timestamp: Date.now(),
    };
    setPendingTx(prev => [...prev, newTx]);
    return newTx;
  }, []);

  // Receive payload from P2P
  const receivePayload = useCallback((payloadStr) => {
    let payload;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      throw new Error('Payload invalido');
    }
    if (!payload.amount || !payload.from) {
      throw new Error('Payload incompleto');
    }
    return { amount: payload.amount, from: payload.from, to: payload.to || currentUser?.address };
  }, [currentUser]);

  // Sync pending transactions
  const syncPendingTx = useCallback(async () => {
    if (!signer || pendingTx.length === 0) return;
    const unsynced = pendingTx.filter(tx => !tx.synced);
    const synced = [];
    for (const tx of unsynced) {
      try {
        if (tx.type === 'SEND') {
          await sendUSDC(tx.to, tx.amount);
          synced.push(tx.id);
        }
      } catch (e) {
        console.error('[Wallet] Sync error for tx', tx.id, e.message);
      }
    }
    setPendingTx(prev => prev.map(tx => synced.includes(tx.id) ? { ...tx, synced: true } : tx));
    return synced;
  }, [signer, pendingTx, sendUSDC]);

  // Disconnect
  const disconnect = useCallback(() => {
    setSigner(null);
    setWallet(null);
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setUsdcBalance('0');
    setVaultBalance('0');
    setHskBalance('0');
  }, []);

  return (
    <WalletContext.Provider value={{
      wallet,
      currentUser,
      provider,
      signer,
      usdcBalance,
      vaultBalance,
      hskBalance,
      isConnecting,
      isOnline,
      setIsOnline,
      pendingTx,
      connectWithPrivateKey,
      generateDemoWallet,
      disconnect,
      mintUSDC,
      depositToVault,
      withdrawFromVault,
      sendUSDC,
      sendMetaTransaction,
      refreshBalances,
      addPendingTx,
      receivePayload,
      syncPendingTx,
      contracts: HSK_TESTNET.contracts,
      chainId: HSK_TESTNET.chainId,
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
