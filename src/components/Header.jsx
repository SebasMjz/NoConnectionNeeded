import React from 'react';
import { useWallet } from '../context/WalletContext';
import { Settings, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function Header({ onSettings }) {
  const { wallet, activeEvmChain, switchEvmChain } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet?.address || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const chainNames = {
    sepolia: 'Sepolia',
    hskTestnet: 'HSK Testnet',
    baseSepolia: 'Base Sepolia'
  };

  return (
    <header className="hsk-header">
      <div className="hsk-header-brand">
        <div className="hsk-logo">P</div>
        <span className="hsk-brand-text">Pollar</span>
      </div>

      <div className="hsk-header-actions">
        <button className="hsk-chain-badge" onClick={() => {
          const chains = ['hskTestnet', 'sepolia', 'baseSepolia'];
          const idx = chains.indexOf(activeEvmChain);
          switchEvmChain(chains[(idx + 1) % chains.length]);
        }}>
          <div className="hsk-chain-dot" />
          <span>{chainNames[activeEvmChain] || 'HSK'}</span>
        </button>

        <button className="hsk-icon-btn" onClick={onSettings}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
