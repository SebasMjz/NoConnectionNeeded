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
  RefreshCw,
  Terminal,
  Store,
  CheckCircle2,
  Layers,
  ArrowRight
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

  const [simAmount, setSimAmount] = useState('2.50');
  const [simMemo, setSimMemo] = useState('Compra Tienda');
  const [log, setLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const availableOfflineA = deviceA.derivedOffline - deviceA.spentOffline;
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
    addLog(`[A] Iniciando pago offline de $${simAmount} ${deviceA.asset} → Comercio B`, 'info');
    try {
      const tx = await createOfflinePayment(deviceB.address || deviceB.publicKey, simAmount, simMemo);
      addLog(`[A] Firma ${deviceA.network === 'evm' ? 'Secp256k1' : 'Ed25519'} generada: ${tx.payerSignature.substring(0, 14)}...`, 'success');
      addLog(`[P2P] Transmitiendo paquete de datos cifrado por canal offline...`, 'p2p');
      
      await new Promise(r => setTimeout(r, 450));
      const finalized = await receiveAndCounterSign(tx, 'device_b');
      addLog(`[B] Contrafirma validada. Merkle Leaf: ${finalized.merkleLeafHash.substring(0, 14)}...`, 'success');
      addLog(`[OK] Handshake bilateral completado con éxito (Nonce #${tx.payload.nonce})`, 'success');
    } catch (err) {
      addLog(`[Error] ${err.message}`, 'error');
    }
    setIsProcessing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

      {/* Simulator Mode Header */}
      <div className="pollar-panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} color="var(--pollar-blue)" /> Simulador Bilateral P2P
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Prueba la firma bilateral ({deviceA.network === 'evm' ? 'Secp256k1' : 'Ed25519'}) y contrafirma entre ambos roles en vivo
            </p>
          </div>
          <button
            onClick={() => setIsSimulatingOffline(!isSimulatingOffline)}
            className={`pollar-status-badge ${isOnline ? 'online' : 'offline'}`}
          >
            <div className="pollar-status-dot" />
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>
        </div>
      </div>

      {/* Devices Overview Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Device A (Payer) */}
        <div className="pollar-panel" style={{ borderLeft: '4px solid var(--pollar-blue)', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={16} />
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>Dispositivo A (Pagador)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {deviceA.publicKey.substring(0, 10)}...{deviceA.publicKey.substring(deviceA.publicKey.length - 4)}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '2px 8px', borderRadius: 12, fontFamily: 'var(--font-mono)' }}>
              Nonce #{deviceA.currentNonce}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--bg-card-muted)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Saldo Principal</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>${deviceA.mainBalance.toFixed(2)}</span>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--pollar-blue-light)', border: '1px solid rgba(0, 98, 255, 0.2)' }}>
              <span style={{ fontSize: 10, color: 'var(--pollar-blue)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Bóveda Offline</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--pollar-blue)', fontFamily: 'var(--font-mono)' }}>${availableOfflineA.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Device B (Merchant POS) */}
        <div className="pollar-panel" style={{ borderLeft: '4px solid var(--color-emerald)', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--color-emerald-bg)', color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={16} />
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>Dispositivo B (Comercio POS)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {deviceB.publicKey.substring(0, 10)}...{deviceB.publicKey.substring(deviceB.publicKey.length - 4)}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-emerald)', background: 'var(--color-emerald-bg)', padding: '2px 8px', borderRadius: 12 }}>
              POS Cobrador
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--bg-card-muted)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Saldo Principal</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>${deviceB.mainBalance.toFixed(2)}</span>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--color-emerald-bg)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: 10, color: 'var(--color-emerald)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Recibido Offline</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-emerald)', fontFamily: 'var(--font-mono)' }}>+${deviceB.receivedOffline.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Simulation Controls Panel */}
      <div className="pollar-panel">
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>Controles de Pago Simulado</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick Amounts */}
          <div style={{ display: 'flex', gap: 8 }}>
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSimAmount(amt)}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  border: simAmount === amt ? '1.5px solid var(--pollar-blue)' : '1px solid var(--border-subtle)',
                  background: simAmount === amt ? 'var(--pollar-blue-light)' : '#FFFFFF',
                  color: simAmount === amt ? 'var(--pollar-blue)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                ${amt}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Monto</label>
              <input
                type="number"
                step="0.01"
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                className="pollar-input"
                style={{ height: 44, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Concepto</label>
              <input
                type="text"
                value={simMemo}
                onChange={(e) => setSimMemo(e.target.value)}
                className="pollar-input"
                style={{ height: 44, fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button
              onClick={handleSimulate}
              disabled={isProcessing || availableOfflineA < parseFloat(simAmount) || parseFloat(simAmount) <= 0}
              className="pollar-btn-primary"
              style={{ flex: 1 }}
            >
              <Send size={16} />
              {isProcessing ? 'Firmando y transmitiendo...' : 'Ejecutar Pago P2P'}
            </button>
            <button
              onClick={() => syncToStellarNetwork('LAB_SYNC')}
              disabled={isSyncing || transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length === 0}
              className="pollar-btn-outline-blue"
              style={{ width: 52, flexShrink: 0 }}
              title="Sincronizar Lote en Stellar"
            >
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Terminal / Handshake Console Log */}
      <div style={{
        background: '#0F172A',
        borderRadius: 24,
        padding: 18,
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <Terminal size={14} /> Consola Criptográfica (NCN Handshake)
          </span>
          <span style={{ fontSize: 10, color: '#64748B', fontFamily: 'var(--font-mono)' }}>{log.length} registros</span>
        </div>

        <div style={{ height: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, paddingRight: 4 }}>
          {log.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748B', paddingTop: 40 }}>
              Pulsa en 'Ejecutar Pago P2P' para ver el protocolo bilateral en tiempo real
            </div>
          ) : (
            log.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#64748B', flexShrink: 0 }}>{item.time}</span>
                <span style={{
                  color: item.type === 'success' ? '#34D399' :
                         item.type === 'p2p' ? '#38BDF8' :
                         item.type === 'error' ? '#F87171' : '#E2E8F0'
                }}>
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
