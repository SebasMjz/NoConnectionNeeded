import React from 'react';
import { useWallet } from '../context/WalletContext';
import { Settings, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function Header({ onSettings }) {
  const { activeWallet, isOnline } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(activeWallet?.publicKey || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="hsk-header">
      <div className="hsk-header-brand">
        <div className="hsk-logo">P</div>
        <span className="hsk-brand-text">Pollar</span>
      </div>

      <div className="hsk-header-actions">
        <button className="hsk-chain-badge">
          <div className="hsk-chain-dot" style={{ background: isOnline ? '#10B981' : '#EF4444' }} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </button>

        <button className="hsk-icon-btn" onClick={onSettings}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
