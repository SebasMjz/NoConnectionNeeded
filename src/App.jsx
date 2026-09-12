import React, { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import AuthGateway from './components/AuthGateway';
import PollarLogo from './components/PollarLogo';
import WalletVault from './components/WalletVault';
import P2PPaymentTerminal from './components/P2PPaymentTerminal';
import SyncManager from './components/SyncManager';
import DualDeviceSimulator from './components/DualDeviceSimulator';
import LinkAccountModal from './components/LinkAccountModal';
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

  const { 
    currentUser, 
    logout,
    activeDevice, 
    setActiveDevice, 
    isOnline, 
    isSimulatingOffline,
    setIsSimulatingOffline,
    transactions, 
    resetDemoData,
    deviceA,
    deviceB,
    requestFriendbotFunding
  } = useWallet();

  // If user is not authenticated, show the Login Gateway
  if (!currentUser) {
    return <AuthGateway onLoginSuccess={() => setActiveTab('home')} />;
  }

  const currentAccount = activeDevice === 'device_b' ? deviceB : deviceA;
  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;

  const tabs = [
    { id: 'home', label: 'Bóveda', icon: Wallet },
    { id: 'send', label: 'Transferir', icon: Send },
    { id: 'sync', label: 'Sincronizar', icon: RefreshCw },
    { id: 'lab', label: 'Simulador', icon: Layers },
  ];

  return (
    <div className="pollar-app-shell">
      
      {/* Top Header */}
      <header className="pollar-header">
        <div className="pollar-user-pill">
          {/* Official Pollar Bear Brand Badge */}
          <div 
            style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 14, 
              background: '#EEF5FF', 
              border: '1.5px solid rgba(0, 98, 255, 0.18)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 98, 255, 0.1)'
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

      {/* Role Switcher Pill */}
      <div className="pollar-role-bar">
        <div className="pollar-role-container">
          <button
            onClick={() => setActiveDevice('device_a')}
            className={`pollar-role-tab ${activeDevice === 'device_a' ? 'active-payer' : ''}`}
          >
            <Zap size={15} /> Pagador (A)
          </button>
          <button
            onClick={() => setActiveDevice('device_b')}
            className={`pollar-role-tab ${activeDevice === 'device_b' ? 'active-merchant' : ''}`}
          >
            <ArrowRightLeft size={15} /> Comercio POS (B)
          </button>
        </div>
      </div>

      {/* Main Content Area with Bottom Clearance */}
      <main className="pollar-main-content">
        {activeTab === 'home' && (
          <WalletVault 
            onNavigate={(tab) => setActiveTab(tab)} 
            onOpenLinkModal={() => setIsLinkModalOpen(true)} 
          />
        )}
        {activeTab === 'send' && <P2PPaymentTerminal />}
        {activeTab === 'sync' && <SyncManager />}
        {activeTab === 'lab' && <DualDeviceSimulator />}

        {/* Safe Bottom Clearance Spacer so content is never covered by bottom nav */}
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

      {/* User Profile & Settings Bottom Sheet */}
      {isSettingsOpen && (
        <div className="pollar-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt="Avatar" style={{ width: 48, height: 48, borderRadius: 16, objectFit: 'cover' }} />
                ) : (
                  <div className="pollar-user-avatar" style={{ width: 48, height: 48, borderRadius: 16, fontSize: 18 }}>
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{currentUser.name || 'Usuario'}</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {currentUser.email || currentUser.publicKey?.slice(0, 16) + '...'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="pollar-icon-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { setIsLinkModalOpen(true); setIsSettingsOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 18,
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Link2 size={18} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>Vincular Cuenta Stellar</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Importar clave secreta S... o pública G...</span>
                </div>
              </button>

              <button
                onClick={() => { requestFriendbotFunding(deviceA.publicKey); setIsSettingsOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 18,
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--color-amber-bg)', color: 'var(--color-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>Fondeo Friendbot</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+10,000 XLM Testnet gratis</span>
                </div>
              </button>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => { resetDemoData(); setIsSettingsOpen(false); }}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  background: 'var(--color-rose-bg)',
                  color: 'var(--color-rose)',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <RotateCcw size={16} /> Reiniciar
              </button>
              <button
                onClick={() => { logout(); setIsSettingsOpen(false); }}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  background: '#F1F5F9',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <LogOut size={16} /> Salir
              </button>
            </div>
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
