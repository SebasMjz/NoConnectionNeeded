import React, { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import WalletVault from './components/WalletVault';
import P2PPaymentTerminal from './components/P2PPaymentTerminal';
import SyncManager from './components/SyncManager';
import DualDeviceSimulator from './components/DualDeviceSimulator';
import AndroidExportModal from './components/AndroidExportModal';
import LinkAccountModal from './components/LinkAccountModal';
import {
  Home,
  Send,
  RefreshCw,
  Layers,
  Settings,
  Wifi,
  WifiOff,
  Link2,
  Smartphone,
  RotateCcw
} from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { activeDevice, setActiveDevice, isOnline, transactions, resetDemoData } = useWallet();

  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;

  const tabs = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'send', label: 'Enviar', icon: Send },
    { id: 'sync', label: 'Sincronizar', icon: RefreshCw },
    { id: 'lab', label: 'Lab', icon: Layers },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white selection:bg-[#00f2fe] selection:text-[#07090e]">

      {/* Top Status Bar */}
      <div className="w-full bg-[rgba(10,14,24,0.95)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.06)] px-4 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-tight text-white text-sm">POLLAR</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-[rgba(0,242,254,0.12)] text-[#00f2fe] font-mono font-bold">
            TESTNET
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="p-1.5 rounded-lg bg-[rgba(0,242,254,0.1)] hover:bg-[rgba(0,242,254,0.2)] text-[#00f2fe] transition-all"
            title="Vincular cuenta"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[#94a3b8] hover:text-white transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Device Role Switcher */}
      <div className="w-full bg-[rgba(10,14,24,0.8)] border-b border-[rgba(255,255,255,0.04)] px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center bg-[rgba(16,21,34,0.95)] p-0.5 rounded-lg border border-[rgba(255,255,255,0.06)]">
          <button
            onClick={() => setActiveDevice('device_a')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
              activeDevice === 'device_a'
                ? 'bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#07090e]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Pagador
          </button>
          <button
            onClick={() => setActiveDevice('device_b')}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
              activeDevice === 'device_b'
                ? 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Comercio
          </button>
        </div>

        <span className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-1 rounded-full border ${
          isOnline
            ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981] border-[rgba(16,185,129,0.25)]'
            : 'bg-[rgba(244,63,94,0.1)] text-[#f43f5e] border-[rgba(244,63,94,0.25)]'
        }`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {activeTab === 'home' && <WalletVault />}
        {activeTab === 'send' && <P2PPaymentTerminal />}
        {activeTab === 'sync' && <SyncManager />}
        {activeTab === 'lab' && <DualDeviceSimulator />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[rgba(10,14,24,0.95)] backdrop-blur-2xl border-t border-[rgba(255,255,255,0.08)] px-2 py-1.5 safe-area-pb">
        <div className="flex items-center justify-around">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all min-w-[60px] ${
                activeTab === id
                  ? id === 'sync'
                    ? 'text-[#10b981]'
                    : id === 'lab'
                    ? 'text-[#a855f7]'
                    : 'text-[#00f2fe]'
                  : 'text-[#64748b]'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${
                activeTab === id
                  ? id === 'sync'
                    ? 'bg-[rgba(16,185,129,0.15)]'
                    : id === 'lab'
                    ? 'bg-[rgba(168,85,247,0.15)]'
                    : 'bg-[rgba(0,242,254,0.15)]'
                  : ''
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">{label}</span>
              {id === 'sync' && pendingCount > 0 && (
                <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_6px_#f59e0b]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Settings Dropdown */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setIsSettingsOpen(false)}>
          <div className="absolute top-20 right-4 w-64 glass-panel p-3 space-y-1 bg-[#0a0e18] border border-[rgba(0,242,254,0.2)] shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setIsLinkModalOpen(true); setIsSettingsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-white hover:bg-[rgba(0,242,254,0.1)] transition-all"
            >
              <Link2 className="w-4 h-4 text-[#00f2fe]" />
              Vincular Cuenta Stellar
            </button>
            <button
              onClick={() => { setIsAndroidModalOpen(true); setIsSettingsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-white hover:bg-[rgba(0,242,254,0.1)] transition-all"
            >
              <Smartphone className="w-4 h-4 text-[#10b981]" />
              Exportar APK Android
            </button>
            <button
              onClick={() => { resetDemoData(); setIsSettingsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-[#f43f5e] hover:bg-[rgba(244,63,94,0.1)] transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar Demo
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <LinkAccountModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
      />
      <AndroidExportModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
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
