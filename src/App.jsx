import React, { createContext, useContext, useState, useEffect } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { PollarProvider, usePollar } from '@pollar/react';
import '@pollar/react/styles.css';
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

// ─── Pollar SDK config ──────────────────────────────────────────────────────
const IS_MAINNET = (import.meta.env.VITE_STELLAR_NETWORK || '').toLowerCase() === 'mainnet' || (import.meta.env.VITE_STELLAR_NETWORK || '').toLowerCase() === 'public';

const POLLAR_PUBLISHABLE_KEY =
  import.meta.env.VITE_POLLAR_PUBLISHABLE_KEY ||
  import.meta.env.VITE_POLLAR_API_KEY ||
  (IS_MAINNET ? 'pub_mainnet_5271b5fe74e59b646cc25c5bfa0d14e0' : 'pub_testnet_2586cc5061cc4250e34cc3e19a47fb53');

const POLLAR_APP_CONFIG = {
  application: {
    name: 'Pollar Pay',
    network: IS_MAINNET ? 'mainnet' : 'testnet',
    chains: ['stellar'],
  },
  styles: {
    theme: 'light',
    accentColor: '#0062FF',
    emailEnabled: true,
    embeddedWallets: true,
    smartWallet: false,
    providers: {
      google: true,
    },
  },
};

// ─── PollarAuthBridge ───────────────────────────────────────────────────────
// Syncs Pollar SDK auth state into our WalletContext so the rest of
// the app (Bóveda, Terminal P2P, Sync) doesn't need to know about Pollar.
function PollarAuthBridge({ children }) {
  const pollar = usePollar();
  const { currentUser, loginWithOAuth, logout, linkWallet } = useWallet();

  useEffect(() => {
    const { isAuthenticated, wallet, wallets, getClient } = pollar;

    if (isAuthenticated) {
      const client = typeof getClient === 'function' ? getClient() : null;
      const clientWallet = client && typeof client.getWallet === 'function' ? client.getWallet() : null;
      let address = wallet?.address ||
                    clientWallet?.address ||
                    wallets?.[0]?.address ||
                    client?._session?.wallet?.address || null;

      // Intentar obtener el perfil del usuario autenticado en Pollar
      let profile = null;
      try {
        if (client && typeof client.getUserProfile === 'function') {
          profile = client.getUserProfile();
        }
      } catch (e) {
        console.warn('Error fetching Pollar profile:', e);
      }

      const email = profile?.mail || profile?.email || null;
      const firstName = profile?.first_name || '';
      const lastName = profile?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName = fullName || (email ? email.split('@')[0] : (address ? `Pollar (${address.slice(0, 4)}...${address.slice(-4)})` : 'Usuario Pollar'));
      const provider = wallet?.provider || 'pollar';
      const avatar = profile?.avatar || null;

      // 1. Sincronizar el usuario en WalletContext inmediatamente para que esté autenticado
      if (!currentUser || (address && currentUser.pollarId !== address)) {
        loginWithOAuth({
          email,
          name: displayName,
          provider,
          avatar,
          pollarId: address || 'pollar_session',
        });
      }

      // 2. Si no hay address aún, intentar crearla / solicitarla a Pollar SDK
      if (!address && client && typeof client.createAccount === 'function') {
        client.createAccount().then((res) => {
          const newAddress = client.getWallet()?.address || res?.wallet?.address;
          if (newAddress) {
            linkWallet({
              publicKey: newAddress,
              secretKey: null,
              name: 'Billetera Pollar',
              isReadOnly: false,
              isPollar: true,
              provider: 'pollar',
              custody: 'internal',
            }, true);
          }
        }).catch(err => {
          console.warn('Error creating account on Pollar:', err);
        });
      }

      // 3. Vincular y seleccionar automáticamente la wallet asignada por Pollar como la billetera activa
      if (address) {
        linkWallet({
          publicKey: address,
          secretKey: null, // Pollar administra la custodia y firma de la clave on-chain
          name: 'Billetera Pollar',
          isReadOnly: false,
          isPollar: true,
          provider: wallet?.provider || 'pollar',
          custody: wallet?.custody || 'internal',
        }, true); // makeActive = true
      }
    }

    if (!isAuthenticated && currentUser?.provider === 'pollar') {
      logout();
    }
  }, [pollar.isAuthenticated, pollar.wallet?.address, pollar.wallets]);

  return children;
}

// ─── AppContent ─────────────────────────────────────────────────────────────
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

  // Watch Pollar SDK auth state - if authenticated in Pollar or WalletContext, user enters the app
  const pollar = usePollar();
  const isPollarAuthenticated = pollar.isAuthenticated;

  // Show AuthGateway if neither WalletContext nor Pollar has a session
  const isAuthenticated = !!currentUser || isPollarAuthenticated;

  if (!isAuthenticated) {
    return <AuthGateway onLoginSuccess={() => setActiveTab('home')} />;
  }

  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;

  // Effective user: prefer WalletContext (mirrors Pollar) but fall back to Pollar directly
  let profile = null;
  try {
    profile = pollar.getClient?.()?.getUserProfile?.();
  } catch (e) {}

  const pollarName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile?.mail
      ? profile.mail.split('@')[0]
      : pollar.wallet?.address
        ? `Pollar (${pollar.wallet.address.slice(0, 4)}...${pollar.wallet.address.slice(-4)})`
        : 'Usuario';

  const displayUser = currentUser || (pollar.wallet ? {
    name: pollarName,
    email: profile?.mail || null,
    avatar: profile?.avatar || null,
    provider: pollar.wallet.provider || 'pollar',
  } : null);

  const tabs = [
    { id: 'home',    label: 'Bóveda',     icon: Wallet },
    { id: 'send',    label: 'Transferir',  icon: Send },
    { id: 'sync',    label: 'Sincronizar', icon: RefreshCw },
    { id: 'wallets', label: 'Mis Wallets', icon: Wallet },
  ];

  const handleLogout = () => {
    logout();
    if (isPollarAuthenticated) pollar.logout?.();
  };

  return (
    <div className="pollar-app-shell">

      {/* Top Header */}
      <header className="pollar-header">
        <div className="pollar-user-pill">
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: displayUser?.avatar ? 'transparent' : 'linear-gradient(135deg, #0062FF, #7c3aed)',
            border: '1.5px solid rgba(0,98,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,98,255,0.1)',
          }}>
            {displayUser?.avatar ? (
              <img src={displayUser.avatar} alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
                {(displayUser?.name || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Hola,</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayUser?.name || 'Usuario'}
              </span>
              {(displayUser?.provider === 'google' || displayUser?.provider === 'pollar') && (
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
              <span style={{ fontSize: 9, fontWeight: 800, background: IS_MAINNET ? 'rgba(16,185,129,0.12)' : 'var(--pollar-blue-light)', color: IS_MAINNET ? '#059669' : 'var(--pollar-blue)', padding: '1px 6px', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                {IS_MAINNET ? 'MAINNET' : 'TESTNET'}
              </span>
            </div>
          </div>
        </div>

        <div className="pollar-header-actions">
          <button
            onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
            className={`pollar-status-badge ${isOnline ? 'online' : 'offline'}`}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="pollar-icon-btn">
            {displayUser?.avatar ? (
              <img src={displayUser.avatar} alt="Avatar"
                style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
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
              <div className="pollar-nav-tab-icon-wrap"><Icon size={20} /></div>
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
              onLogout={handleLogout}
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

// ─── Root App ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <PollarProvider
      client={{
        apiKey: POLLAR_PUBLISHABLE_KEY,
        stellarNetwork: IS_MAINNET ? 'mainnet' : 'testnet',
      }}
      appConfig={POLLAR_APP_CONFIG}
    >
      <WalletProvider>
        <PollarAuthBridge>
          <AppContent />
        </PollarAuthBridge>
      </WalletProvider>
    </PollarProvider>
  );
}
