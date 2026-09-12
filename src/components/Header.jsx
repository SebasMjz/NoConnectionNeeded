import React from 'react';
import { useWallet } from '../context/WalletContext';
import { 
  Wifi, 
  WifiOff, 
  Cpu, 
  Smartphone, 
  RefreshCw, 
  Layers, 
  Zap, 
  ShieldCheck, 
  Wallet, 
  Key, 
  Copy, 
  Check 
} from 'lucide-react';

export default function Header({ onOpenLinkModal, onOpenAndroidModal }) {
  const { 
    isOnline, 
    isSimulatingOffline, 
    setIsSimulatingOffline, 
    activeDevice, 
    setActiveDevice,
    deviceA,
    deviceB,
    refreshOnlineBalance,
    isRefreshingBalance,
    transactions
  } = useWallet();

  const [copiedKey, setCopiedKey] = React.useState(false);
  const currentAccount = activeDevice === 'device_b' ? deviceB : deviceA;

  const copyAddress = () => {
    navigator.clipboard.writeText(currentAccount.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <header className="w-full border-b border-[rgba(255,255,255,0.08)] bg-[rgba(10,14,24,0.92)] backdrop-blur-xl sticky top-0 z-40">
      
      {/* Mobile-Style Top Status Bar */}
      <div className="max-w-md mx-auto sm:max-w-7xl px-4 pt-2.5 pb-2 flex items-center justify-between text-[11px] text-[#94a3b8] border-b border-[rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-tight text-white flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#00f2fe]" /> POLLAR PAY
          </span>
          <span className="px-1.5 py-0.2 rounded bg-[rgba(0,242,254,0.12)] text-[#00f2fe] font-mono font-bold text-[10px]">
            TESTNET
          </span>
        </div>

        {/* Network & Battery Status */}
        <div className="flex items-center gap-2.5 font-mono text-[10px]">
          <button
            onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
              isOnline
                ? 'bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.4)] text-[#10b981]'
                : 'bg-[rgba(244,63,94,0.15)] border-[rgba(244,63,94,0.4)] text-[#f43f5e] animate-pulse font-bold'
            }`}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? 'Online' : 'Modo Offline'}</span>
          </button>
        </div>
      </div>

      {/* Main Account & Device Bar */}
      <div className="max-w-md mx-auto sm:max-w-7xl px-4 py-2.5 flex items-center justify-between gap-3">
        
        {/* Linked Account Address Pill */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={copyAddress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.08)] text-xs transition-all max-w-[190px] sm:max-w-xs truncate"
            title="Copiar Clave Pública Stellar (G...)"
          >
            <Wallet className="w-3.5 h-3.5 text-[#00f2fe] shrink-0" />
            <span className="font-mono text-white font-semibold truncate text-[11px]">
              {currentAccount.publicKey.substring(0, 6)}...{currentAccount.publicKey.substring(currentAccount.publicKey.length - 4)}
            </span>
            {copiedKey ? <Check className="w-3 h-3 text-[#10b981] shrink-0" /> : <Copy className="w-3 h-3 text-[#64748b] shrink-0" />}
          </button>

          <button
            onClick={onOpenLinkModal}
            className="px-2.5 py-1.5 rounded-xl bg-[rgba(0,242,254,0.15)] hover:bg-[rgba(0,242,254,0.25)] border border-[rgba(0,242,254,0.3)] text-xs font-bold text-[#00f2fe] flex items-center gap-1 transition-all"
            title="Vincular tu propia cuenta Stellar"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vincular Cuenta</span>
          </button>
        </div>

        {/* Profile / Role Selector */}
        <div className="flex items-center bg-[rgba(16,21,34,0.95)] p-1 rounded-xl border border-[rgba(255,255,255,0.08)]">
          <button
            onClick={() => setActiveDevice('device_a')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeDevice === 'device_a'
                ? 'bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#07090e] shadow-[0_2px_8px_rgba(0,242,254,0.3)]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Pagador
          </button>
          <button
            onClick={() => setActiveDevice('device_b')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeDevice === 'device_b'
                ? 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Comercio
          </button>
        </div>

      </div>
    </header>
  );
}
