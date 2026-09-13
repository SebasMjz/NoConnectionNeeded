import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  Smartphone,
  Send,
  ArrowDownLeft,
  Zap,
  WifiOff,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play
} from 'lucide-react';

export default function DualDeviceSimulator() {
  const {
    role,
    wallet,
    createOfflinePayment,
    receiveAndCounterSign,
    isOnline,
    setIsSimulatingOffline,
    isSimulatingOffline,
    syncToStellarNetwork,
    isSyncing,
    transactions
  } = useWallet();

  const [simAmount, setSimAmount] = useState('2.50');
  const [simMemo, setSimMemo] = useState('Compra Tienda');
  const [log, setLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const availableOffline = wallet?.offlineBalance || 0;
  const quickAmounts = ['1.00', '2.50', '5.00', '10.00'];

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
    addLog(`[Simulación] Iniciando pago de $${simAmount} USDT`, 'info');
    try {
      // Step 1: Create payment
      const tx = await createOfflinePayment(wallet?.publicKey, simAmount, simMemo);
      addLog(`[A] Firma Ed25519 generada: ${tx.payerSignature.substring(0, 14)}...`, 'success');
      addLog(`[P2P] Transmitiendo paquete por canal offline...`, 'info');
      
      // Step 2: Simulate network delay
      await new Promise(r => setTimeout(r, 800));
      
      // Step 3: Counter-sign
      const finalized = await receiveAndCounterSign(tx, 'merchant');
      addLog(`[B] Contrafirma validada. Merkle Leaf: ${finalized.merkleLeafHash.substring(0, 14)}...`, 'success');
      addLog(`[OK] Handshake bilateral completado`, 'success');
    } catch (err) {
      addLog(`[Error] ${err.message}`, 'error');
    }
    setIsProcessing(false);
  };

  const handleSync = async () => {
    setIsProcessing(true);
    addLog(`[Sincronizando] Enviando lote a Stellar Testnet...`, 'info');
    try {
      const res = await syncToStellarNetwork();
      addLog(`[OK] Sincronizado en Ledger #${res.stellarLedger}`, 'success');
    } catch (err) {
      addLog(`[Error] ${err.message}`, 'error');
    }
    setIsProcessing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      {/* Simulator Header */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Play size={16} /> Simulador de Pago P2P
          </h3>
          <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            Prueba el flujo completo de pago offline en un solo dispositivo
          </p>
        </div>
        <button
          onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
          style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: isOnline ? '#DCFCE7' : '#FEE2E2',
            color: isOnline ? '#166534' : '#991B1B',
            border: 'none', cursor: 'pointer'
          }}
        >
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span style={{ marginLeft: 4 }}>{isOnline ? 'Online' : 'Offline'}</span>
        </button>
      </div>

      {/* Simulator Controls */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Monto</label>
            <input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid #E2E8F0', fontSize: 14, fontWeight: 600
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Memo</label>
            <input
              type="text"
              value={simMemo}
              onChange={(e) => setSimMemo(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid #E2E8F0', fontSize: 14
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setSimAmount(amt)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer'
              }}
            >
              ${amt}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSimulate}
            disabled={isProcessing}
            style={{
              flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: '#0062FF', color: '#FFFFFF',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}
          >
            {isProcessing ? <RefreshCw size={14} /> : <Zap size={14} />}
            Simular Pago P2P
          </button>
          <button
            onClick={handleSync}
            disabled={isProcessing || transactions.length === 0}
            style={{
              padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: '#F1F5F9', color: '#475569',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <RefreshCw size={14} /> Sync
          </button>
        </div>
      </div>

      {/* Event Log */}
      {log.length > 0 && (
        <div style={{
          background: '#1E293B',
          borderRadius: 12,
          padding: 12,
          maxHeight: 200,
          overflowY: 'auto'
        }}>
          {log.map((entry) => (
            <div key={entry.id} style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: entry.type === 'error' ? '#F87171' : entry.type === 'success' ? '#4ADE80' : '#94A3B8',
              padding: '4px 0',
              borderBottom: '1px solid #334155'
            }}>
              <span style={{ color: '#64748B' }}>{entry.time}</span> {entry.msg}
            </div>
          ))}
        </div>
      )}

      {/* Wallet Info */}
      <div style={{
        background: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Bóveda Offline</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginLeft: 8 }}>
            {availableOffline.toFixed(2)} {wallet?.asset}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Recibido</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#10B981', marginLeft: 8 }}>
            +{(wallet?.receivedOffline || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
