import React, { createContext, useContext, useState, useEffect } from 'react';

const WalletContext = createContext();

const EVM_NETWORKS = {
  hskTestnet: {
    id: 'hskTestnet',
    name: 'HashKey Chain Testnet',
    chainId: 133,
    rpcUrl: 'https://hashkeychain-testnet.alt.technology',
    blockExplorer: 'https://hashkeychain-testnet-explorer.alt.technology',
    symbol: 'HSK',
    usdcAddress: '',
  },
  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.etherscan.io',
    symbol: 'ETH',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  baseSepolia: {
    id: 'baseSepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    symbol: 'ETH',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  }
};

export function WalletProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pollar_auth_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [wallet, setWallet] = useState(() => {
    try {
      const saved = localStorage.getItem('pollar_wallet');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      address: '',
      privateKey: '',
      usdcBalance: '0.00',
      nativeBalance: '0.00',
    };
  });

  const [activeEvmChain, setActiveEvmChain] = useState('hskTestnet');
  const [transactions, setTransactions] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const refreshBalance = async () => {
    if (!wallet?.address) return;
    setBalanceLoading(true);
    
    try {
      // Simplified balance fetch without ethers for now
      // In production, use ethers.JsonRpcProvider
      const network = EVM_NETWORKS[activeEvmChain];
      const response = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [wallet.address, 'latest'],
          id: 1
        })
      });
      const data = await response.json();
      
      if (data.result) {
        const wei = parseInt(data.result, 16);
        const eth = wei / 1e18;
        setWallet(prev => ({
          ...prev,
          nativeBalance: eth.toFixed(4),
          usdcBalance: '100.00', // Placeholder until ERC20 integration
        }));
      }
    } catch (e) {
      console.warn('Error refreshing balance:', e);
    } finally {
      setBalanceLoading(false);
    }
  };

  const switchEvmChain = (chain) => {
    setActiveEvmChain(chain);
    setTimeout(() => refreshBalance(), 100);
  };

  const generateDemoWallet = () => {
    // Simple address generation for demo
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) address += chars[Math.floor(Math.random() * 16)];
    return { address, privateKey: '0x' + Array(64).fill(0).map(() => chars[Math.floor(Math.random() * 16)]).join('') };
  };

  const login = (privateKey) => {
    // Simplified login for demo
    const wallet = generateDemoWallet();
    const user = {
      address: wallet.address,
      name: `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`,
    };
    setCurrentUser(user);
    setWallet(prev => ({ ...prev, address: wallet.address, privateKey }));
    localStorage.setItem('pollar_auth_user', JSON.stringify(user));
    localStorage.setItem('pollar_wallet', JSON.stringify(wallet));
    return user;
  };

  const loginAsDemo = () => {
    const wallet = generateDemoWallet();
    const user = {
      address: wallet.address,
      name: 'Demo Wallet',
    };
    setCurrentUser(user);
    setWallet(prev => ({ ...prev, address: wallet.address, privateKey: wallet.privateKey }));
    localStorage.setItem('pollar_auth_user', JSON.stringify(user));
    localStorage.setItem('pollar_wallet', JSON.stringify(wallet));
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    setWallet({ address: '', privateKey: '', usdcBalance: '0.00', nativeBalance: '0.00' });
    localStorage.removeItem('pollar_auth_user');
    localStorage.removeItem('pollar_wallet');
  };

  return (
    <WalletContext.Provider value={{
      currentUser,
      wallet,
      activeEvmChain,
      transactions,
      isSyncing,
      balanceLoading,
      login,
      loginAsDemo,
      logout,
      refreshBalance,
      switchEvmChain,
      EVM_NETWORKS,
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
