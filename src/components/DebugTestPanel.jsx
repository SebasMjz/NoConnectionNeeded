import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { Bug, Send, RefreshCw, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

const TEST_WALLET_A = 'GBYZEHVLC4I7BYS2P7LJKJUJOZHO6A52AWVCA7VR3PSXIY6DFEAPA3UM';
const TEST_WALLET_B = 'GDKRZ33OGCDCPMVQMNMMIJKYALDALFZXXZU65KI7WQGFIYJ6PBUYYKJK';

export default function DebugTestPanel() {
  const { activeWallet, sendDirect } = useWallet();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendTestXLM = async (toLabel, toAddress) => {
    if (!activeWallet) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await sendDirect(toAddress, '1.0000000', `DEBUG-${Date.now()}`);
      setResult({
        success: true,
        hash: res.hash,
        from: activeWallet.publicKey.substring(0, 10) + '...',
        to: toLabel,
        amount: '1.0000000',
        explorer: `https://stellar.expert/explorer/testnet/tx/${res.hash}`,
      });
    } catch (err) {
      setResult({ success: false, message: err.message || 'Error desconocido' });
    } finally {
      setLoading(false);
    }
  };

  if (!activeWallet) return null;

  return (
    <div style={{
      margin: '16px', padding: '16px', borderRadius: 16,
      background: 'rgba(244,63,94,0.08)', border: '1.5px solid rgba(244,63,94,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Bug size={18} color="#f43f5e" />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#f43f5e' }}>DEBUG: Test Directo Stellar</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Wallet Activa:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f43f5e', fontWeight: 700 }}>
            {activeWallet.publicKey}
          </span>
          <button onClick={() => copyKey(activeWallet.publicKey)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            {copied === activeWallet.publicKey ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#64748b" />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => sendTestXLM('Wallet A (GBGI...)', TEST_WALLET_A)}
          disabled={loading || activeWallet.publicKey === TEST_WALLET_A}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 12,
            background: activeWallet.publicKey === TEST_WALLET_A ? '#334155' : '#1e3a5f',
            border: '1px solid rgba(0,242,254,0.3)',
            color: activeWallet.publicKey === TEST_WALLET_A ? '#64748b' : '#00f2fe',
            fontSize: 11, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          {' → GBGI...'}
        </button>
        <button
          onClick={() => sendTestXLM('Wallet B (GBWE...)', TEST_WALLET_B)}
          disabled={loading || activeWallet.publicKey === TEST_WALLET_B}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 12,
            background: activeWallet.publicKey === TEST_WALLET_B ? '#334155' : '#1e3a5f',
            border: '1px solid rgba(0,242,254,0.3)',
            color: activeWallet.publicKey === TEST_WALLET_B ? '#64748b' : '#00f2fe',
            fontSize: 11, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          {' → GBWE...'}
        </button>
      </div>

      {result && (
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
          border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
          fontSize: 11,
        }}>
          {result.success ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 700, marginBottom: 4 }}>
                <CheckCircle2 size={14} />
                <span>¡ÉXITO! 1 XLM enviado de {result.from} → {result.to}</span>
              </div>
              <a href={result.explorer} target="_blank" rel="noopener" style={{ color: '#00f2fe', fontSize: 10, textDecoration: 'underline' }}>
                Ver en Stellar Expert →
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f43f5e', fontWeight: 700 }}>
              <AlertCircle size={14} />
              <span>ERROR: {result.message}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
        Envía 1 XLM directamente via Stellar SDK sin usar la lógica offline.
      </div>
    </div>
  );
}
