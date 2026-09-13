import React, { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import AuthGateway from './components/AuthGateway';
import PollarLogo from './components/PollarLogo';
import WalletVault from './components/WalletVault';
import P2PPaymentTerminal from './components/P2PPaymentTerminal';
import SyncManager from './components/SyncManager';
import LinkAccountModal from './components/LinkAccountModal';
import SettingsView from './components/SettingsView';
import WalletRegistry from './components/WalletRegistry';
import P2PTransportSelector from './components/P2PTransportSelector';
import {
  Wallet,
  Send,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletRegistryOpen, setIsWalletRegistryOpen] = useState(false);
  const [isTransportOpen, setIsTransportOpen] = useState(false);

  const {
    currentUser,
    logout,
    isOnline,
    isSimulatingOffline,
    setIsSimulatingOffline,
    transactions,
    activeWallet,
  } = useWallet();

  // If user is not authenticated, show the Login Gateway
  if (!currentUser) {
    return <AuthGateway onLoginSuccess={() => setActiveTab('home')} />;
  }

  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;

  const tabs = [
    { id: 'home',    label: 'Bóveda',      icon: Wallet },
    { id: 'send',    label: 'Transferir',   icon: Send },
    { id: 'sync',    label: 'Sincronizar',  icon: RefreshCw },
    { id: 'wallets', label: 'Mis Wallets',  icon: Wallet },
  ];

  return (
    <div className="pollar-app-shell">

      {/* Top Header */}
      <header className="pollar-header">
        <div className="pollar-user-pill">
          {/* Avatar */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: currentUser.avatar ? 'transparent' : 'linear-gradient(135deg, #0062FF, #7c3aed)',
              border: '1.5px solid rgba(0, 98, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 98, 255, 0.1)',
              overflow: 'hidden',
            }}
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
                {(currentUser.name || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Hola,</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name || 'Usuario'}
              </span>
              {currentUser.provider === 'google' && (
                <svg width="12" height="12" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pollar-blue)', letterSpacing: '-0.2px' }}>
                pollar pay
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', padding: '1px 6px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                TESTNET
              </span>
            </div>
          </div>
        </div>

        <div className="pollar-header-actions">
          <button
            onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
            className={`pollar-status-badge ${isOnline ? 'online' : 'offline'}`}
            title={isOnline ? 'Conectado (Click para simular Offline)' : 'Modo Offline (Click para reconectar)'}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="pollar-icon-btn"
            title="Configuración y Perfil"
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt="Avatar"
                style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }}
              />
            ) : (
              <Settings size={18} />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pollar-main-content">
        {activeTab === 'home' && (
          <WalletVault
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenLinkModal={() => setIsLinkModalOpen(true)}
          />
        )}
        {activeTab === 'send' && <P2PPaymentTerminal onOpenTransport={() => setIsTransportOpen(true)} />}
        {activeTab === 'sync' && <SyncManager />}
        {activeTab === 'wallets' && (
          <div style={{ padding: '0 0 16px 0' }}>
            <WalletRegistry onClose={null} embedded={true} />
          </div>
        )}

        <div style={{ height: 60, width: '100%', flexShrink: 0 }} />
      </main>

      {/* Bottom Navigation */}
      <nav className="pollar-bottom-nav-bar">
        <div className="pollar-bottom-nav-pill">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`pollar-nav-tab ${activeTab === id ? (id === 'sync' ? 'active sync-tab' : 'active') : ''}`}
            >
              <div className="pollar-nav-tab-icon-wrap">
                <Icon size={20} />
              </div>
              <span className="pollar-nav-tab-label">{label}</span>

              {id === 'sync' && pendingCount > 0 && (
                <span className="pollar-nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Settings Sheet */}
      {isSettingsOpen && (
        <div className="pollar-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            <SettingsView
              onClose={() => setIsSettingsOpen(false)}
              onNavigateRegistry={() => { setIsSettingsOpen(false); setIsWalletRegistryOpen(true); }}
            />
          </div>
        </div>
      )}

      {/* Wallet Registry Modal */}
      {isWalletRegistryOpen && (
        <div className="pollar-modal-overlay" onClick={() => setIsWalletRegistryOpen(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            <WalletRegistry onClose={() => setIsWalletRegistryOpen(false)} />
          </div>
        </div>
      )}

      {/* Transport Modal */}
      {isTransportOpen && (
        <div className="pollar-modal-overlay" onClick={() => setIsTransportOpen(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            <P2PTransportSelector onClose={() => setIsTransportOpen(false)} />
          </div>
        </div>
      )}

      {/* Link Account Modal */}
      <LinkAccountModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
      />
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
