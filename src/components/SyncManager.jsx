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
  Check,
  Fuel,
  ExternalLink
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
    activeEvmChain,
    activeDevice,
    deviceA,
    deviceB,
    refreshOnlineBalance
  } = useWallet();

  const [feedback, setFeedback] = useState({ type: '', message: '', isGasError: false });
  const [showMerkleDetails, setShowMerkleDetails] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isRefreshingGas, setIsRefreshingGas] = useState(false);

  const currentEvmNetwork = EVM_NETWORKS[activeEvmChain] || EVM_NETWORKS.sepolia;
  const targetNetworkName = isEvm ? currentEvmNetwork.name : 'Stellar Testnet';

  const submitterAccount = activeDevice === 'device_b' ? deviceB : deviceA;
  const submitterRole = activeDevice === 'device_b' ? 'Dispositivo B (Comercio)' : 'Dispositivo A (Pagador)';
  const submitterGas = isEvm ? (submitterAccount.nativeBalance || 0) : 0;

  const pendingTxs = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN');
  const syncedTxs = transactions.filter(t => t.status === 'SYNCED_ONCHAIN');
  const totalPending = pendingTxs.reduce((acc, t) => acc + t.payload.amount, 0);

  const copySubmitterAddress = () => {
    if (submitterAccount?.publicKey) {
      navigator.clipboard.writeText(submitterAccount.publicKey);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleRefreshGas = async () => {
    setIsRefreshingGas(true);
    try {
      await refreshOnlineBalance(submitterAccount?.publicKey);
    } catch (e) {
      console.warn('Refresh gas error:', e);
    } finally {
      setIsRefreshingGas(false);
    }
  };

  const handleSync = async () => {
    setFeedback({ type: '', message: '', isGasError: false });
    try {
      const res = await syncToNetwork('USER_MANUAL_CLICK');
      setFeedback({ 
        type: 'success', 
        message: `Lote sincronizado con éxito en ${targetNetworkName} (Bloque #${res.blockNumber || res.stellarLedger || 'Reciente'})`,
        isGasError: false
      });
    } catch (err) {
      const isGasErr = err.code === 'INSUFFICIENT_GAS' || (err.message && (err.message.includes('Gas') || err.message.includes('gas') || err.message.includes('insufficient funds')));
      setFeedback({ 
        type: 'error', 
        message: err.message || `Error al sincronizar lote en ${targetNetworkName}`,
        isGasError: isGasErr
      });
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
            ${totalPending.toFixed(2)} {isEvm ? 'USDC (Sepolia)' : 'USDT'} offline
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

        {/* EVM Submitter & Gas Status Panel */}
        {isEvm && (
          <div style={{
            padding: 14,
            borderRadius: 16,
            background: submitterGas > 0.00005 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.08)',
            border: `1.5px solid ${submitterGas > 0.00005 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.4)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Fuel size={16} color={submitterGas > 0.00005 ? '#10B981' : '#D97706'} />
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                  Cuenta Transmisora: <strong style={{ color: 'var(--pollar-blue)' }}>{submitterRole}</strong>
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 10,
                background: submitterGas > 0.00005 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.2)',
                color: submitterGas > 0.00005 ? '#065F46' : '#92400E'
              }}>
                {submitterGas > 0.00005 ? 'Gas Listo' : 'Requiere Gas Sepolia ETH'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {submitterAccount?.publicKey ? `${submitterAccount.publicKey.slice(0, 8)}...${submitterAccount.publicKey.slice(-6)}` : ''}
              </span>
              <span style={{ fontWeight: 800, color: submitterGas > 0.00005 ? '#10B981' : '#D97706' }}>
                {submitterGas.toFixed(5)} Sepolia ETH
              </span>
            </div>

            {submitterGas <= 0.00005 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <p style={{ fontSize: 11, color: '#B45309', margin: 0, lineHeight: 1.4 }}>
                  Para registrar y asentar transacciones on-chain en Sepolia se requiere una pequeña cantidad de Sepolia ETH para el gas de los mineros.
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={copySubmitterAddress}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: '#FFFFFF',
                      border: '1px solid #D97706',
                      color: '#B45309',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedAddress ? <Check size={12} /> : <Copy size={12} />}
                    {copiedAddress ? '¡Copiado!' : 'Copiar Dirección'}
                  </button>
                  <a
                    href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: 'var(--pollar-blue)',
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    <span>Faucet Google Web3</span>
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href="https://sepoliafaucet.com/"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: 'rgba(0, 98, 255, 0.1)',
                      color: 'var(--pollar-blue)',
                      fontSize: 11,
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    <span>SepoliaFaucet</span>
                    <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={handleRefreshGas}
                    type="button"
                    disabled={isRefreshingGas}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: 'var(--text-main)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} className={isRefreshingGas ? 'animate-spin' : ''} />
                    <span>Verificar Saldo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
            flexDirection: 'column',
            gap: 8,
            background: feedback.type === 'success' ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
            color: feedback.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)',
            border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {feedback.type === 'success' ? <CheckCircle2 size={16} shrink={0} /> : <AlertCircle size={16} shrink={0} />}
              <span>{feedback.message}</span>
            </div>

            {feedback.isGasError && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  onClick={copySubmitterAddress}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: '#FFFFFF',
                    border: '1px solid var(--color-rose)',
                    color: 'var(--color-rose)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {copiedAddress ? <Check size={12} /> : <Copy size={12} />}
                  {copiedAddress ? '¡Copiado!' : 'Copiar Dirección'}
                </button>
                <a
                  href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'var(--pollar-blue)',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <span>Faucet Google Web3</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://sepoliafaucet.com/"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'rgba(0, 98, 255, 0.1)',
                    color: 'var(--pollar-blue)',
                    fontSize: 11,
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <span>SepoliaFaucet</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
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
              {isEvm && (
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: lastSyncResult.usedVaultContract ? '#065F46' : '#92400E',
                  background: lastSyncResult.usedVaultContract ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                  padding: '6px 10px',
                  borderRadius: 10,
                  marginBottom: 4,
                  lineHeight: 1.4
                }}>
                  {lastSyncResult.usedVaultContract 
                    ? '🏦 Liquidado mediante Smart Contract Vault · Fondos transferidos on-chain a la wallet del comercio' 
                    : '⚓ Anclaje de Datos On-Chain: Registrado en Sepolia con prueba Merkle. (Para que el contrato transfiera dinero real on-chain, el Pagador debe fondear su Smart Contract Vault previamente).'}
                </div>
              )}
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
              <span style={{ fontSize: 11, color: (merkleTree?.leaves?.length > 0) ? 'var(--color-emerald)' : 'var(--text-muted)', fontWeight: (merkleTree?.leaves?.length > 0) ? 700 : 500 }}>
                {merkleTree?.leaves?.length > 0
                  ? `🌳 Lote Activo: ${merkleTree.leaves.length} pago(s) (${isEvm ? 'Keccak-256' : 'SHA-256'})`
                  : `🌱 Lote Inicial Vacío (${isEvm ? 'EVM bytes32(0)' : 'Sin pagos'})`}
              </span>
            </div>
          </div>
          <ChevronDown size={18} color="var(--text-light)" style={{ transform: showMerkleDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        {showMerkleDetails && (
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(!merkleTree || !merkleTree.leaves || merkleTree.leaves.length === 0) ? (
              <div style={{ padding: 14, borderRadius: 16, background: 'rgba(0, 98, 255, 0.05)', border: '1px solid rgba(0, 98, 255, 0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ℹ️ Estado Inicial: bytes32(0)
                  </span>
                  <span style={{ fontSize: 10, background: 'rgba(0, 98, 255, 0.1)', color: 'var(--pollar-blue)', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                    100% Normal
                  </span>
                </div>
                <div style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: '#64748B',
                  wordBreak: 'break-all'
                }}>
                  0x0000000000000000000000000000000000000000000000000000000000000000
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                  <strong>¿Por qué ves ceros?</strong> Este es el valor nulo estándar en Ethereum (<code>bytes32(0)</code>) cuando aún no hay pagos en el lote offline. En cuanto firmes y contrafirmes tu primer pago, este hash cambiará automáticamente calculando la raíz criptográfica Keccak-256 de todas las transacciones.
                </p>
              </div>
            ) : (
              <>
                <div style={{
                  padding: 12,
                  borderRadius: 14,
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-main)',
                  wordBreak: 'break-all',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: 'var(--color-emerald)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Merkle Root Activo ({isEvm ? 'Keccak-256 EVM' : 'SHA-256'})
                    </strong>
                    <button onClick={copyMerkleRoot} style={{ background: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {copiedRoot ? <Check size={12} color="var(--color-emerald)" /> : <Copy size={12} />}
                      {copiedRoot ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{merkleTree.rootHash}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  El hash raíz comprime criptográficamente todo el lote de {merkleTree.leaves.length} pago(s) en una única operación inmutable sobre la blockchain de {targetNetworkName}.
                </p>
              </>
            )}
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
