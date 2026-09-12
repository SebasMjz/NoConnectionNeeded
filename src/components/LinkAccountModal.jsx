import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  X,
  Key,
  Wallet,
  Check,
  RefreshCw,
  Sparkles,
  AlertCircle
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

  if (!isOpen) return null;

  const handleLink = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      const result = await linkCustomAccount(inputKey);
      setFeedback({
        type: 'success',
        message: `Vinculada: ${result.balance.toFixed(2)} ${result.asset}`
      });
      setInputKey('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleFund = async () => {
    setIsFunding(true);
    setFeedback({ type: '', message: '' });
    try {
      await requestFriendbotFunding(deviceA.publicKey);
      setFeedback({ type: 'success', message: 'Fondeada: +10,000 XLM Testnet' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
    setIsFunding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0a0e18] border border-[rgba(0,242,254,0.2)] rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[rgba(0,242,254,0.12)] text-[#00f2fe]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Vincular Cuenta</h3>
              <p className="text-[10px] text-[#94a3b8]">Stellar Testnet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[#94a3b8] hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Account */}
        <div className="p-3 rounded-xl bg-[rgba(16,21,34,0.9)] border border-[rgba(255,255,255,0.06)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#94a3b8] uppercase font-semibold">Cuenta actual</span>
            <button
              onClick={refreshOnlineBalance}
              disabled={isRefreshingBalance}
              className="text-[10px] text-[#00f2fe] font-bold flex items-center gap-1"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-xl font-black text-white font-mono">{deviceA.mainBalance.toFixed(2)}</span>
              <span className="text-[10px] font-bold text-[#00f2fe] ml-1">{deviceA.asset}</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.1)] text-[#10b981]">
              Horizon
            </span>
          </div>
          <div className="text-[9px] font-mono text-[#64748b] truncate pt-1.5 border-t border-[rgba(255,255,255,0.04)]">
            {deviceA.publicKey}
          </div>
          <button
            onClick={handleFund}
            disabled={isFunding}
            className="w-full py-2 rounded-lg bg-[rgba(0,242,254,0.08)] hover:bg-[rgba(0,242,254,0.15)] border border-[rgba(0,242,254,0.2)] text-[11px] font-bold text-[#00f2fe] flex items-center justify-center gap-1.5 transition-all"
          >
            {isFunding ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Friendbot (+10k XLM)
          </button>
        </div>

        {/* Link Form */}
        <form onSubmit={handleLink} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-[#94a3b8] block mb-1">
              Clave Secreta (S...) o Pública (G...)
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="S... o G..."
                className="w-full glass-input text-[11px] font-mono py-2.5 pr-9"
                required
              />
              <Key className="w-3.5 h-3.5 text-[#64748b] absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {feedback.message && (
            <div className={`p-2.5 rounded-lg flex items-center gap-2 text-[11px] font-medium ${
              feedback.type === 'success'
                ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981] border border-[rgba(16,185,129,0.2)]'
                : 'bg-[rgba(244,63,94,0.1)] text-[#f43f5e] border border-[rgba(244,63,94,0.2)]'
            }`}>
              {feedback.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5 text-xs">
              Cerrar
            </button>
            <button type="submit" disabled={!inputKey.trim()} className="flex-1 btn-primary py-2.5 text-xs">
              Vincular
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
