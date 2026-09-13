import React, { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import AuthGateway from './components/AuthGateway';
import PollarLogo from './components/PollarLogo';
import WalletVault from './components/WalletVault';
import P2PPaymentTerminal from './components/P2PPaymentTerminal';
import SyncManager from './components/SyncManager';
import DualDeviceSimulator from './components/DualDeviceSimulator';
import LinkAccountModal from './components/LinkAccountModal';
import SettingsView from './components/SettingsView';
import WalletRegistry from './components/WalletRegistry';
import P2PTransportSelector from './components/P2PTransportSelector';
import {
  Wallet,
  Send,
  RefreshCw,
  Layers,
  Settings,
  Wifi,
  WifiOff,
  Link2,
  RotateCcw,
  LogOut,
  Sparkles,
  Zap,
  ArrowRightLeft,
  X
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
    role,
    setRole,
    isOnline,
    isSimulatingOffline,
    setIsSimulatingOffline,
    transactions,
    resetDemoData,
    wallet,
    requestFriendbotFunding,
    pendingTx
  } = useWallet();

  const isPayer = role === 'payer';

  // If user is not authenticated, show the Login Gateway
  if (!currentUser) {
    return <AuthGateway onLoginSuccess={() => setActiveTab('home')} />;
  }

  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;

  const tabs = [
    { id: 'home', label: 'Bóveda', icon: Wallet },
    { id: 'send', label: isPayer ? 'Pagar' : 'Cobrar', icon: isPayer ? Send : ArrowRightLeft },
    { id: 'sync', label: 'Sincronizar', icon: RefreshCw },
    { id: 'lab', label: 'Simulador', icon: Layers },
  ];

  return (
    <div className="pollar-app-shell">
      
      {/* Top Header */}
      <header className="pollar-header">
        <div className="pollar-user-pill">
          <div 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 14, 
              background: isPayer ? '#EEF5FF' : '#ECFDF5',
              border: `1.5px solid ${isPayer ? 'rgba(0, 98, 255, 0.18)' : 'rgba(16, 185, 129, 0.18)'}`,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              boxShadow: `0 2px 8px ${isPayer ? 'rgba(0, 98, 255, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`
            }}
          >
            <PollarLogo size={26} showText={false} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Hola,</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name || 'Usuario'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, background: isPayer ? 'var(--pollar-blue-light)' : 'var(--color-emerald-bg)', color: isPayer ? 'var(--pollar-blue)' : 'var(--color-emerald)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                {isPayer ? 'PAGADOR (A)' : 'COMERCIO (B)'}
              </span>
            </div>
          </div>
        </div>

        <div className="pollar-header-actions">
          <button
            onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
            className={`pollar-status-badge ${isOnline ? 'online' : 'offline'}`}
            title={isOnline ? 'Conectado (Click para probar Offline)' : 'Modo Offline (Click para probar Online)'}
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

      {/* Role Switcher */}
      <div style={{ padding: '12px 20px 0 20px' }}>
        <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 16, gap: 4 }}>
          <button
            onClick={() => setRole('payer')}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: isPayer ? '#FFFFFF' : 'transparent',
              color: isPayer ? 'var(--pollar-blue)' : 'var(--text-muted)',
              boxShadow: isPayer ? '0 2px 8px rgba(0, 98, 255, 0.15)' : 'none',
              border: 'none', cursor: 'pointer'
            }}
          >
            <Zap size={15} /> Pagador (A)
          </button>
          <button
            onClick={() => setRole('merchant')}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: !isPayer ? '#FFFFFF' : 'transparent',
              color: !isPayer ? 'var(--color-emerald)' : 'var(--text-muted)',
              boxShadow: !isPayer ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none',
              border: 'none', cursor: 'pointer'
            }}
          >
            <ArrowRightLeft size={15} /> Comercio (B)
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="pollar-main-content">
        {activeTab === 'home' && (
          <WalletVault 
            onNavigate={(tab) => setActiveTab(tab)} 
            onOpenLinkModal={() => setIsLinkModalOpen(true)} 
          />
        )}
        {activeTab === 'send' && <P2PPaymentTerminal onOpenTransport={() => setIsTransportOpen(true)} />}
        {activeTab === 'sync' && <SyncManager />}
        {activeTab === 'lab' && <DualDeviceSimulator />}

        {/* Safe Bottom Clearance Spacer */}
        <div style={{ height: 60, width: '100%', flexShrink: 0 }} />
      </main>

      {/* Modern Bottom Navigation Bar */}
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
                <span className="pollar-nav-badge">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Settings Bottom Sheet */}
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

      {/* Transport Selector Modal */}
      {isTransportOpen && (
        <div className="pollar-modal-overlay" onClick={() => setIsTransportOpen(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            <P2PTransportSelector onClose={() => setIsTransportOpen(false)} payload={pendingTx} />
          </div>
        </div>
      )}

      {/* Modals */}
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
