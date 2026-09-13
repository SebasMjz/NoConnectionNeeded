import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  generateQrDataUrl,
  serializeCompactInvoice,
  serializeCompactPayment,
  parsePaymentQrData
} from '../services/stellarCrypto';
import { getBarcodeService } from '../services/BarcodeService';
import QRScannerModal from './QRScannerModal';
import CryptoSelector from './CryptoSelector';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Send,
  ArrowDownLeft,
  ShieldCheck,
  AlertTriangle,
  Camera,
  X,
  Bluetooth,
  Wallet,
  Upload,
  Copy,
  Check,
} from 'lucide-react';

export default function P2PPaymentTerminal({ onOpenTransport }) {
  const {
    activeWallet,
    createOfflinePayment,
    cancelPendingPayment,
    receiveAndCounterSign,
    sendPollarPayment,
    openSendModal,
    isOnline,
    changeSelectedAsset,
  } = useWallet();

  const [mode, setMode] = useState('pay'); // 'pay' | 'receive'
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [payAmount, setPayAmount] = useState('1.00');
  const [payMemo, setPayMemo] = useState('Pago P2P Offline');
  const [payeeAddress, setPayeeAddress] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('1.00');
  const [receiveMemo, setReceiveMemo] = useState('Cobro P2P Offline');
  const [pendingTx, setPendingTx] = useState(null);
  const [invoiceQr, setInvoiceQr] = useState('');
  const [paymentQr, setPaymentQr] = useState('');
  const [invoicePayloadString, setInvoicePayloadString] = useState('');
  const [paymentPayloadString, setPaymentPayloadString] = useState('');
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [scanError, setScanError] = useState('');
  const [handshakeStep, setHandshakeStep] = useState(0);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showManualCounterSign, setShowManualCounterSign] = useState(false);
  const [manualPayload, setManualPayload] = useState('');
  const [parsedPayload, setParsedPayload] = useState(null);
  const [payloadError, setPayloadError] = useState('');
  const [isCounterSigning, setIsCounterSigning] = useState(false);

  const barcodeService = useRef(getBarcodeService());

  const availableOffline = activeWallet
    ? activeWallet.derivedOffline - activeWallet.spentOffline
    : 0;
  const quickAmounts = ['1.00', '2.50', '5.00', '10.00', '20.00'];

  // Generate Simplified Invoice QR for receive mode (Pure Black & White, high contrast)
  useEffect(() => {
    if (mode === 'receive' && activeWallet) {
      const compactInv = serializeCompactInvoice({
        payee: activeWallet.publicKey,
        amount: parseFloat(receiveAmount) || 0,
        asset: activeWallet.asset || 'XLM',
        memo: receiveMemo,
      });
      setInvoicePayloadString(JSON.stringify(compactInv));
      generateQrDataUrl(compactInv, '#000000', '#FFFFFF').then(setInvoiceQr);
    }
  }, [mode, receiveAmount, receiveMemo, activeWallet?.publicKey, activeWallet?.asset]);

  // Generate Simplified Payment QR when tx created (Pure Black & White, high contrast)
  useEffect(() => {
    if (pendingTx) {
      const compactPay = serializeCompactPayment(pendingTx);
      setPaymentPayloadString(JSON.stringify(compactPay));
      generateQrDataUrl(compactPay, '#000000', '#FFFFFF').then(setPaymentQr);
    }
  }, [pendingTx]);

  // Scan QR code
  const startScan = () => {
    setScanError('');
    setFeedback({ type: '', message: '' });
    setIsScannerOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError('');
    setFeedback({ type: '', message: 'Leyendo código QR de la imagen...' });
    try {
      const decodedText = await barcodeService.current.scanFile(file);
      if (decodedText) {
        handleScannedData(decodedText);
      } else {
        throw new Error('No se detectó ningún código QR en la imagen.');
      }
    } catch (err) {
      setScanError(err.message || 'Error al procesar archivo');
      setFeedback({ type: 'error', message: err.message || 'No se pudo leer el QR' });
    } finally {
      e.target.value = '';
    }
  };

  const handleDirectPay = async () => {
    if (!payeeAddress || !payeeAddress.trim().startsWith('G')) {
      setFeedback({ type: 'error', message: 'Ingresa una dirección válida de Stellar (G...)' });
      return;
    }
    if (activeWallet && payeeAddress.trim() === activeWallet.publicKey) {
      setFeedback({ type: 'error', message: 'No puedes enviar pagos a tu propia billetera (la cuenta de destino es la misma emisora).' });
      return;
    }
    const num = parseFloat(payAmount);
    if (isNaN(num) || num <= 0) {
      setFeedback({ type: 'error', message: 'Ingresa un monto válido mayor a 0' });
      return;
    }
    setIsSendingDirect(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await sendPollarPayment({
        destination: payeeAddress.trim(),
        amount: payAmount,
        asset: activeWallet.asset,
        memo: payMemo,
      });
      setFeedback({
        type: 'success',
        message: `¡Pago on-chain confirmado vía Pollar Core! Hash: ${res.hash.slice(0, 10)}... (Sin Private Key)`,
      });
      setPayeeAddress('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al enviar pago con Pollar Core' });
    } finally {
      setIsSendingDirect(false);
    }
  };

  const handlePay = async (e) => {
    e?.preventDefault();
    setFeedback({ type: '', message: '' });
    if (activeWallet && payeeAddress.trim() === activeWallet.publicKey) {
      setFeedback({ type: 'error', message: 'No puedes generar un pago hacia tu propia billetera.' });
      return;
    }
    setHandshakeStep(1);
    try {
      const tx = await createOfflinePayment(payeeAddress, payAmount, payMemo);
      setPendingTx(tx);
      setHandshakeStep(2);
      setFeedback({ type: 'success', message: '¡Pago offline firmado! Muestra este QR al cobrador para contrafirma.' });
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (err) {
      setHandshakeStep(0);
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleScannedData = async (rawJson) => {
    setFeedback({ type: '', message: '' });
    try {
      const parsed = await parsePaymentQrData(rawJson);

      if (parsed.type === 'INVOICE') {
        const isSelfInvoice = activeWallet && parsed.payee === activeWallet.publicKey;
        // Received a payment request — populate pay form
        setPayeeAddress(parsed.payee);
        setPayAmount(parsed.amount ? parsed.amount.toString() : '1.00');
        setPayMemo(parsed.memo || 'Pago');
        if (parsed.asset) changeSelectedAsset(parsed.asset);
        setMode('pay');
        if (isSelfInvoice) {
          setFeedback({
            type: 'info',
            message: `Factura propia cargada (${parsed.amount} ${parsed.asset}). Para enviar el pago, usa una billetera pagadora distinta.`
          });
        } else {
          setFeedback({
            type: 'success',
            message: `¡Factura de cobro recibida! Monto: ${parsed.amount} ${parsed.asset}`
          });
        }
        if (navigator.vibrate) navigator.vibrate([40, 40]);
        return;
      } else if (parsed.type === 'PAYMENT') {
        const payload = parsed.tx;
        if (activeWallet && payload.payload?.payer === activeWallet.publicKey) {
          throw new Error('No puedes contrafirmar un pago emitido por tu propia billetera.');
        }
        if (payload.payload?.payer && payload.payload?.payee && payload.payload.payer === payload.payload.payee) {
          throw new Error('Transacción rechazada: La wallet pagadora y receptora son idénticas.');
        }
        // Received a signed payment — counter-sign it
        setHandshakeStep(3);
        await receiveAndCounterSign(payload);
        setFeedback({ type: 'success', message: `¡Cobro Confirmado! +${payload.payload.amount} ${payload.payload.asset}` });
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors: ['#10B981', '#0062FF'] });
          if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
        } catch (e) {}
        setPendingTx(null);
      } else {
        throw new Error('Formato QR no compatible');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al procesar QR' });
    }
  };

  const handleManualCounterSign = async () => {
    if (!parsedPayload || parsedPayload.type !== 'PAYMENT') return;
    setIsCounterSigning(true);
    setFeedback({ type: '', message: '' });
    try {
      const tx = parsedPayload.tx;
      if (activeWallet && tx.payload?.payer === activeWallet.publicKey) {
        throw new Error('No puedes contrafirmar un pago emitido por tu propia billetera.');
      }
      if (tx.payload?.payer && tx.payload?.payee && tx.payload.payer === tx.payload.payee) {
        throw new Error('Transacción rechazada: La wallet pagadora y receptora son idénticas.');
      }
      setHandshakeStep(3);
      await receiveAndCounterSign(tx);
      setFeedback({ type: 'success', message: `¡Cobro Confirmado! +${tx.payload.amount} ${tx.payload.asset}` });
      try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors: ['#10B981', '#0062FF'] }); } catch (e) {}
      setShowManualCounterSign(false);
      setManualPayload('');
      setParsedPayload(null);
      setPendingTx(null);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al contrafirmar' });
    } finally {
      setIsCounterSigning(false);
    }
  };

  const handleApplyInvoicePayload = () => {
    if (!parsedPayload || parsedPayload.type !== 'INVOICE') return;
    const inv = parsedPayload.invoice;
    setPayeeAddress(inv.payee);
    setPayAmount(inv.amount ? inv.amount.toString() : '1.00');
    setPayMemo(inv.memo || 'Pago');
    if (inv.asset) changeSelectedAsset(inv.asset);
    setMode('pay');
    setShowManualCounterSign(false);
    setManualPayload('');
    setParsedPayload(null);
    setFeedback({
      type: 'success',
      message: `¡Cobro cargado exitosamente! Monto: ${inv.amount} ${inv.asset}`
    });
  };

  const handleParseManualPayload = async (raw) => {
    setManualPayload(raw);
    setPayloadError('');
    setParsedPayload(null);
    if (!raw?.trim()) return;
    try {
      const parsed = await parsePaymentQrData(raw);
      if (parsed.type === 'INVOICE') {
        setParsedPayload({ raw, type: 'INVOICE', invoice: parsed });
      } else if (parsed.type === 'PAYMENT') {
        setParsedPayload({ raw, type: 'PAYMENT', tx: parsed.tx });
      } else {
        setPayloadError('Formato de payload no reconocido');
      }
    } catch (e) {
      setPayloadError('Error al leer payload: ' + e.message);
    }
  };

  // No wallet linked guard
  if (!activeWallet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '40px 0', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={30} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
          Vincula una billetera para enviar y recibir pagos offline.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

      {/* Online/Offline Banner */}
      <div style={{
        padding: '8px 14px', borderRadius: 12,
        background: isOnline ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700,
        color: isOnline ? 'var(--color-emerald)' : 'var(--color-rose)'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? 'var(--color-emerald)' : 'var(--color-rose)' }} />
        {isOnline ? 'Online — Conectado a Stellar Testnet' : 'Offline — Modo sin conexión activo'}
      </div>

      {/* Mode Tabs */}
      <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 16, gap: 4 }}>
        <button onClick={() => { setMode('pay'); setFeedback({ type: '', message: '' }); }} style={{
          flex: 1, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: mode === 'pay' ? '#FFFFFF' : 'transparent',
          color: mode === 'pay' ? 'var(--pollar-blue)' : 'var(--text-muted)',
          boxShadow: mode === 'pay' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}>
          <Send size={16} /> Enviar Pago
        </button>
        <button onClick={() => { setMode('receive'); setFeedback({ type: '', message: '' }); }} style={{
          flex: 1, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: mode === 'receive' ? '#FFFFFF' : 'transparent',
          color: mode === 'receive' ? 'var(--color-emerald)' : 'var(--text-muted)',
          boxShadow: mode === 'receive' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}>
          <ArrowDownLeft size={16} /> Cobrar
        </button>
      </div>

      {/* Scan Error */}
      {scanError && (
        <div style={{ padding: 12, borderRadius: 14, background: 'var(--color-rose-bg)', color: 'var(--color-rose)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {scanError}
        </div>
      )}

      {/* Feedback */}
      {feedback.message && (
        <div style={{
          padding: 12, borderRadius: 14, fontSize: 12, fontWeight: 700,
          background: feedback.type === 'error' ? 'var(--color-rose-bg)' : 'var(--color-emerald-bg)',
          color: feedback.type === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)',
        }}>
          {feedback.message}
        </div>
      )}

      {/* ─── SEND MODE ─── */}
      {mode === 'pay' && (
        <div className="pollar-panel">
          <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Transferir a Destinatario</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Disponible en Bóveda: <strong style={{ color: 'var(--pollar-blue)' }}>{availableOffline.toFixed(2)} {activeWallet.asset}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CryptoSelector
                selectedAsset={activeWallet.asset || 'XLM'}
                onSelectAsset={(code) => changeSelectedAsset(code)}
                balances={activeWallet.allBalances || []}
                compact={true}
              />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '4px 8px', borderRadius: 12, fontFamily: 'var(--font-mono)' }}>
                #{activeWallet.currentNonce + 1}
              </span>
            </div>
          </div>

          {/* Scan row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={startScan} style={{
              flex: 1, padding: '14px 16px', borderRadius: 16,
              background: 'var(--pollar-blue-light)', border: '1.5px solid rgba(0,98,255,0.25)',
              color: 'var(--pollar-blue)', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Camera size={18} /> Escanear con Cámara
            </button>
            <label style={{
              width: 52, padding: '14px 0', borderRadius: 16,
              background: 'var(--bg-card-muted)', border: '1.5px solid var(--border-subtle)',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }} title="Cargar imagen de QR">
              <Upload size={18} />
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            {onOpenTransport && (
              <button onClick={onOpenTransport} style={{
                width: 52, padding: '14px 0', borderRadius: 16,
                background: 'var(--bg-card-muted)', border: '1.5px solid var(--border-subtle)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bluetooth size={18} />
              </button>
            )}
          </div>

          <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Dirección del Destinatario (G...)</label>
              <input type="text" value={payeeAddress} onChange={(e) => setPayeeAddress(e.target.value)}
                className="pollar-input" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }} placeholder="G..." required />
            </div>

            <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--bg-card-muted)', borderRadius: 20, border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Monto a Enviar</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', lineHeight: 1 }}>{payAmount || '0'}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--pollar-blue)' }}>{activeWallet.asset}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {quickAmounts.map((amt) => (
                <button key={amt} type="button" onClick={() => setPayAmount(amt)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12, fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  border: payAmount === amt ? '1.5px solid var(--pollar-blue)' : '1px solid var(--border-subtle)',
                  background: payAmount === amt ? 'var(--pollar-blue-light)' : '#FFFFFF',
                  color: payAmount === amt ? 'var(--pollar-blue)' : 'var(--text-muted)',
                }}>
                  {amt}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Concepto / Memo</label>
              <input type="text" value={payMemo} onChange={(e) => setPayMemo(e.target.value)} className="pollar-input" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleDirectPay}
                disabled={isSendingDirect}
                className="pollar-btn-primary"
                style={{ background: 'linear-gradient(135deg, #0062FF 0%, #4F46E5 100%)', boxShadow: '0 4px 14px rgba(0, 98, 255, 0.3)' }}
              >
                <Send size={18} />
                {isSendingDirect ? 'Procesando con Pollar Core...' : 'Enviar Pago On-Chain (Pollar Core)'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={availableOffline <= 0 || parseFloat(payAmount) > availableOffline}
                  className="pollar-btn-secondary"
                  style={{ flex: 1 }}
                >
                  <QrCode size={16} /> QR Offline (Bóveda)
                </button>
                {openSendModal && (
                  <button
                    type="button"
                    onClick={openSendModal}
                    className="pollar-btn-outline-blue"
                    style={{ flex: 1 }}
                  >
                    <Wallet size={16} /> Modal Pollar
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>
              <ShieldCheck size={14} style={{ color: 'var(--color-emerald)' }} />
              <span>Custodia y firma gestionadas por Pollar Core (Sin Private Key)</span>
            </div>

            {availableOffline <= 0 && (
              <div style={{ padding: 14, borderRadius: 14, background: 'var(--color-rose-bg)', color: 'var(--color-rose)', border: '1px solid rgba(244,63,94,0.2)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} />
                <span>Saldo en bóveda agotado. Asigna fondos desde Bóveda.</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Payment QR */}
      {pendingTx && paymentQr && mode === 'pay' && (
        <div className="pollar-panel" style={{ border: '2px solid var(--pollar-blue)', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '6px 14px', borderRadius: 20 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--pollar-blue)', animation: 'pulse 1.5s infinite' }} />
            Paso 1/2: Pago Firmado (Esperando Lectura en Cobrar)
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#FFFFFF',
            padding: 16,
            borderRadius: 22,
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
          }}>
            <img
              src={paymentQr}
              alt="QR Pago"
              style={{
                width: 220,
                height: 220,
                display: 'block',
                borderRadius: 8,
                imageRendering: 'pixelated',
                border: '1px solid #000000'
              }}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(paymentPayloadString);
                setCopiedPayment(true);
                setTimeout(() => setCopiedPayment(false), 2000);
              }}
              style={{
                marginTop: 10,
                padding: '6px 12px',
                borderRadius: 12,
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                color: '#475569',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              {copiedPayment ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              {copiedPayment ? '¡Payload copiado!' : 'Copiar Payload del QR'}
            </button>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#000000', marginTop: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              QR Blanco y Negro de Alta Legibilidad
            </span>
          </div>
          <div>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', display: 'block' }}>{pendingTx.payload.amount} {pendingTx.payload.asset}</span>
            <p style={{ fontSize: 12, color: 'var(--pollar-blue)', fontWeight: 700, marginTop: 4 }}>
              Muestra este QR al cobrador para que lo escanee en el apartado de Cobrar y concluya la transacción
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelPendingPayment(pendingTx.txHash);
              setPendingTx(null);
              setFeedback({ type: 'info', message: 'Emisión de pago cancelada.' });
            }}
            className="pollar-btn-secondary"
            style={{ minWidth: 180, fontSize: 12 }}
          >
            <X size={14} /> Cancelar Emisión
          </button>
        </div>
      )}

      {/* ─── RECEIVE MODE ─── */}
      {mode === 'receive' && (
        <div className="pollar-panel">
          <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowDownLeft size={20} color="var(--color-emerald)" /> Terminal de Cobro
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Genera una factura → Escanea el pago firmado del cliente
              </p>
            </div>
            <CryptoSelector
              selectedAsset={activeWallet.asset || 'XLM'}
              onSelectAsset={(code) => changeSelectedAsset(code)}
              balances={activeWallet.allBalances || []}
              compact={true}
            />
          </div>

          {/* Scan row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={startScan} style={{
              flex: 1, padding: '14px 16px', borderRadius: 16,
              background: 'var(--color-emerald-bg)', border: '1.5px solid rgba(16,185,129,0.3)',
              color: 'var(--color-emerald)', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Camera size={18} /> Escanear con Cámara
            </button>
            <label style={{
              width: 52, padding: '14px 0', borderRadius: 16,
              background: 'var(--bg-card-muted)', border: '1.5px solid var(--border-subtle)',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }} title="Cargar imagen de QR">
              <Upload size={18} />
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            {onOpenTransport && (
              <button onClick={onOpenTransport} style={{
                width: 52, padding: '14px 0', borderRadius: 16,
                background: 'var(--bg-card-muted)', border: '1.5px solid var(--border-subtle)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bluetooth size={18} />
              </button>
            )}
          </div>

          <button onClick={() => setShowManualCounterSign(true)} style={{
            width: '100%', padding: '14px 16px', borderRadius: 16,
            background: 'var(--pollar-blue-light)', border: '1.5px solid rgba(0,98,255,0.25)',
            color: 'var(--pollar-blue)', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <QrCode size={18} /> Ingresar payload manualmente (Cobro o Pago)
          </button>

          {/* Invoice QR */}
          <div style={{ textAlign: 'center', padding: '20px 16px', background: '#F8FAFC', borderRadius: 20, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>Factura QR de Cobro (Blanco y Negro)</span>
            {invoiceQr && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#FFFFFF',
                padding: 14,
                borderRadius: 18,
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 8px 20px -4px rgba(0,0,0,0.06)'
              }}>
                <img
                  src={invoiceQr}
                  alt="Invoice QR"
                  style={{
                    width: 190,
                    height: 190,
                    display: 'block',
                    borderRadius: 8,
                    imageRendering: 'pixelated',
                    border: '1px solid #000000'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(invoicePayloadString);
                    setCopiedInvoice(true);
                    setTimeout(() => setCopiedInvoice(false), 2000);
                  }}
                  style={{
                    marginTop: 8,
                    padding: '6px 12px',
                    borderRadius: 12,
                    background: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  {copiedInvoice ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  {copiedInvoice ? '¡Payload copiado!' : 'Copiar Payload del QR'}
                </button>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#000000', marginTop: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  QR Blanco y Negro de Alta Legibilidad
                </span>
              </div>
            )}
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--pollar-blue)' }}>{receiveAmount} {activeWallet.asset}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Monto a cobrar</label>
            <input type="number" value={receiveAmount} onChange={(e) => setReceiveAmount(e.target.value)} className="pollar-input" step="0.01" min="0.01" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Concepto</label>
            <input type="text" value={receiveMemo} onChange={(e) => setReceiveMemo(e.target.value)} className="pollar-input" />
          </div>
        </div>
      )}

      {/* Manual Counter-Sign / QR Payload Modal */}
      {showManualCounterSign && (
        <div className="pollar-modal-overlay" onClick={() => setShowManualCounterSign(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>Procesar Payload de QR</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Pega el JSON de un cobro o de un pago firmado</p>
              </div>
              <button onClick={() => setShowManualCounterSign(false)} className="pollar-icon-btn"><X size={18} /></button>
            </div>
            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <textarea
                value={manualPayload}
                onChange={(e) => handleParseManualPayload(e.target.value)}
                placeholder='Pega el JSON del QR aquí (cobro o pago)...'
                style={{ width: '100%', height: 120, padding: 12, borderRadius: 14, border: '1px solid var(--border-subtle)', fontSize: 11, fontFamily: 'var(--font-mono)', resize: 'vertical' }}
              />
              {payloadError && <div style={{ padding: 10, borderRadius: 12, background: 'var(--color-rose-bg)', color: 'var(--color-rose)', fontSize: 12 }}>{payloadError}</div>}
              
              {/* Invoice Preview */}
              {parsedPayload && parsedPayload.type === 'INVOICE' && (
                <div style={{ padding: 12, borderRadius: 14, background: 'var(--pollar-blue-light)', border: '1px solid rgba(0,98,255,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--pollar-blue)' }}>✓ Factura de Cobro Válida</span>
                  <span style={{ fontSize: 18, fontWeight: 900 }}>{parsedPayload.invoice.amount} {parsedPayload.invoice.asset}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Destinatario: {parsedPayload.invoice.payee?.slice(0, 16)}...</span>
                  {parsedPayload.invoice.memo && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepto: {parsedPayload.invoice.memo}</span>
                  )}
                </div>
              )}

              {/* Payment Preview */}
              {parsedPayload && parsedPayload.type === 'PAYMENT' && (
                <div style={{ padding: 12, borderRadius: 14, background: 'var(--color-emerald-bg)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-emerald)' }}>✓ Pago Firmado Válido</span>
                  <span style={{ fontSize: 18, fontWeight: 900 }}>{parsedPayload.tx.payload.amount} {parsedPayload.tx.payload.asset}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Pagador: {parsedPayload.tx.payload.payer?.slice(0, 16)}...</span>
                </div>
              )}

              {parsedPayload?.type === 'INVOICE' ? (
                <button onClick={handleApplyInvoicePayload} className="pollar-btn-primary">
                  Cargar Factura para Pagar
                </button>
              ) : (
                <button onClick={handleManualCounterSign} disabled={!parsedPayload || isCounterSigning} className="pollar-btn-emerald">
                  {isCounterSigning ? 'Contrafirmando...' : 'Confirmar Contrafirma'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(decodedText) => handleScannedData(decodedText)}
        title={mode === 'pay' ? 'Escanear QR de Factura' : 'Escanear QR de Pago'}
      />
    </div>
  );
}
