import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  Lock,
  ArrowRightLeft,
  CheckCircle2,
  Coins,
  RefreshCw,
  Send,
  ArrowDownLeft,
  Key,
  AlertCircle,
  Clock,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  Store,
  Plus
} from 'lucide-react';

export default function WalletVault({ onNavigate, onOpenLinkModal }) {
  const {
    role,
    wallet,
    allocateOfflineFunds,
    returnFundsToMain,
    refreshOnlineBalance,
    requestFriendbotFunding,
    isRefreshingBalance,
    transactions
  } = useWallet();

  const isPayer = role === 'payer';

  const [transferAmount, setTransferAmount] = useState('');
  const [activeAction, setActiveAction] = useState('allocate');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showAllocation, setShowAllocation] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const mainBalance = wallet?.mainBalance || 0;
  const offlineBalance = wallet?.offlineBalance || 0;
  const receivedOffline = wallet?.receivedOffline || 0;
  const asset = wallet?.asset || 'USDT';

  const availableInMain = Math.max(0, mainBalance - offlineBalance);
  const unspentOffline = offlineBalance;
  const usagePercentage = offlineBalance > 0
    ? Math.min(100, (receivedOffline / offlineBalance) * 100)
    : 0;

  const recentTxs = transactions.slice(0, 5);
  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;

  const handleTransfer = (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      if (activeAction === 'allocate') {
        allocateOfflineFunds(transferAmount);
        setFeedback({ type: 'success', message: `${transferAmount} ${asset} bloqueados en Bóveda Offline` });
      } else {
        returnFundsToMain(transferAmount);
        setFeedback({ type: 'success', message: `${transferAmount} ${asset} liberados a Billetera Principal` });
      }
      setTransferAmount('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleQuickPercent = (pct) => {
    if (activeAction === 'allocate') {
      const amt = (availableInMain * pct).toFixed(2);
      setTransferAmount(amt > 0 ? amt : '');
    } else {
      const amt = (unspentOffline * pct).toFixed(2);
      setTransferAmount(amt > 0 ? amt : '');
    }
  };

  const handleFundFriendbot = async () => {
    setIsFunding(true);
    setFeedback({ type: '', message: '' });
    try {
      await requestFriendbotFunding(wallet?.publicKey);
      setFeedback({ type: 'success', message: '¡Recarga Confirmada! +10,000.00 XLM acreditados exitosamente en Stellar Testnet' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al conectar con Friendbot' });
    } finally {
      setIsFunding(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet?.publicKey || '');
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {/* Main Digital eWallet Balance Card */}
      <div style={{
        width: '100%',
        borderRadius: '28px',
        padding: 26,
        color: '#FFFFFF',
        background: isPayer ? 'linear-gradient(135deg, #0050EC 0%, #006AFF 55%, #0095FF 100%)' : 'linear-gradient(135deg, #059669 0%, #10B981 55%, #34D399 100%)',
        boxShadow: isPayer ? '0 12px 28px -4px rgba(0, 98, 255, 0.38)' : '0 12px 28px -4px rgba(16, 185, 129, 0.38)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}>
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 70%)',
          pointerEvents: 'none'
        }} />

        {/* Card Top: Tag + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            padding: '5px 12px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase'
          }}>
            {isPayer ? 'Billetera Pagador' : 'Terminal Comercio'}
          </span>

          <button
            onClick={() => refreshOnlineBalance(wallet?.publicKey)}
            disabled={isRefreshingBalance}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none'
            }}
            title="Actualizar saldo"
          >
            <RefreshCw size={15} className={isRefreshingBalance ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Balance Amount */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>Saldo Total</span>
          <div style={{
            fontSize: 42,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: -1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8
          }}>
            <span>${mainBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: 18, fontWeight: 700, opacity: 0.9 }}>{asset}</span>
          </div>

          <div style={{ fontSize: 12, opacity: 0.85, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Bóveda Offline: <strong>{offlineBalance.toFixed(2)}</strong></span>
            <span>•</span>
            <span>Recibido: <strong>{receivedOffline.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Address Pill */}
        <div onClick={copyAddress} style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 12,
          padding: '8px 12px',
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
            {wallet?.publicKey}
          </span>
          {copiedAddress ? <Check size={14} color="#6EE7B7" /> : <Copy size={14} opacity={0.7} />}
        </div>

        {/* 4 Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingTop: 4 }}>
          <button onClick={() => onNavigate?.('send')} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', color: '#FFFFFF', border: 'none', cursor: 'pointer'
          }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)' }}>
              {isPayer ? <Send size={20} style={{ color: 'var(--pollar-blue)' }} /> : <ArrowDownLeft size={20} style={{ color: 'var(--color-emerald)' }} />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{isPayer ? 'Pagar' : 'Cobrar'}</span>
          </button>

          <button onClick={() => setShowAllocation(!showAllocation)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', color: '#FFFFFF', border: 'none', cursor: 'pointer'
          }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)' }}>
              <Lock size={20} style={{ color: 'var(--pollar-blue)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Bóveda</span>
          </button>

          <button onClick={handleFundFriendbot} disabled={isFunding} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', color: '#FFFFFF', border: 'none', cursor: 'pointer'
          }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)' }}>
              {isFunding ? <RefreshCw size={20} style={{ color: 'var(--color-amber)' }} /> : <Sparkles size={20} style={{ color: 'var(--color-amber)' }} />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>+10k XLM</span>
          </button>

          <button onClick={onOpenLinkModal} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', color: '#FFFFFF', border: 'none', cursor: 'pointer'
          }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.15)' }}>
              <Key size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Vincular</span>
          </button>
        </div>
      </div>

      {/* Offline Vault Allocation Panel (Collapsible) */}
      {showAllocation && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E8EEF5',
          borderRadius: 24,
          padding: 22,
          boxShadow: '0 10px 30px -4px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #E8EEF5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: '#EEF5FF', color: '#0062FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Bóveda Offline</h4>
                <p style={{ fontSize: 11, color: '#64748B' }}>Cupo para pagar sin internet</p>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#0062FF', background: '#EEF5FF', padding: '4px 10px', borderRadius: 20, fontFamily: 'monospace' }}>
              {offlineBalance.toFixed(2)} {asset}
            </span>
          </div>

          <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 14, gap: 4 }}>
            <button
              onClick={() => { setActiveAction('allocate'); setTransferAmount(''); setFeedback({ type: '', message: '' }); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                background: activeAction === 'allocate' ? '#FFFFFF' : 'transparent',
                color: activeAction === 'allocate' ? '#0062FF' : '#64748B',
                boxShadow: activeAction === 'allocate' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                border: 'none', cursor: 'pointer'
              }}
            >
              Bloquear a Bóveda
            </button>
            <button
              onClick={() => { setActiveAction('return'); setTransferAmount(''); setFeedback({ type: '', message: '' }); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800,
                background: activeAction === 'return' ? '#FFFFFF' : 'transparent',
                color: activeAction === 'return' ? '#0062FF' : '#64748B',
                boxShadow: activeAction === 'return' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                border: 'none', cursor: 'pointer'
              }}
            >
              Liberar a Principal
            </button>
          </div>

          <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>
                {activeAction === 'allocate' ? 'Monto a bloquear desde Principal' : 'Monto a liberar a Principal'}
              </label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 14,
                  border: '1px solid #E8EEF5', fontSize: 16, fontWeight: 700,
                  fontFamily: 'monospace', outline: 'none'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                    border: '1px solid #E8EEF5', background: '#FFFFFF', cursor: 'pointer'
                  }}
                >
                  {pct === 1 ? '100%' : `${pct * 100}%`}
                </button>
              ))}
            </div>

            <button type="submit" style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg, #0050EC 0%, #006AFF 100%)',
              color: '#FFFFFF', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: 'none', cursor: 'pointer'
            }}>
              {activeAction === 'allocate' ? <Lock size={16} /> : <Coins size={16} />}
              {activeAction === 'allocate' ? 'Bloquear en Bóveda' : 'Liberar a Principal'}
            </button>
          </form>
        </div>
      )}

      {/* Feedback */}
      {feedback.message && (
        <div style={{
          padding: 14, borderRadius: 14, fontSize: 12, fontWeight: 700,
          background: feedback.type === 'error' ? '#FFF1F2' : '#ECFDF5',
          color: feedback.type === 'error' ? '#F43F5E' : '#10B981',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {feedback.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {feedback.message}
        </div>
      )}

      {/* Recent Transactions */}
      {recentTxs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Transacciones Recientes</h3>
          {recentTxs.slice(0, 3).map((tx, i) => (
            <div key={i} style={{
              background: '#FFFFFF', border: '1px solid #E8EEF5', borderRadius: 18,
              padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: tx.status === 'SYNCED_ONCHAIN' ? '#ECFDF5' : '#FFFBEB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {tx.status === 'SYNCED_ONCHAIN' ? <CheckCircle2 size={20} style={{ color: '#10B981' }} /> : <Clock size={20} style={{ color: '#F59E0B' }} />}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{tx.payload?.memo || 'Pago'}</p>
                  <p style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{tx.payload?.payer?.slice(0, 12)}...</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                ${tx.payload?.amount?.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
