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
  Zap
} from 'lucide-react';

export default function WalletVault({ onNavigate, onOpenLinkModal }) {
  const {
    deviceA,
    allocateOfflineFunds,
    returnFundsToMain,
    refreshOnlineBalance,
    requestFriendbotFunding,
    isRefreshingBalance,
    transactions
  } = useWallet();

  const [transferAmount, setTransferAmount] = useState('');
  const [activeAction, setActiveAction] = useState('allocate');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showAllocation, setShowAllocation] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const availableInMain = Math.max(0, deviceA.mainBalance - deviceA.derivedOffline);
  const unspentOffline = Math.max(0, deviceA.derivedOffline - deviceA.spentOffline);
  const usagePercentage = deviceA.derivedOffline > 0
    ? Math.min(100, (deviceA.spentOffline / deviceA.derivedOffline) * 100)
    : 0;

  const recentTxs = transactions.slice(0, 5);
  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;
  const totalPending = transactions
    .filter(t => t.status !== 'SYNCED_ONCHAIN')
    .reduce((acc, t) => acc + t.payload.amount, 0);

  const handleTransfer = (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      if (activeAction === 'allocate') {
        allocateOfflineFunds(transferAmount);
        setFeedback({ type: 'success', message: `${transferAmount} ${deviceA.asset} asignados a Bóveda Offline` });
      } else {
        returnFundsToMain(transferAmount);
        setFeedback({ type: 'success', message: `${transferAmount} ${deviceA.asset} devueltos a Billetera Principal` });
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

  const copyAddress = () => {
    navigator.clipboard.writeText(deviceA.publicKey);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">

      {/* Main Wallet Card */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#0e1626] via-[#101b33] to-[#07090e] border border-[rgba(0,242,254,0.25)] shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-[rgba(0,242,254,0.12)] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-[rgba(121,40,202,0.15)] blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#00f2fe] uppercase tracking-wider">Saldo On-Chain</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
            </div>
            <button
              onClick={refreshOnlineBalance}
              disabled={isRefreshingBalance}
              className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[#94a3b8] hover:text-white transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin text-[#00f2fe]' : ''}`} />
            </button>
          </div>

          {/* Balance */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white font-mono tracking-tight">
                {deviceA.mainBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-base font-bold text-[#00f2fe]">{deviceA.asset}</span>
            </div>
            <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5">
              Libre: <strong className="text-white">{availableInMain.toFixed(2)}</strong> · Bloqueado: <strong className="text-[#f59e0b]">{deviceA.derivedOffline.toFixed(2)}</strong>
            </p>
          </div>

          {/* Address */}
          <button
            onClick={copyAddress}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.06)] text-[10px] font-mono hover:bg-[rgba(0,0,0,0.5)] transition-all"
          >
            <span className="text-[#94a3b8] truncate">{deviceA.publicKey}</span>
            {copiedAddress ? <Check className="w-3 h-3 text-[#10b981] shrink-0" /> : <Copy className="w-3 h-3 text-[#64748b] shrink-0" />}
          </button>

          {/* Vault Sub-Card */}
          <div className="p-3.5 rounded-xl bg-[rgba(0,0,0,0.4)] border border-[rgba(0,242,254,0.15)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#00f2fe] font-bold flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Bóveda Offline
              </span>
              <span className="font-mono text-[11px] font-black text-gradient-cyan">
                {unspentOffline.toFixed(2)} disponible
              </span>
            </div>
            <div className="w-full bg-[rgba(255,255,255,0.06)] h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#00f2fe] to-[#f43f5e]"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-[#64748b] font-mono">
              <span>Gastado: {deviceA.spentOffline.toFixed(2)}</span>
              <span>Nonce: #{deviceA.currentNonce}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          onClick={() => onNavigate?.('send')}
          className="p-3 rounded-xl bg-[rgba(16,21,34,0.85)] hover:bg-[rgba(16,21,34,1)] border border-[rgba(255,255,255,0.06)] flex flex-col items-center gap-1.5 transition-all group"
        >
          <div className="p-2 rounded-lg bg-[rgba(0,242,254,0.15)] text-[#00f2fe] group-hover:scale-110 transition-transform">
            <Send className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-white">Pagar</span>
        </button>

        <button
          onClick={() => onNavigate?.('send')}
          className="p-3 rounded-xl bg-[rgba(16,21,34,0.85)] hover:bg-[rgba(16,21,34,1)] border border-[rgba(255,255,255,0.06)] flex flex-col items-center gap-1.5 transition-all group"
        >
          <div className="p-2 rounded-lg bg-[rgba(16,185,129,0.15)] text-[#10b981] group-hover:scale-110 transition-transform">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-white">Cobrar</span>
        </button>

        <button
          onClick={onOpenLinkModal}
          className="p-3 rounded-xl bg-[rgba(16,21,34,0.85)] hover:bg-[rgba(16,21,34,1)] border border-[rgba(255,255,255,0.06)] flex flex-col items-center gap-1.5 transition-all group"
        >
          <div className="p-2 rounded-lg bg-[rgba(168,85,247,0.15)] text-[#a855f7] group-hover:scale-110 transition-transform">
            <Key className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-white">Vincular</span>
        </button>

        <button
          onClick={() => requestFriendbotFunding()}
          className="p-3 rounded-xl bg-[rgba(16,21,34,0.85)] hover:bg-[rgba(16,21,34,1)] border border-[rgba(255,255,255,0.06)] flex flex-col items-center gap-1.5 transition-all group"
        >
          <div className="p-2 rounded-lg bg-[rgba(245,158,11,0.15)] text-[#f59e0b] group-hover:scale-110 transition-transform">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold text-white">+10k XLM</span>
        </button>
      </div>

      {/* Allocation Panel */}
      <div className="glass-panel overflow-hidden">
        <button
          onClick={() => setShowAllocation(!showAllocation)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#00f2fe]" />
            <span className="text-sm font-bold text-white">Derivación de Saldo</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-[#64748b] transition-transform ${showAllocation ? 'rotate-90' : ''}`} />
        </button>

        {showAllocation && (
          <div className="px-4 pb-4 space-y-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
            <div className="flex rounded-lg bg-[rgba(10,14,24,0.9)] p-0.5 border border-[rgba(255,255,255,0.06)]">
              <button
                onClick={() => { setActiveAction('allocate'); setTransferAmount(''); setFeedback({ type: '', message: '' }); }}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                  activeAction === 'allocate'
                    ? 'bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#07090e]'
                    : 'text-[#94a3b8]'
                }`}
              >
                Bloquear
              </button>
              <button
                onClick={() => { setActiveAction('return'); setTransferAmount(''); setFeedback({ type: '', message: '' }); }}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                  activeAction === 'return'
                    ? 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white'
                    : 'text-[#94a3b8]'
                }`}
              >
                Liberar
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-2.5">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full glass-input text-lg font-mono font-bold pr-14 py-2"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00f2fe]">
                  {deviceA.asset}
                </span>
              </div>

              <div className="flex gap-1.5">
                {[0.25, 0.50, 0.75, 1.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleQuickPercent(pct)}
                    className="flex-1 py-1 rounded-md bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.06)] text-[10px] font-mono font-bold text-[#94a3b8] hover:text-white transition-all"
                  >
                    {pct * 100}%
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeAction === 'allocate' ? 'btn-primary' : 'btn-emerald'
                }`}
              >
                {activeAction === 'allocate' ? 'Asignar a Bóveda' : 'Devolver a Principal'}
              </button>

              {feedback.message && (
                <div className={`p-2.5 rounded-lg flex items-center gap-2 text-[11px] font-medium ${
                  feedback.type === 'success'
                    ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981] border border-[rgba(16,185,129,0.25)]'
                    : 'bg-[rgba(244,63,94,0.12)] text-[#f43f5e] border border-[rgba(244,63,94,0.25)]'
                }`}>
                  {feedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{feedback.message}</span>
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Pending Summary */}
      {pendingCount > 0 && (
        <div className="glass-panel p-4 flex items-center justify-between border-l-4 border-l-[#f59e0b]">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[#f59e0b]" />
            <div>
              <span className="text-xs font-bold text-white block">{pendingCount} transacciones pendientes</span>
              <span className="text-[10px] text-[#94a3b8]">Esperando sincronización con Stellar</span>
            </div>
          </div>
          <span className="text-sm font-black text-[#f59e0b] font-mono">{totalPending.toFixed(2)} USDT</span>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Actividad Reciente</h3>
          <span className="text-[10px] text-[#64748b] font-mono">{transactions.length} total</span>
        </div>

        {recentTxs.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Coins className="w-6 h-6 text-[#64748b] mx-auto opacity-50" />
            <p className="text-[11px] text-[#64748b]">Sin actividad aún</p>
            <p className="text-[10px] text-[#4a5568]">Realiza tu primer pago en la pestaña Enviar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTxs.map((tx, idx) => (
              <div
                key={tx.txHash || idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[rgba(10,14,24,0.6)] border border-[rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg ${
                    tx.status === 'SYNCED_ONCHAIN'
                      ? 'bg-[rgba(16,185,129,0.15)] text-[#10b981]'
                      : 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                  }`}>
                    {tx.status === 'SYNCED_ONCHAIN'
                      ? <CheckCircle2 className="w-3.5 h-3.5" />
                      : <Clock className="w-3.5 h-3.5" />
                    }
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-white block truncate">{tx.payload.memo || 'Pago offline'}</span>
                    <span className="text-[9px] text-[#64748b] font-mono">
                      Nonce #{tx.payload.nonce} · {tx.status === 'SYNCED_ONCHAIN' ? 'Confirmado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className={`text-xs font-black font-mono block ${
                    tx.status === 'SYNCED_ONCHAIN' ? 'text-[#10b981]' : 'text-[#f59e0b]'
                  }`}>
                    -{tx.payload.amount.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-[#64748b]">{tx.payload.asset}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
