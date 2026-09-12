import React from 'react';
import { useWallet } from '../context/WalletContext';
import {
  CloudUpload,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  AlertCircle,
  Radio
} from 'lucide-react';

export default function SyncManager() {
  const {
    transactions,
    isOnline,
    syncToStellarNetwork,
    isSyncing,
    lastSyncResult,
    activeDevice
  } = useWallet();

  const pendingTxs = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN');
  const syncedTxs = transactions.filter(t => t.status === 'SYNCED_ONCHAIN');
  const totalPending = pendingTxs.reduce((acc, t) => acc + t.payload.amount, 0);

  const handleSync = async () => {
    try {
      await syncToStellarNetwork('USER_MANUAL_CLICK');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#94a3b8] uppercase font-semibold">Pendientes</span>
            <Clock className="w-4 h-4 text-[#f59e0b] opacity-50" />
          </div>
          <div className="text-3xl font-black text-[#f59e0b] font-mono">{pendingTxs.length}</div>
          <span className="text-[10px] text-[#94a3b8] font-mono">{totalPending.toFixed(2)} USDT</span>
        </div>
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#94a3b8] uppercase font-semibold">Confirmadas</span>
            <CheckCircle2 className="w-4 h-4 text-[#10b981] opacity-50" />
          </div>
          <div className="text-3xl font-black text-[#10b981] font-mono">{syncedTxs.length}</div>
          <span className="text-[10px] text-[#10b981] font-mono">En Stellar</span>
        </div>
      </div>

      {/* Sync Button */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-[#10b981] animate-pulse' : 'text-[#f43f5e]'}`} />
            <span className="text-xs font-bold text-white">Liquidación On-Chain</span>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            isOnline
              ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981] border-[rgba(16,185,129,0.25)]'
              : 'bg-[rgba(244,63,94,0.1)] text-[#f43f5e] border-[rgba(244,63,94,0.25)]'
          }`}>
            {isOnline ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing || pendingTxs.length === 0 || !isOnline}
          className="w-full btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-2"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sincronizando con Stellar...
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              Subir Lote ({pendingTxs.length} pendientes)
            </>
          )}
        </button>

        {!isOnline && (
          <div className="p-2.5 rounded-lg bg-[rgba(244,63,94,0.1)] text-[#f43f5e] border border-[rgba(244,63,94,0.2)] text-[11px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Conéctate a internet para sincronizar</span>
          </div>
        )}

        {lastSyncResult && (
          <div className="p-3 rounded-xl bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.25)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                <span>Confirmado en Stellar</span>
              </div>
              <a
                href={lastSyncResult.stellarExpertUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#00f2fe] font-bold flex items-center gap-1 hover:underline"
              >
                Ver <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
            <div className="text-[10px] font-mono text-[#94a3b8] space-y-0.5">
              <div className="truncate">Tx: {lastSyncResult.stellarTxHash}</div>
              <div className="truncate">Merkle: {lastSyncResult.batchMerkleRoot?.substring(0, 24)}...</div>
            </div>
          </div>
        )}
      </div>

      {/* Active Device */}
      <div className="glass-panel p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#00f2fe]" />
          <div>
            <span className="text-[10px] text-[#94a3b8] uppercase block">Dispositivo</span>
            <span className="text-xs font-bold text-white">
              {activeDevice === 'device_b' ? 'B (Comercio)' : 'A (Pagador)'}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-[#00f2fe] font-mono">Broadcast listo</span>
      </div>

      {/* Transaction List */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#00f2fe]" /> Registro
          </h3>
          <span className="text-[10px] text-[#64748b] font-mono">{transactions.length}</span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-6 text-center">
            <Layers className="w-5 h-5 text-[#64748b] mx-auto opacity-40 mb-2" />
            <p className="text-[11px] text-[#64748b]">Sin transacciones</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, idx) => (
              <div
                key={tx.txHash || idx}
                className="p-3 rounded-xl bg-[rgba(10,14,24,0.6)] border border-[rgba(255,255,255,0.04)] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      tx.status === 'SYNCED_ONCHAIN'
                        ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]'
                        : 'bg-[#f59e0b] shadow-[0_0_6px_#f59e0b]'
                    }`} />
                    <span className="text-xs font-bold text-white">
                      {tx.payload.amount.toFixed(2)} {tx.payload.asset}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    tx.status === 'SYNCED_ONCHAIN'
                      ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981] border-[rgba(16,185,129,0.25)]'
                      : 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border-[rgba(245,158,11,0.25)]'
                  }`}>
                    {tx.status === 'SYNCED_ONCHAIN' ? 'Confirmado' : 'Pendiente'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                  <span className="truncate max-w-[140px]">Nonce #{tx.payload.nonce} · {tx.payload.memo || '—'}</span>
                  {tx.status === 'SYNCED_ONCHAIN' && tx.stellarTxHash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${tx.stellarTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00f2fe] hover:underline flex items-center gap-0.5 shrink-0"
                    >
                      Ver <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
