import React, { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import AuthGateway from './components/AuthGateway';
import Header from './components/Header';
import BalanceCard from './components/BalanceCard';
import P2P from './components/P2P';
import Sync from './components/Sync';
import Settings from './components/Settings';
import { Send, ArrowDownLeft, RefreshCw, Layers, Settings as SettingsIcon } from 'lucide-react';

function AppContent() {
  const { wallet, currentUser } = useWallet();
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);

  if (!currentUser) {
    return <AuthGateway />;
  }

  const tabs = [
    { id: 'home', label: 'Wallet', icon: Send },
    { id: 'p2p', label: 'P2P', icon: ArrowDownLeft },
    { id: 'sync', label: 'Sync', icon: RefreshCw },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="hsk-app">
      <Header onSettings={() => setShowSettings(true)} />
      
      <main className="hsk-main">
        {activeTab === 'home' && <BalanceCard />}
        {activeTab === 'p2p' && <P2P />}
        {activeTab === 'sync' && <Sync />}
      </main>

      <nav className="hsk-nav">
        <div className="hsk-nav-pill">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => id === 'settings' ? setShowSettings(true) : setActiveTab(id)}
              className={`hsk-nav-tab ${activeTab === id ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span className="hsk-nav-label">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}
