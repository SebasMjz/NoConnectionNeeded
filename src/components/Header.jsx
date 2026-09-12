import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Zap, 
  Wallet, 
  Key, 
  Copy, 
  Check,
  ChevronDown,
  Globe,
  Layers
} from 'lucide-react';
import { EVM_NETWORKS } from '../services/evmCrypto';

export default function Header({ onOpenLinkModal, onOpenAndroidModal }) {
  const { 
    isOnline, 
    isSimulatingOffline, 
    setIsSimulatingOffline, 
    activeDevice, 
    setActiveDevice,
    deviceA,
    deviceB,
    activeNetwork,
    switchNetwork,
    activeEvmChain,
    switchEvmChain,
    isEvm
  } = useWallet();

  const [copiedKey, setCopiedKey] = useState(false);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const currentAccount = activeDevice === 'device_b' ? deviceB : deviceA;

  const copyAddress = () => {
    navigator.clipboard.writeText(currentAccount.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const currentEvmNetwork = EVM_NETWORKS[activeEvmChain] || EVM_NETWORKS.sepolia;

  return (
    <header className="w-full border-b border-[rgba(255,255,255,0.08)] bg-[rgba(10,14,24,0.92)] backdrop-blur-xl sticky top-0 z-40">
      
      {/* Mobile-Style Top Status Bar */}
      <div className="max-w-md mx-auto sm:max-w-7xl px-4 pt-2.5 pb-2 flex items-center justify-between text-[11px] text-[#94a3b8] border-b border-[rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-tight text-white flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#00f2fe]" /> POLLAR PAY
          </span>

          {/* Network Selector Button */}
          <div className="relative">
            <button
              onClick={() => setShowNetworkMenu(!showNetworkMenu)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[rgba(0,242,254,0.12)] hover:bg-[rgba(0,242,254,0.2)] text-[#00f2fe] font-mono font-bold text-[10px] border border-[rgba(0,242,254,0.25)] transition-all cursor-pointer"
              title="Cambiar Red Blockchain (EVM Sepolia / Stellar)"
            >
              <Globe className="w-2.5 h-2.5" />
              <span>{isEvm ? `EVM: ${currentEvmNetwork.name}` : 'STELLAR TESTNET'}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-70" />
            </button>

            {/* Dropdown Menu */}
            {showNetworkMenu && (
              <div 
                className="absolute left-0 mt-1.5 w-60 rounded-xl bg-[#0e1424] border border-[rgba(0,242,254,0.3)] shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-[11px]"
                onMouseLeave={() => setShowNetworkMenu(false)}
              >
                <div className="px-2 py-1 text-[9px] font-mono font-bold text-[#64748b] uppercase tracking-wider">
                  Redes Compatibles
                </div>

                {/* EVM Sepolia */}
                <button
                  onClick={() => {
                    switchNetwork('evm');
                    switchEvmChain('sepolia');
                    setShowNetworkMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isEvm && activeEvmChain === 'sepolia'
                      ? 'bg-[rgba(0,242,254,0.15)] text-[#00f2fe] font-bold border border-[rgba(0,242,254,0.3)]'
                      : 'text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#627EEA]" />
                    <span>Ethereum Sepolia (EVM)</span>
                  </div>
                  {isEvm && activeEvmChain === 'sepolia' && <Check className="w-3 h-3 text-[#00f2fe]" />}
                </button>

                {/* EVM HashKey Testnet */}
                <button
                  onClick={() => {
                    switchNetwork('evm');
                    switchEvmChain('hskTestnet');
                    setShowNetworkMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isEvm && activeEvmChain === 'hskTestnet'
                      ? 'bg-[rgba(0,242,254,0.15)] text-[#00f2fe] font-bold border border-[rgba(0,242,254,0.3)]'
                      : 'text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00f2fe]" />
                    <span>HashKey Chain (HSK)</span>
                  </div>
                  {isEvm && activeEvmChain === 'hskTestnet' && <Check className="w-3 h-3 text-[#00f2fe]" />}
                </button>

                {/* EVM Base Sepolia */}
                <button
                  onClick={() => {
                    switchNetwork('evm');
                    switchEvmChain('baseSepolia');
                    setShowNetworkMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isEvm && activeEvmChain === 'baseSepolia'
                      ? 'bg-[rgba(0,242,254,0.15)] text-[#00f2fe] font-bold border border-[rgba(0,242,254,0.3)]'
                      : 'text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#0052FF]" />
                    <span>Base Sepolia (L2)</span>
                  </div>
                  {isEvm && activeEvmChain === 'baseSepolia' && <Check className="w-3 h-3 text-[#00f2fe]" />}
                </button>

                <div className="h-[1px] bg-[rgba(255,255,255,0.06)] my-1" />

                {/* Stellar Testnet */}
                <button
                  onClick={() => {
                    switchNetwork('stellar');
                    setShowNetworkMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    !isEvm
                      ? 'bg-[rgba(0,242,254,0.15)] text-[#00f2fe] font-bold border border-[rgba(0,242,254,0.3)]'
                      : 'text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                    <span>Stellar Testnet (Ed25519)</span>
                  </div>
                  {!isEvm && <Check className="w-3 h-3 text-[#00f2fe]" />}
                </button>
              </div>
            )}
          </div>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.08)] text-xs transition-all max-w-[200px] sm:max-w-xs truncate"
            title={`Copiar Clave ${isEvm ? 'EVM (0x...)' : 'Stellar (G...)'}`}
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
            title="Vincular tu propia cuenta"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vincular</span>
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
