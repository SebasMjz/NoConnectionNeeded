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

// Relayer URL (local)
const RELAYER_URL = 'http://localhost:3001';

// Contract ABIs (minimal)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const VAULT_ABI = [
  'function depositVault() public payable',
  'function depositTokenVault(address token, uint256 amount) external',
  'function withdrawVault(uint256 amount) external',
  'function withdrawTokenVault(address token, uint256 amount) external',
  'function getVault(address payer) external view returns (address, uint256, uint256, uint256, bytes32, uint64)',
  'function getTokenVault(address payer, address token) external view returns (address, uint256, uint256, uint256, bytes32, uint64)'
];

const FORWARDER_ABI = [
  'function getNonce(address from) external view returns (uint256)',
  'function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req, bytes signature) external payable returns (bool, bytes)'
];

const STORAGE_KEY = 'pollar_evm_wallet_v1';
const AUTH_KEY = 'pollar_auth_user';

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [vaultBalance, setVaultBalance] = useState('0');
  const [hskBalance, setHskBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Contracts
  const [usdcContract, setUsdcContract] = useState(null);
  const [vaultContract, setVaultContract] = useState(null);
  const [forwarderContract, setForwarderContract] = useState(null);

  // Initialize provider
  useEffect(() => {
    const initProvider = async () => {
      try {
        const prov = new ethers.JsonRpcProvider(HSK_TESTNET.rpcUrl, HSK_TESTNET.chainId);
        setProvider(prov);

        // Initialize contracts (read-only)
        const usdc = new ethers.Contract(HSK_TESTNET.contracts.usdc, ERC20_ABI, prov);
        const vault = new ethers.Contract(HSK_TESTNET.contracts.vault, VAULT_ABI, prov);
        const forwarder = new ethers.Contract(HSK_TESTNET.contracts.forwarder, FORWARDER_ABI, prov);

        setUsdcContract(usdc);
        setVaultContract(vault);
        setForwarderContract(forwarder);

        console.log('[Wallet] Provider initialized, contracts loaded');
      } catch (e) {
        console.error('[Wallet] Init error:', e);
        setError('Error conectando a HSK Testnet');
      }
    };
    initProvider();
  }, []);

  // Load saved wallet
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const w = JSON.parse(saved);
        connectWithPrivateKey(w.privateKey);
      }
    } catch (e) {}
  }, []);

  // Connect with private key
  const connectWithPrivateKey = useCallback(async (privateKey) => {
    if (!provider) return;
    setIsConnecting(true);
    setError(null);

    try {
      const s = new ethers.Wallet(privateKey, provider);
      const address = await s.getAddress();
      
      setSigner(s);
      setWallet({ address, privateKey });
      
      // Update contracts with signer
      const usdc = new ethers.Contract(HSK_TESTNET.contracts.usdc, ERC20_ABI, s);
      const vault = new ethers.Contract(HSK_TESTNET.contracts.vault, VAULT_ABI, s);
      const forwarder = new ethers.Contract(HSK_TESTNET.contracts.forwarder, FORWARDER_ABI, s);

      setUsdcContract(usdc);
      setVaultContract(vault);
      setForwarderContract(forwarder);

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, privateKey }));

      // Refresh balances
      await refreshBalances(address);

      setCurrentUser({ address, name: `${address.slice(0,6)}...${address.slice(-4)}` });
      console.log('[Wallet] Connected:', address);
    } catch (e) {
      console.error('[Wallet] Connect error:', e);
      setError('Clave privada inválida');
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
      // HSK balance
      const hskBal = await provider.getBalance(address);
      setHskBalance(parseFloat(ethers.formatEther(hskBal)).toFixed(4));

      // USDC balance (6 decimals)
      const usdcBal = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();
      setUsdcBalance(parseFloat(ethers.formatUnits(usdcBal, decimals)).toFixed(2));

      // Vault balance (use getTokenVault for ERC20)
      const vaultBal = await vaultContract.getTokenVault(address, HSK_TESTNET.contracts.usdc);
      setVaultBalance(parseFloat(ethers.formatUnits(vaultBal[1], decimals)).toFixed(2));
    } catch (e) {
      console.warn('[Wallet] Balance refresh error:', e.message);
    }
  }, [provider, usdcContract, vaultContract]);

  // Mint MockUSDC (for testing)
  const mintUSDC = useCallback(async (amount) => {
    if (!usdcContract || !signer) throw new Error('No conectado');
    try {
      const decimals = await usdcContract.decimals();
      const amountUnits = ethers.parseUnits(amount.toString(), decimals);
      const tx = await usdcContract.mint(await signer.getAddress(), amountUnits);
      await tx.wait();
      await refreshBalances(await signer.getAddress());
      console.log('[Wallet] Minted', amount, 'USDC');
      return tx.hash;
    } catch (e) {
      console.error('[Wallet] Mint error:', e);
      throw e;
    }
  }, [usdcContract, signer, refreshBalances]);

  // Deposit USDC into Vault
  const depositToVault = useCallback(async (amount) => {
    if (!usdcContract || !vaultContract || !signer) throw new Error('No conectado');
    try {
      const decimals = await usdcContract.decimals();
      const amountUnits = ethers.parseUnits(amount.toString(), decimals);
      const vaultAddress = HSK_TESTNET.contracts.vault;
      const userAddress = await signer.getAddress();
      
      // 1. Check current allowance
      const currentAllowance = await usdcContract.allowance(userAddress, vaultAddress);
      console.log('[Wallet] Current allowance:', ethers.formatUnits(currentAllowance, decimals));
      
      // 2. Approve if needed
      if (currentAllowance < amountUnits) {
        console.log('[Wallet] Approving', amount, 'USDC...');
        const approveTx = await usdcContract.approve(vaultAddress, amountUnits);
        await approveTx.wait();
        console.log('[Wallet] Approved! Tx:', approveTx.hash);
      }
      
      // 3. Deposit
      console.log('[Wallet] Depositing', amount, 'USDC to Vault...');
      const depositTx = await vaultContract.depositTokenVault(HSK_TESTNET.contracts.usdc, amountUnits);
      await depositTx.wait();
      
      await refreshBalances(userAddress);
      console.log('[Wallet] Deposited! Tx:', depositTx.hash);
      return depositTx.hash;
    } catch (e) {
      console.error('[Wallet] Deposit error:', e);
      throw e;
    }
  }, [usdcContract, vaultContract, signer, refreshBalances]);

  // Withdraw from Vault
  const withdrawFromVault = useCallback(async (amount) => {
    if (!vaultContract || !signer) throw new Error('No conectado');
    try {
      const decimals = await usdcContract.decimals();
      const amountUnits = ethers.parseUnits(amount.toString(), decimals);
      const tx = await vaultContract.withdrawTokenVault(HSK_TESTNET.contracts.usdc, amountUnits);
      await tx.wait();
      await refreshBalances(await signer.getAddress());
      return tx.hash;
    } catch (e) {
      console.error('[Wallet] Withdraw error:', e);
      throw e;
    }
  }, [vaultContract, usdcContract, signer, refreshBalances]);

  // Send USDC transfer
  const sendUSDC = useCallback(async (to, amount) => {
    if (!usdcContract || !signer) throw new Error('No conectado');
    try {
      // Validate address
      if (!to.startsWith('0x') || to.length !== 42) {
        throw new Error('Dirección inválida. Usa formato 0x... (42 caracteres)');
      }
      
      const decimals = await usdcContract.decimals();
      const amountUnits = ethers.parseUnits(amount.toString(), decimals);
      const tx = await usdcContract.transfer(to, amountUnits);
      await tx.wait();
      await refreshBalances(await signer.getAddress());
      return tx.hash;
    } catch (e) {
      console.error('[Wallet] Transfer error:', e);
      throw e;
    }
  }, [usdcContract, signer, refreshBalances]);

  // Gasless meta-transaction (ERC-2771)
  const sendMetaTransaction = useCallback(async (to, amount) => {
    if (!forwarderContract || !usdcContract || !signer) throw new Error('No conectado');
    try {
      // Validate address
      if (!to.startsWith('0x') || to.length !== 42) {
        throw new Error('Dirección inválida. Usa formato 0x... (42 caracteres)');
      }
      
      const decimals = await usdcContract.decimals();
      const amountUnits = ethers.parseUnits(amount.toString(), decimals);
      
      // Encode transfer call
      const transferData = usdcContract.interface.encodeFunctionData('transfer', [to, amountUnits]);

      // Get nonce
      const nonce = await forwarderContract.getNonce(await signer.getAddress());
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // EIP-712 domain
      const domain = {
        name: 'PollarForwarder',
        version: '1',
        chainId: HSK_TESTNET.chainId,
        verifyingContract: HSK_TESTNET.contracts.forwarder,
      };

      // EIP-712 types
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

      // Sign meta-transaction
      const signature = await signer.signTypedData(domain, types, request);

      // Send to relayer
      const res = await fetch(`${RELAYER_URL}/api/relay/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forwardRequest: request, signature }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      await refreshBalances(await signer.getAddress());
      return result.txHash;
    } catch (e) {
      console.error('[Wallet] Meta-tx error:', e);
      throw e;
    }
  }, [forwarderContract, usdcContract, signer, refreshBalances]);

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
      // State
      wallet,
      currentUser,
      provider,
      signer,
      usdcBalance,
      vaultBalance,
      hskBalance,
      isConnecting,
      error,

      // Connection
      connectWithPrivateKey,
      generateDemoWallet,
      disconnect,

      // Actions
      mintUSDC,
      depositToVault,
      withdrawFromVault,
      sendUSDC,
      sendMetaTransaction,
      refreshBalances,

      // Constants
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
