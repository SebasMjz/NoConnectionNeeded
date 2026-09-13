import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateEvmQrDataUrl, EVM_NETWORKS } from '../services/evmCrypto';
import { downloadQrImage, shareQrToWhatsApp } from '../utils/qrSharing';
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
  Plus,
  QrCode,
  ExternalLink,
  X,
  Download,
  MessageCircle
} from 'lucide-react';

export default function WalletVault({ onNavigate, onOpenLinkModal }) {
  const {
    myWallet,
    deviceA,
    allocateOfflineFunds,
    returnFundsToMain,
    refreshOnlineBalance,
    requestFriendbotFunding,
    fundEvmVault,
    fundEvmTokenVault,
    isRefreshingBalance,
    transactions,
    isEvm,
    activeEvmChain
  } = useWallet();

  const currentAccount = myWallet || deviceA;

  const [transferAmount, setTransferAmount] = useState('');
  const [activeAction, setActiveAction] = useState('allocate');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showAllocation, setShowAllocation] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isDepositingVault, setIsDepositingVault] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveQrUrl, setReceiveQrUrl] = useState('');

  const availableInMain = Math.max(0, currentAccount.mainBalance - currentAccount.derivedOffline);
  const unspentOffline = Math.max(0, currentAccount.derivedOffline - currentAccount.spentOffline);
  const usagePercentage = currentAccount.derivedOffline > 0
    ? Math.min(100, (currentAccount.spentOffline / currentAccount.derivedOffline) * 100)
    : 0;

  // Auto-refresh balances and smart contract escrow on mount or when address is active
  useEffect(() => {
    if (currentAccount.publicKey) {
      refreshOnlineBalance(currentAccount.publicKey);
    }
  }, [currentAccount.publicKey]);

  const recentTxs = transactions.slice(0, 5);
  const pendingCount = transactions.filter(t => t.status !== 'SYNCED_ONCHAIN').length;
  const totalPending = transactions
    .filter(t => t.status !== 'SYNCED_ONCHAIN')
    .reduce((acc, t) => acc + t.payload.amount, 0);

  const [depositOnChain, setDepositOnChain] = useState(true);
  const [lastDepositReceipt, setLastDepositReceipt] = useState(null);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setLastDepositReceipt(null);

    const num = parseFloat(transferAmount);
    if (isNaN(num) || num <= 0) {
      setFeedback({ type: 'error', message: 'Ingresa un monto válido mayor a 0' });
      return;
    }

    try {
      if (activeAction === 'allocate') {
        if (isEvm && depositOnChain) {
          setIsDepositingVault(true);
          try {
            let res;
            if (currentAccount.asset === 'USDC') {
              res = await fundEvmTokenVault(transferAmount);
            } else {
              res = await fundEvmVault(transferAmount);
            }
            allocateOfflineFunds(transferAmount);
            setLastDepositReceipt(res);
            setFeedback({
              type: 'success',
              message: `¡${transferAmount} ${currentAccount.asset} depositados en Smart Contract Vault y bloqueados para Offline!`,
              explorerUrl: res?.explorerUrl || (res?.hash ? `${EVM_NETWORKS[activeEvmChain]?.blockExplorer}/tx/${res.hash}` : null)
            });
            await refreshOnlineBalance(currentAccount.publicKey);
          } catch (depositErr) {
            throw new Error(`Error en el depósito on-chain: ${depositErr.message || depositErr}`);
          } finally {
            setIsDepositingVault(false);
          }
        } else {
          allocateOfflineFunds(transferAmount);
          setFeedback({ type: 'success', message: `${transferAmount} ${currentAccount.asset} bloqueados en Bóveda Offline (Local)` });
        }
      } else {
        returnFundsToMain(transferAmount);
        setFeedback({ type: 'success', message: `${transferAmount} ${currentAccount.asset} liberados a Billetera Principal` });
      }
      setTransferAmount('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
      setIsDepositingVault(false);
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

  // Generate QR Code for receiving funds
  useEffect(() => {
    if (showReceiveModal && currentAccount.publicKey) {
      generateEvmQrDataUrl(currentAccount.publicKey).then(setReceiveQrUrl);
    }
  }, [showReceiveModal, currentAccount.publicKey]);

  const handleFundFriendbot = async () => {
    setIsFunding(true);
    setFeedback({ type: '', message: '' });
    try {
      if (isEvm) {
        await refreshOnlineBalance(currentAccount.publicKey);
        setFeedback({ 
          type: 'success', 
          message: 'Saldos actualizados on-chain desde Ethereum Sepolia.' 
        });
      } else {
        await requestFriendbotFunding(currentAccount.publicKey);
        setFeedback({ 
          type: 'success', 
          message: '¡Recarga Confirmada! +10,000.00 XLM acreditados exitosamente en Stellar Testnet' 
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al solicitar fondos' });
    } finally {
      setIsFunding(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(currentAccount.publicKey);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const copyUsdcContract = () => {
    const usdcAddr = EVM_NETWORKS.sepolia.usdcAddress;
    navigator.clipboard.writeText(usdcAddr);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const handleDepositToSmartContract = async () => {
    setIsDepositingVault(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await fundEvmVault('0.001');
      setFeedback({
        type: 'success',
        message: `¡0.001 Sepolia ETH depositados en el Smart Contract Vault! Tx: ${res.hash.slice(0, 12)}...`
      });
      await refreshOnlineBalance(currentAccount.publicKey);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al depositar en el Smart Contract Vault'
      });
    } finally {
      setIsDepositingVault(false);
    }
  };

  const handleDepositTokenToSmartContract = async (amt = '1') => {
    setIsDepositingVault(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await fundEvmTokenVault(amt);
      setFeedback({
        type: 'success',
        message: `¡${amt} USDC depositados en Smart Contract Vault! Tx: ${res.hash.slice(0, 12)}...`
      });
      await refreshOnlineBalance(currentAccount.publicKey);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al depositar USDC en el Smart Contract Vault'
      });
    } finally {
      setIsDepositingVault(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>

      {/* Main Digital eWallet Balance Card */}
      <div className="pollar-balance-card">
        <div className="pollar-card-ambient-circle" />

        {/* Card Top: Tag + Refresh */}
        <div className="pollar-card-top">
          <span className="pollar-card-tag">
            Mi Billetera Pollar
          </span>

          <button
            onClick={() => refreshOnlineBalance(currentAccount.publicKey)}
            disabled={isRefreshingBalance}
            className="pollar-card-refresh"
            title="Actualizar saldo on-chain"
          >
            <RefreshCw size={15} className={isRefreshingBalance ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Balance Amount */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>Saldo Total</span>
          <div className="pollar-balance-amount">
            <span>${currentAccount.mainBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="pollar-balance-asset">{currentAccount.asset}</span>
          </div>

          {/* EVM Live Gas Badge */}
          {isEvm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: 12, 
                background: (currentAccount.nativeBalance > 0) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: (currentAccount.nativeBalance > 0) ? '#6EE7B7' : '#FCD34D',
                border: `1px solid ${(currentAccount.nativeBalance > 0) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Zap size={11} />
                Gas: {(currentAccount.nativeBalance || 0).toFixed(4)} ETH (Sepolia)
              </span>
            </div>
          )}

          <div className="pollar-card-subline">
            <span>Libre: <strong>{availableInMain.toFixed(2)}</strong></span>
            <span>•</span>
            <span>Bóveda Offline: <strong>{unspentOffline.toFixed(2)}</strong></span>
            {currentAccount.receivedOffline > 0 && (
              <>
                <span>•</span>
                <span style={{ color: '#6EE7B7' }}>Cobros: <strong>+{currentAccount.receivedOffline.toFixed(2)} {currentAccount.asset}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Address Pill */}
        <div className="pollar-card-address" onClick={copyAddress} title="Click para copiar dirección">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
            {currentAccount.publicKey}
          </span>
          {copiedAddress ? <Check size={14} color="#6EE7B7" /> : <Copy size={14} opacity={0.7} />}
        </div>

        {/* 4 Circular Action Buttons */}
        <div className="pollar-card-actions">
          <button onClick={() => onNavigate?.('send')} className="pollar-action-btn">
            <div className="pollar-action-icon-circle" style={{ color: 'var(--pollar-blue)' }}>
              <Send size={20} />
            </div>
            <span className="pollar-action-label">Pagar</span>
          </button>

          <button onClick={() => onNavigate?.('send', 'receive')} className="pollar-action-btn">
            <div className="pollar-action-icon-circle" style={{ color: 'var(--color-emerald)' }}>
              <ArrowDownLeft size={20} />
            </div>
            <span className="pollar-action-label">Cobrar</span>
          </button>

          <button onClick={() => setShowAllocation(!showAllocation)} className="pollar-action-btn">
            <div className="pollar-action-icon-circle" style={{ color: 'var(--pollar-blue)' }}>
              <Lock size={20} />
            </div>
            <span className="pollar-action-label">Bóveda</span>
          </button>

          {isEvm ? (
            <button onClick={() => setShowReceiveModal(true)} className="pollar-action-btn">
              <div className="pollar-action-icon-circle" style={{ color: 'var(--color-amber)' }}>
                <QrCode size={20} />
              </div>
              <span className="pollar-action-label">+USDC / Gas</span>
            </button>
          ) : (
            <button onClick={handleFundFriendbot} disabled={isFunding} className="pollar-action-btn">
              <div className="pollar-action-icon-circle" style={{ color: 'var(--color-amber)' }}>
                {isFunding ? <RefreshCw size={20} className="animate-spin" /> : <Sparkles size={20} />}
              </div>
              <span className="pollar-action-label">+10k XLM</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Contacts / Devices (Recent Transfers Row from Figma) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Transferencias Rápidas</h3>
        <div className="pollar-transfers-scroll">
          {/* Add contact */}
          <button onClick={onOpenLinkModal} className="pollar-transfer-item">
            <div className="pollar-transfer-circle add">
              <Plus size={20} />
            </div>
            <span className="pollar-transfer-name">Vincular</span>
          </button>

          {/* Cobrar */}
          <button onClick={() => onNavigate?.('send', 'receive')} className="pollar-transfer-item">
            <div className="pollar-transfer-circle" style={{ background: 'var(--color-emerald-bg)', color: 'var(--color-emerald)', border: '2px solid rgba(16, 185, 129, 0.3)' }}>
              <ArrowDownLeft size={18} />
            </div>
            <span className="pollar-transfer-name">Cobrar</span>
          </button>

          {/* Pagar */}
          <button onClick={() => onNavigate?.('send')} className="pollar-transfer-item">
            <div className="pollar-transfer-circle" style={{ background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', border: '2px solid rgba(0, 98, 255, 0.3)' }}>
              <Send size={18} />
            </div>
            <span className="pollar-transfer-name">Pagar</span>
          </button>

          {/* +Fondos / Faucet */}
          <button onClick={() => isEvm ? setShowReceiveModal(true) : handleFundFriendbot()} className="pollar-transfer-item">
            <div className="pollar-transfer-circle" style={{ background: 'var(--color-amber-bg)', color: 'var(--color-amber)', border: '2px solid rgba(245, 158, 11, 0.3)' }}>
              {isEvm ? <QrCode size={18} /> : '⚡'}
            </div>
            <span className="pollar-transfer-name">{isEvm ? '+Fondos' : 'Friendbot'}</span>
          </button>
        </div>
      </div>

      {/* Offline Vault Allocation Panel (Collapsible) */}
      {showAllocation && (
        <div className="pollar-panel animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>Bóveda Offline</h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cupo para pagar sin internet</p>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '4px 10px', borderRadius: 20, fontFamily: 'var(--font-mono)' }}>
              {unspentOffline.toFixed(2)} {currentAccount.asset}
            </span>
          </div>

          <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 14, gap: 4 }}>
            <button
              onClick={() => { setActiveAction('allocate'); setTransferAmount(''); setFeedback({ type: '', message: '' }); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                background: activeAction === 'allocate' ? '#FFFFFF' : 'transparent',
                color: activeAction === 'allocate' ? 'var(--pollar-blue)' : 'var(--text-muted)',
                boxShadow: activeAction === 'allocate' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Bloquear a Bóveda
            </button>
            <button
              onClick={() => { setActiveAction('return'); setTransferAmount(''); setFeedback({ type: '', message: '' }); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                background: activeAction === 'return' ? '#FFFFFF' : 'transparent',
                color: activeAction === 'return' ? 'var(--pollar-blue)' : 'var(--text-muted)',
                boxShadow: activeAction === 'return' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Liberar a Principal
            </button>
          </div>

          <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="pollar-input-large"
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 800, color: 'var(--text-muted)' }}>
                {currentAccount.asset}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  className="pollar-btn-quick"
                >
                  {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                </button>
              ))}
            </div>

            {isEvm && activeAction === 'allocate' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', background: '#F1F5F9', padding: '10px 12px', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <input
                  type="checkbox"
                  checked={depositOnChain}
                  onChange={(e) => setDepositOnChain(e.target.checked)}
                  style={{ accentColor: 'var(--pollar-blue)', width: 16, height: 16 }}
                />
                <span style={{ flex: 1 }}>
                  🔒 Depositar directamente en <strong>Smart Contract Vault (Sepolia)</strong>
                </span>
              </label>
            )}

            <button type="submit" disabled={isDepositingVault} className="pollar-btn-primary">
              {isDepositingVault ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Confirmando depósito en Sepolia...</span>
                </span>
              ) : (
                activeAction === 'allocate'
                  ? (isEvm && depositOnChain ? `Bloquear y Depositar ${transferAmount ? `${transferAmount} ${currentAccount.asset}` : ''} en Smart Contract` : 'Bloquear Fondos para Offline')
                  : 'Liberar a Billetera'
              )}
            </button>
          </form>

          {/* Smart Contract On-Chain Vault Escrow Section */}
          {isEvm && (
            <div style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
                  Smart Contract Vault ({EVM_NETWORKS[activeEvmChain]?.name || 'Sepolia'})
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: ((currentAccount.tokenVaultState?.availableToSpend > 0) || (currentAccount.vaultState?.availableToSpend > 0)) ? '#D1FAE5' : '#FEF3C7',
                  color: ((currentAccount.tokenVaultState?.availableToSpend > 0) || (currentAccount.vaultState?.availableToSpend > 0)) ? '#065F46' : '#92400E'
                }}>
                  {((currentAccount.tokenVaultState?.availableToSpend > 0) || (currentAccount.vaultState?.availableToSpend > 0)) ? 'Bóveda Fondeada en Contrato' : 'Sin Fondos en Contrato'}
                </span>
              </div>

              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>Contrato: {EVM_NETWORKS[activeEvmChain]?.vaultAddress?.slice(0, 8)}...{EVM_NETWORKS[activeEvmChain]?.vaultAddress?.slice(-6)}</div>
                <div style={{ color: (currentAccount.tokenVaultState?.availableToSpend > 0) ? '#065F46' : 'inherit', fontWeight: (currentAccount.tokenVaultState?.availableToSpend > 0) ? 800 : 500 }}>
                  USDC en Contrato: <strong>{(currentAccount.tokenVaultState?.availableToSpend || 0).toFixed(2)} USDC</strong> (Total Bloqueado: {(currentAccount.tokenVaultState?.lockedAmount || 0).toFixed(2)})
                </div>
                <div>
                  ETH en Contrato: <strong>{(currentAccount.vaultState?.availableToSpend || 0).toFixed(4)} ETH</strong>
                </div>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                ℹ️ <strong>Bóveda Local:</strong> Asigna límite de gasto offline en tu teléfono.<br />
                🔒 <strong>Smart Contract:</strong> Custodia fondos en Sepolia para liquidación automática on-chain.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  disabled={isDepositingVault || (currentAccount.nativeBalance || 0) < 0.001}
                  onClick={handleDepositToSmartContract}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 12,
                    background: (currentAccount.nativeBalance || 0) >= 0.001 ? 'var(--pollar-blue)' : '#94A3B8',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: 11,
                    border: 'none',
                    cursor: (currentAccount.nativeBalance || 0) >= 0.001 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {isDepositingVault ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>
                    {(currentAccount.nativeBalance || 0) >= 0.001
                      ? 'Depositar 0.001 ETH en Smart Contract'
                      : 'Recarga Sepolia ETH para depositar'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isDepositingVault || (currentAccount.mainBalance || 0) < 1 || (currentAccount.nativeBalance || 0) < 0.0003}
                  onClick={() => handleDepositTokenToSmartContract('1')}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 12,
                    background: ((currentAccount.mainBalance || 0) >= 1 && (currentAccount.nativeBalance || 0) >= 0.0003) ? '#10B981' : '#94A3B8',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: 11,
                    border: 'none',
                    cursor: ((currentAccount.mainBalance || 0) >= 1 && (currentAccount.nativeBalance || 0) >= 0.0003) ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {isDepositingVault ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                  <span>
                    {(currentAccount.mainBalance || 0) >= 1
                      ? ((currentAccount.nativeBalance || 0) >= 0.0003 ? 'Depositar 1.00 USDC en Smart Contract' : 'Necesitas gas Sepolia ETH para depositar USDC')
                      : 'Sin saldo USDC en Billetera'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback.message && (
        <div className={`pollar-feedback ${feedback.type === 'error' ? 'error' : 'success'}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span style={{ fontSize: 13, fontWeight: 700 }}>{feedback.message}</span>
          </div>
          {feedback.explorerUrl && (
            <a
              href={feedback.explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--pollar-blue)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'underline',
                marginLeft: 26
              }}
            >
              <span>Ver Comprobante de Depósito en Sepolia Etherscan</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* Offline Pending Transactions Notification Banner */}
      {pendingCount > 0 && (
        <div 
          onClick={() => onNavigate?.('sync')}
          className="animate-in fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
            borderRadius: 20,
            padding: '14px 18px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(245, 158, 11, 0.2)', color: 'var(--color-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#92400E', display: 'block' }}>{pendingCount} pagos offline pendientes</span>
              <span style={{ fontSize: 11, color: '#B45309' }}>{isEvm ? 'Toca para sincronizar en Sepolia' : 'Toca para sincronizar en Stellar'}</span>
            </div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#92400E' }}>
            {totalPending.toFixed(2)} {currentAccount.asset}
          </span>
        </div>
      )}

      {/* Latest Transactions List (From Figma Design) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Últimas Transacciones</h3>
          <button 
            onClick={() => onNavigate?.('sync')}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--pollar-blue)', background: 'transparent' }}
          >
            Ver todas ({transactions.length})
          </button>
        </div>

        {recentTxs.length === 0 ? (
          <div className="pollar-panel" style={{ textAlign: 'center', padding: 32, alignItems: 'center' }}>
            <Coins size={36} opacity={0.3} color="var(--text-muted)" />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Sin movimientos aún</p>
            <p style={{ fontSize: 11, color: 'var(--text-light)' }}>Toca en Pagar para realizar tu primera transacción</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentTxs.map((tx, idx) => (
              <div key={tx.txHash || idx} className="pollar-tx-item">
                <div className="pollar-tx-left">
                  <div className="pollar-tx-icon" style={{
                    background: tx.status === 'SYNCED_ONCHAIN' ? 'var(--color-emerald-bg)' : 'var(--color-amber-bg)',
                    color: tx.status === 'SYNCED_ONCHAIN' ? 'var(--color-emerald)' : 'var(--color-amber)'
                  }}>
                    {tx.status === 'SYNCED_ONCHAIN' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <span className="pollar-tx-title" style={{ display: 'block' }}>
                      {tx.payload.memo || 'Pago Offline Pollar'}
                    </span>
                    <span className="pollar-tx-meta">
                      Nonce #{tx.payload.nonce} · {tx.status === 'SYNCED_ONCHAIN' ? 'Confirmado On-Chain' : 'Guardado Offline'}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={tx.status === 'SYNCED_ONCHAIN' ? 'pollar-tx-amount-out' : 'pollar-tx-amount-in'} style={{ display: 'block' }}>
                    -${tx.payload.amount.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>{tx.payload.asset}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receive / Faucet Deposit Modal (EVM & Stellar) */}
      {showReceiveModal && (
        <div className="pollar-modal-overlay" onClick={() => setShowReceiveModal(false)} style={{ zIndex: 100 }}>
          <div 
            className="pollar-modal-sheet" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '92vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                    {isEvm ? 'Fondeo de Billetera (Sepolia)' : 'Recibir Fondos'}
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Mi Billetera Pollar · Recibir Fondos
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowReceiveModal(false)}
                style={{ width: 32, height: 32, borderRadius: 10, background: '#F1F5F9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>

            {/* Current Real On-Chain Balances */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <div style={{ background: 'rgba(0, 98, 255, 0.05)', border: '1px solid rgba(0, 98, 255, 0.2)', padding: 12, borderRadius: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>Saldo USDC</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--pollar-blue)', fontFamily: 'var(--font-mono)' }}>
                  ${currentAccount.mainBalance.toFixed(2)}
                </span>
              </div>
              <div style={{ background: (currentAccount.nativeBalance > 0) ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)', border: `1px solid ${(currentAccount.nativeBalance > 0) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`, padding: 12, borderRadius: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>Gas (Sepolia ETH)</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: (currentAccount.nativeBalance > 0) ? '#10B981' : '#D97706', fontFamily: 'var(--font-mono)' }}>
                  {(currentAccount.nativeBalance || 0).toFixed(4)}
                </span>
              </div>
            </div>

            {/* QR Code Container */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 16 }}>
              {receiveQrUrl ? (
                <img 
                  src={receiveQrUrl} 
                  alt="QR Code" 
                  style={{ 
                    width: 190, 
                    height: 190, 
                    borderRadius: 16, 
                    border: '3px solid #E2E8F0', 
                    padding: 8, 
                    background: '#FFFFFF',
                    imageRendering: 'pixelated',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
                  }}
                />
              ) : (
                <div style={{ width: 190, height: 190, borderRadius: 16, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={48} opacity={0.3} />
                </div>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>
                Escanea desde MetaMask o tu billetera EVM
              </span>

              {/* Action Buttons: Download & WhatsApp */}
              {receiveQrUrl && (
                <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 280, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => downloadQrImage(receiveQrUrl, `pollar_wallet_${currentAccount.publicKey.slice(0, 6)}.png`)}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 12,
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} /> Descargar
                  </button>
                  <button
                    type="button"
                    onClick={() => shareQrToWhatsApp({
                      dataUrl: receiveQrUrl,
                      title: 'Billetera Pollar (Recibir USDC / Gas)',
                      text: `Dirección de mi Billetera Pollar:\n${currentAccount.publicKey}\n\nRed: Ethereum Sepolia Testnet (USDC / ETH)`,
                      filename: `pollar_wallet_${currentAccount.publicKey.slice(0, 6)}.png`
                    })}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 12,
                      background: '#25D366',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                    }}
                  >
                    <MessageCircle size={15} /> WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* Address Box */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Dirección EVM de esta Billetera
              </label>
              <div 
                onClick={copyAddress}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  background: '#F8FAFC', 
                  border: '1px solid #CBD5E1', 
                  padding: '10px 14px', 
                  borderRadius: 14, 
                  cursor: 'pointer' 
                }}
              >
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', wordBreak: 'break-all' }}>
                  {currentAccount.publicKey}
                </span>
                <button style={{ background: 'transparent', border: 'none', color: copiedAddress ? '#10B981' : 'var(--pollar-blue)', marginLeft: 8, cursor: 'pointer', shrink: 0 }}>
                  {copiedAddress ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* Sepolia USDC Contract Information */}
            {isEvm && (
              <div style={{ marginTop: 14, background: '#F1F5F9', borderRadius: 16, padding: 14, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>
                    Contrato Oficial USDC (Sepolia)
                  </span>
                  <button 
                    onClick={copyUsdcContract}
                    style={{ background: 'transparent', border: 'none', color: copiedContract ? '#10B981' : 'var(--pollar-blue)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {copiedContract ? <Check size={12} /> : <Copy size={12} />} Copiar
                  </button>
                </div>
                <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#64748B', wordBreak: 'break-all', background: '#FFFFFF', padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  {EVM_NETWORKS.sepolia.usdcAddress}
                </p>
                <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
                  Circle Official Testnet USDC · 6 Decimales · Símbolo: USDC
                </p>
              </div>
            )}

            {/* Testnet Faucet Links */}
            {isEvm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Enlaces a Faucets Gratuitos
                </span>
                <a 
                  href={EVM_NETWORKS.sepolia.faucetUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'rgba(0, 98, 255, 0.08)', color: 'var(--pollar-blue)', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}
                >
                  <span>1. Faucet Oficial Circle (USDC Testnet)</span>
                  <ExternalLink size={14} />
                </a>
                <a 
                  href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.08)', color: '#059669', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}
                >
                  <span>2. Faucet Google Cloud Web3 (Sepolia ETH Gas - Rápido)</span>
                  <ExternalLink size={14} />
                </a>
                <a 
                  href={EVM_NETWORKS.sepolia.ethFaucetUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.08)', color: '#D97706', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}
                >
                  <span>3. Faucet Sepolia ETH Alternativo (PoW / Web)</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            )}

            {/* Verification Button */}
            <div style={{ marginTop: 20 }}>
              <button
                onClick={async () => {
                  await refreshOnlineBalance(currentAccount.publicKey);
                  setFeedback({ type: 'success', message: '¡Saldo verificado y actualizado con la red Sepolia!' });
                }}
                disabled={isRefreshingBalance}
                className="pollar-btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <RefreshCw size={18} className={isRefreshingBalance ? 'animate-spin' : ''} />
                <span>{isRefreshingBalance ? 'Consultando Sepolia...' : 'Comprobar Depósito On-Chain'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
