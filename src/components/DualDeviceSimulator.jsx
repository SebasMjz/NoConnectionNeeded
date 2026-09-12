import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  Smartphone,
  Send,
  ArrowDownLeft,
  Zap,
  Lock,
  WifiOff,
  Wifi,
  RefreshCw
} from 'lucide-react';

export default function DualDeviceSimulator() {
  const {
    deviceA,
    deviceB,
    createOfflinePayment,
    receiveAndCounterSign,
    isOnline,
    setIsSimulatingOffline,
    isSimulatingOffline,
    syncToStellarNetwork,
    isSyncing,
    transactions
  } = useWallet();

  const [simAmount, setSimAmount] = useState('3.00');
  const [simMemo, setSimMemo] = useState('Café');
  const [log, setLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const availableOfflineA = deviceA.derivedOffline - deviceA.spentOffline;

  const addLog = (msg, type = 'info') => {
    setLog(prev => [{
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      msg,
      type
    }, ...prev]);
  };

  const handleSimulate = async () => {
    setIsProcessing(true);
    addLog(`[A] Pago offline ${simAmount} USDT → B`, 'info');
    try {
      const tx = await createOfflinePayment(deviceB.stellarAddress || deviceB.publicKey, simAmount, simMemo);
      addLog(`[A] Firma Ed25519: ${tx.payerSignature.substring(0, 12)}...`, 'success');
      addLog(`[P2P] Transmitiendo...`, 'p2p');
      await new Promise(r => setTimeout(r, 500));
      const finalized = await receiveAndCounterSign(tx, 'device_b');
      addLog(`[B] Contrafirma OK. Merkle: ${finalized.merkleLeafHash.substring(0, 12)}...`, 'success');
    } catch (err) {
      addLog(`[Error] ${err.message}`, 'error');
    }
    setIsProcessing(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div className="glass-panel p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#a855f7]" /> Simulador P2P
          </h3>
          <p className="text-[10px] text-[#94a3b8]">Prueba completa de 2 dispositivos</p>
        </div>
        <button
          onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-all ${
            isOnline
              ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981] border-[rgba(16,185,129,0.25)]'
              : 'bg-[rgba(244,63,94,0.1)] text-[#f43f5e] border-[rgba(244,63,94,0.25)]'
          }`}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* Device A */}
      <div className="glass-panel p-4 border-t-2 border-t-[#00f2fe] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#00f2fe]" />
            <span className="text-xs font-bold text-white">Pagador (A)</span>
          </div>
          <span className="text-[9px] font-mono text-[#00f2fe]">Nonce #{deviceA.currentNonce}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-[rgba(10,14,24,0.7)] border border-[rgba(255,255,255,0.04)]">
            <span className="text-[9px] text-[#64748b] uppercase block">Main</span>
            <span className="text-sm font-black text-white font-mono">{deviceA.mainBalance.toFixed(2)}</span>
          </div>
          <div className="p-2 rounded-lg bg-[rgba(0,242,254,0.06)] border border-[rgba(0,242,254,0.2)]">
            <span className="text-[9px] text-[#00f2fe] uppercase font-bold flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Offline
            </span>
            <span className="text-sm font-black text-[#00f2fe] font-mono">{availableOfflineA.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Device B */}
      <div className="glass-panel p-4 border-t-2 border-t-[#10b981] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#10b981]" />
            <span className="text-xs font-bold text-white">Cobrador (B)</span>
          </div>
          <span className="text-[9px] font-mono text-[#10b981]">POS</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-[rgba(10,14,24,0.7)] border border-[rgba(255,255,255,0.04)]">
            <span className="text-[9px] text-[#64748b] uppercase block">Main</span>
            <span className="text-sm font-black text-white font-mono">{deviceB.mainBalance.toFixed(2)}</span>
          </div>
          <div className="p-2 rounded-lg bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.2)]">
            <span className="text-[9px] text-[#10b981] uppercase font-bold flex items-center gap-1">
              <ArrowDownLeft className="w-2.5 h-2.5" /> Recibido
            </span>
            <span className="text-sm font-black text-[#10b981] font-mono">+{deviceB.receivedOffline.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[10px] text-[#94a3b8] mb-0.5 block">Monto</label>
            <input
              type="number"
              step="0.01"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              className="w-full glass-input text-sm font-bold font-mono py-1.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#94a3b8] mb-0.5 block">Concepto</label>
            <input
              type="text"
              value={simMemo}
              onChange={(e) => setSimMemo(e.target.value)}
              className="w-full glass-input text-xs py-1.5"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSimulate}
            disabled={isProcessing || availableOfflineA < parseFloat(simAmount) || parseFloat(simAmount) <= 0}
            className="flex-1 btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isProcessing ? 'Procesando...' : 'Simular Pago P2P'}
          </button>
          <button
            onClick={() => syncToStellarNetwork('LAB_SYNC')}
            disabled={isSyncing || transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length === 0}
            className="px-3 py-2.5 rounded-xl bg-[rgba(16,185,129,0.15)] hover:bg-[rgba(16,185,129,0.25)] text-[#10b981] border border-[rgba(16,185,129,0.25)] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Log Console */}
      <div className="glass-panel p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Consola</h3>
          <span className="text-[9px] text-[#4a5568] font-mono">{log.length}</span>
        </div>
        <div className="h-32 overflow-y-auto space-y-1 font-mono text-[10px] p-2 rounded-lg bg-[rgba(7,9,14,0.9)] border border-[rgba(255,255,255,0.04)]">
          {log.length === 0 ? (
            <div className="text-center text-[#4a5568] py-10">Ejecuta una transacción</div>
          ) : (
            log.map((item) => (
              <div key={item.id} className="flex items-start gap-1.5">
                <span className="text-[#4a5568] shrink-0">{item.time}</span>
                <span className={
                  item.type === 'success' ? 'text-[#10b981]' :
                  item.type === 'p2p' ? 'text-[#00f2fe]' :
                  item.type === 'error' ? 'text-[#f43f5e]' : 'text-[#94a3b8]'
                }>
                  {item.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
