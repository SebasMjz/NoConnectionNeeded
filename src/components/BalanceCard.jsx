import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { RefreshCw, Copy, Check, ExternalLink, Send, ArrowDownLeft, Wallet, QrCode } from 'lucide-react';

export default function BalanceCard() {
  const { wallet, refreshBalance, activeEvmChain } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet?.address || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usdcBalance = wallet?.usdcBalance || '0.00';
  const nativeBalance = wallet?.nativeBalance || '0.00';
  const address = wallet?.address || '0x0000...0000';

  const explorerUrls = {
    sepolia: 'https://sepolia.etherscan.io',
    hskTestnet: 'https://hashkeychain-testnet-explorer.alt.technology',
    baseSepolia: 'https://sepolia.basescan.org'
  };

  return (
    <>
      <div className="hsk-balance-card">
        <div className="hsk-balance-top">
          <span className="hsk-balance-label">Total Balance</span>
          <button className="hsk-balance-refresh" onClick={refreshBalance}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="hsk-balance-amount">
          <span>${Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="hsk-balance-currency">USDC</span>
        </div>

        <div className="hsk-balance-address" onClick={copyAddress}>
          <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </div>
      </div>

      <div className="hsk-actions">
        <button className="hsk-action-btn">
          <div className="hsk-action-icon">
            <Send size={20} style={{ color: '#00B386' }} />
          </div>
          <span className="hsk-action-label">Send</span>
        </button>

        <button className="hsk-action-btn">
          <div className="hsk-action-icon">
            <ArrowDownLeft size={20} style={{ color: '#10B981' }} />
          </div>
          <span className="hsk-action-label">Receive</span>
        </button>

        <button className="hsk-action-btn">
          <div className="hsk-action-icon">
            <QrCode size={20} style={{ color: '#0062FF' }} />
          </div>
          <span className="hsk-action-label">QR</span>
        </button>

        <button className="hsk-action-btn">
          <div className="hsk-action-icon">
            <Wallet size={20} style={{ color: '#F59E0B' }} />
          </div>
          <span className="hsk-action-label">Wallets</span>
        </button>
      </div>

      <div className="hsk-card">
        <div className="hsk-card-header">
          <div className="hsk-card-title">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00B386' }} />
            <span>Network</span>
          </div>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {activeEvmChain === 'hskTestnet' ? 'HashKey Testnet' : activeEvmChain}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>Gas Token</span>
          <span style={{ fontSize: 12, color: '#FFFFFF', fontFamily: 'monospace' }}>
            {Number(nativeBalance).toFixed(4)} HSK
          </span>
        </div>

        <a 
          href={`${explorerUrls[activeEvmChain]}/address/${wallet?.address}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', alignItems: 'center', gap: 6, 
            fontSize: 12, color: '#00B386', textDecoration: 'none' 
          }}
        >
          View on Explorer <ExternalLink size={12} />
        </a>
      </div>
    </>
  );
}
