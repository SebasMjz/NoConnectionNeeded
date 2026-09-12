import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateRealStellarKeypair } from '../services/stellarCrypto';
import {
  X,
  Key,
  Wallet,
  Check,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Copy,
  ExternalLink,
  PlusCircle,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function LinkAccountModal({ isOpen, onClose }) {
  const {
    deviceA,
    linkCustomAccount,
    refreshOnlineBalance,
    requestFriendbotFunding,
    isRefreshingBalance
  } = useWallet();

  const [inputKey, setInputKey] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isFunding, setIsFunding] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleLink = async (e) => {
    e?.preventDefault();
    if (!inputKey.trim()) return;
    setFeedback({ type: '', message: '' });
    try {
      const result = await linkCustomAccount(inputKey.trim());
      setFeedback({
        type: 'success',
        message: `Cuenta vinculada exitosamente. Saldo: ${result.balance.toFixed(2)} ${result.asset}`
      });
      setInputKey('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al vincular clave Stellar' });
    }
  };

  const handleFund = async () => {
    setIsFunding(true);
    setFeedback({ type: '', message: '' });
    try {
      await requestFriendbotFunding(deviceA.publicKey);
      setFeedback({ 
        type: 'success', 
        message: '¡Recarga Confirmada! +10,000.00 XLM recibidos de Friendbot en Stellar Testnet' 
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al solicitar fondos a Friendbot' });
    } finally {
      setIsFunding(false);
    }
  };

  const handleGenerateNew = async () => {
    setIsGenerating(true);
    setFeedback({ type: '', message: '' });
    try {
      const newKeys = generateRealStellarKeypair();
      const res = await linkCustomAccount(newKeys.secretKey);
      await requestFriendbotFunding(newKeys.publicKey);
      setFeedback({
        type: 'success',
        message: `Nueva cuenta generada y fondeada con +10,000 XLM`
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPublicKey = () => {
    navigator.clipboard.writeText(deviceA.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="pollar-modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div 
        className="pollar-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>Vincular Cuenta Stellar</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stellar Horizon Testnet / Soroban</p>
            </div>
          </div>
          <button onClick={onClose} className="pollar-icon-btn">
            <X size={18} />
          </button>
        </div>

        {/* Current Active Account Box */}
        <div style={{
          padding: 16,
          borderRadius: 20,
          background: 'var(--bg-card-muted)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Cuenta Activa (Pagador)
            </span>
            <button
              onClick={() => refreshOnlineBalance(deviceA.publicKey)}
              disabled={isRefreshingBalance}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--pollar-blue)',
                background: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <RefreshCw size={13} className={isRefreshingBalance ? 'animate-spin' : ''} />
              Actualizar Saldo
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                ${deviceA.mainBalance.toFixed(2)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pollar-blue)', marginLeft: 4 }}>
                {deviceA.asset}
              </span>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              background: 'var(--color-emerald-bg)',
              color: 'var(--color-emerald)',
              padding: '3px 8px',
              borderRadius: 12,
              fontFamily: 'var(--font-mono)'
            }}>
              Horizon Live
            </span>
          </div>

          {/* Public Key snippet */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 12,
            background: '#FFFFFF',
            border: '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
              {deviceA.publicKey}
            </span>
            <button onClick={copyPublicKey} style={{ background: 'none', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center' }}>
              {copiedKey ? <Check size={15} color="var(--color-emerald)" /> : <Copy size={15} />}
            </button>
          </div>

          {/* Fondeo Friendbot Button */}
          <button
            onClick={handleFund}
            disabled={isFunding}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 14,
              background: 'var(--color-amber-bg)',
              border: '1.5px solid rgba(245, 158, 11, 0.3)',
              color: '#B45309',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            {isFunding ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Solicitando a Friendbot (+10,000 XLM)...
              </>
            ) : (
              <>
                <Sparkles size={16} color="#D97706" />
                Fondeo Friendbot (+10,000 XLM Testnet)
              </>
            )}
          </button>
        </div>

        {/* Link / Import Form */}
        <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
              Importar Clave Stellar (Secreta S... o Pública G...)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="S... (Firmar) o G... (Solo Lectura)"
                className="pollar-input"
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', paddingRight: 40 }}
                required
              />
              <Key size={16} color="var(--text-light)" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {feedback.message && (
            <div style={{
              padding: 12,
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: feedback.type === 'success' ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
              color: feedback.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)',
              border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)'
            }}>
              {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button
              type="submit"
              disabled={!inputKey.trim()}
              className="pollar-btn-primary"
              style={{ flex: 1 }}
            >
              <Zap size={16} /> Vincular Cuenta
            </button>
            <button
              type="button"
              onClick={handleGenerateNew}
              disabled={isGenerating}
              className="pollar-btn-secondary"
              style={{ flex: 1 }}
            >
              {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              Generar Nueva
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
