import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  CloudUpload,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Radio,
  ChevronDown,
  GitBranch,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { EVM_NETWORKS } from '../services/evmCrypto';

export default function SyncManager() {
  const { 
    transactions, 
    merkleTree, 
    isOnline, 
    syncToNetwork, 
    isSyncing, 
    lastSyncResult,
    isEvm,
    activeEvmChain
  } = useWallet();

  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showMerkleDetails, setShowMerkleDetails] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);

  const currentEvmNetwork = EVM_NETWORKS[activeEvmChain] || EVM_NETWORKS.sepolia;
  const targetNetworkName = isEvm ? currentEvmNetwork.name : 'Stellar Testnet';

  const pendingTxs = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN');
  const syncedTxs = transactions.filter(t => t.status === 'SYNCED_ONCHAIN');
  const totalPending = pendingTxs.reduce((acc, t) => acc + t.payload.amount, 0);

  const handleSync = async () => {
    setFeedback({ type: '', message: '' });
    try {
      const res = await syncToNetwork('USER_MANUAL_CLICK');
      setFeedback({ 
        type: 'success', 
        message: `Lote sincronizado con éxito en ${targetNetworkName} (Bloque #${res.blockNumber || res.stellarLedger || 'Reciente'})` 
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || `Error al sincronizar lote en ${targetNetworkName}` });
    }
  };

  const copyMerkleRoot = () => {
    if (merkleTree?.rootHash) {
      navigator.clipboard.writeText(merkleTree.rootHash);
      setCopiedRoot(true);
      setTimeout(() => setCopiedRoot(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

      {/* Metrics Header Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        
        {/* Pending Offline Metric */}
        <div className="pollar-panel" style={{ padding: 18, borderLeft: '4px solid var(--color-amber)', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pendientes
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--color-amber-bg)', color: 'var(--color-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-amber)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {pendingTxs.length}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
            ${totalPending.toFixed(2)} {isEvm ? 'USDT (EVM)' : 'USDT'} offline
          </span>
        </div>

        {/* Synced On-Chain Metric */}
        <div className="pollar-panel" style={{ padding: 18, borderLeft: '4px solid var(--color-emerald)', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Confirmadas
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--color-emerald-bg)', color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-emerald)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {syncedTxs.length}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-emerald)' }}>
            En {targetNetworkName}
          </span>
        </div>

      </div>

      {/* Main Batch Synchronization Card */}
      <div className="pollar-panel">
        <div className="pollar-panel-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloudUpload size={18} color="var(--pollar-blue)" /> Sincronizador de Lote ({targetNetworkName})
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Comprime firmas criptográficas bilaterales ({isEvm ? 'Secp256k1' : 'Ed25519'}) en un hash raíz Merkle on-chain
            </p>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 20,
            background: isOnline ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
            color: isOnline ? 'var(--color-emerald)' : 'var(--color-rose)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Radio size={12} className={isOnline ? 'animate-pulse' : ''} />
            {isOnline ? 'Red Lista' : 'Sin Conexión'}
          </span>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing || pendingTxs.length === 0 || !isOnline}
          className="pollar-btn-primary"
        >
          {isSyncing ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Transmitiendo a {targetNetworkName}...
            </>
          ) : (
            <>
              <CloudUpload size={18} />
              Sincronizar Lote ({pendingTxs.length} transacciones)
            </>
          )}
        </button>

        {!isOnline && (
          <div style={{
            padding: 12,
            borderRadius: 14,
            background: 'var(--color-rose-bg)',
            color: 'var(--color-rose)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <AlertCircle size={16} shrink={0} />
            <span>Conéctate a internet o pulsa el botón Online en la barra superior para sincronizar.</span>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback.message && (
          <div style={{
            padding: 14,
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
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Last Sync Result Box */}
        {lastSyncResult && (
          <div style={{
            padding: 16,
            borderRadius: 18,
            background: 'var(--color-emerald-bg)',
            border: '1.5px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)' }}>
                <CheckCircle2 size={16} />
                <span>Lote Confirmado en {lastSyncResult.network || targetNetworkName}</span>
              </div>
              {lastSyncResult.explorerUrl && (
                <a
                  href={lastSyncResult.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, fontWeight: 800, color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {isEvm ? 'Etherscan Sepolia' : 'StellarExpert'} <ArrowUpRight size={14} />
                </a>
              )}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong>Tx Hash:</strong> {lastSyncResult.txHash || lastSyncResult.stellarTxHash}
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong>Merkle Root:</strong> {lastSyncResult.batchMerkleRoot}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cryptographic Merkle Tree Details Card */}
      <div className="pollar-panel">
        <button
          onClick={() => setShowMerkleDetails(!showMerkleDetails)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'transparent',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitBranch size={18} />
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>Árbol Criptográfico de Merkle</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {merkleTree?.leaves?.length || 0} hojas criptográficas ({isEvm ? 'Keccak-256' : 'SHA-256'})
              </span>
            </div>
          </div>
          <ChevronDown size={18} color="var(--text-light)" style={{ transform: showMerkleDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        {showMerkleDetails && (
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              padding: 12,
              borderRadius: 14,
              background: 'var(--bg-card-muted)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-main)',
              wordBreak: 'break-all',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: 'var(--pollar-blue)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Merkle Root ({isEvm ? 'Keccak-256 EVM' : 'SHA-256'})
                </strong>
                <button onClick={copyMerkleRoot} style={{ background: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}>
                  {copiedRoot ? <Check size={12} color="var(--color-emerald)" /> : <Copy size={12} />}
                  {copiedRoot ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              {merkleTree.rootHash || '0x0000000000000000000000000000000000000000000000000000000000000000'}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              El hash raíz comprime criptográficamente todo el lote offline en una única operación inmutable sobre la blockchain de {targetNetworkName}.
            </p>
          </div>
        )}
      </div>

      {/* Audit Log / Transactions History Panel */}
      <div className="pollar-panel">
        <div className="pollar-panel-header">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--pollar-blue)" /> Registro de Transacciones del Lote
          </h3>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
            {transactions.length}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-light)', fontSize: 13 }}>
            No hay transacciones registradas en este dispositivo
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transactions.map((tx, idx) => (
              <div
                key={tx.txHash || idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: tx.status === 'SYNCED_ONCHAIN' ? 'var(--color-emerald)' : 'var(--color-amber)'
                  }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
                      {tx.payload.amount.toFixed(2)} {tx.payload.asset}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Nonce #{tx.payload.nonce} · {tx.payload.memo || 'Pago Offline'} {tx.network ? `(${tx.network})` : ''}
                    </span>
                  </div>
                </div>

                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: tx.status === 'SYNCED_ONCHAIN' ? 'var(--color-emerald-bg)' : 'var(--color-amber-bg)',
                  color: tx.status === 'SYNCED_ONCHAIN' ? 'var(--color-emerald)' : 'var(--color-amber)'
                }}>
                  {tx.status === 'SYNCED_ONCHAIN' ? 'On-Chain' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
