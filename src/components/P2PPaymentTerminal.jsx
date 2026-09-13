import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateQrDataUrl } from '../services/stellarCrypto';
import { getBarcodeService } from '../services/BarcodeService';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Send,
  ArrowDownLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  X,
  Sparkles,
  Bluetooth,
  Wifi,
  Nfc,
  ChevronRight,
  Copy,
  Check,
  ClipboardPaste,
  Download,
  Upload
} from 'lucide-react';

export default function P2PPaymentTerminal({ onOpenTransport }) {
  const {
    activeDevice,
    deviceA,
    deviceB,
    createOfflinePayment,
    receiveAndCounterSign,
    isOnline,
    pendingTx
  } = useWallet();

  const [mode, setMode] = useState(activeDevice === 'device_b' ? 'receive' : 'pay');
  const [payAmount, setPayAmount] = useState('2.50');
  const [payMemo, setPayMemo] = useState('Compra Offline');
  const [payeeAddress, setPayeeAddress] = useState(deviceB.publicKey);
  const [paymentQr, setPaymentQr] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('2.50');
  const [receiveMemo, setReceiveMemo] = useState('Cobro Tienda');
  const [invoiceQr, setInvoiceQr] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [handshakeStep, setHandshakeStep] = useState(0);
  const [scanError, setScanError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [parsedImport, setParsedImport] = useState(null);
  const [importError, setImportError] = useState('');
  const [isCounterSigning, setIsCounterSigning] = useState(false);
  const [copied, setCopied] = useState(false);

  const barcodeService = useRef(getBarcodeService());

  const availableOffline = deviceA.derivedOffline - deviceA.spentOffline;
  const quickAmounts = ['1.00', '2.50', '5.00', '10.00', '20.00'];

  // Sync payee
  useEffect(() => {
    if (!payeeAddress || payeeAddress === deviceA.publicKey) {
      setPayeeAddress(deviceB.publicKey);
    }
  }, [deviceB.publicKey, deviceA.publicKey]);

  // Generate Invoice QR
  useEffect(() => {
    if (mode === 'receive') {
      generateQrDataUrl({
        type: 'POLLAR_INVOICE',
        payee: deviceB.publicKey,
        amount: parseFloat(receiveAmount) || 0,
        asset: deviceB.asset,
        memo: receiveMemo,
        timestamp: Date.now(),
      }, '#0062FF').then(setInvoiceQr);
    }
  }, [mode, receiveAmount, receiveMemo, deviceB.publicKey, deviceB.asset]);

  // Generate Payment QR
  useEffect(() => {
    if (pendingTx) {
      generateQrDataUrl({
        type: 'POLLAR_PAYMENT_PAYLOAD',
        tx: pendingTx
      }, '#10B981').then(setPaymentQr);
    }
  }, [pendingTx]);

  // Native barcode scan
  const startScan = async () => {
    setScanError('');
    setFeedback({ type: '', message: '' });
    try {
      const result = await barcodeService.current.scan();
      if (result) {
        handleScannedData(result);
      }
    } catch (err) {
      if (err.message && !err.message.includes('cancel')) {
        setScanError(err.message || 'Error al escanear');
      }
    }
  };

  const handlePay = async (e) => {
    e?.preventDefault();
    setFeedback({ type: '', message: '' });
    setHandshakeStep(1);
    try {
      const tx = await createOfflinePayment(payeeAddress, payAmount, payMemo);
      setHandshakeStep(2);
      setFeedback({ type: 'success', message: '¡Pago firmado! Muestra este QR al comercio para contrafirma.' });
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (err) {
      setHandshakeStep(0);
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleScannedData = async (rawJson) => {
    setFeedback({ type: '', message: '' });
    try {
      const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

      if (data.type === 'POLLAR_INVOICE') {
        setPayeeAddress(data.payee);
        setPayAmount(data.amount?.toString() || '1.00');
        setPayMemo(data.memo || 'Pago');
        setMode('pay');
        setFeedback({ type: 'success', message: `Factura recibida: ${data.amount} ${data.asset}` });
        if (navigator.vibrate) navigator.vibrate([40, 40]);
      } else if (data.type === 'POLLAR_PAYMENT_PAYLOAD' || data.txHash) {
        setHandshakeStep(3);
        const payload = data.tx || data;
        await receiveAndCounterSign(payload, 'device_b');
        setFeedback({ type: 'success', message: `¡Pago Bilateral Confirmado! +${payload.payload.amount} ${payload.payload.asset}` });
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors: ['#10B981', '#0062FF'] });
          if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
        } catch (e) {}
      } else {
        throw new Error('Formato QR no compatible');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al procesar QR' });
    }
  };

  const handleImportPayload = async () => {
    if (!parsedImport) return;
    setIsCounterSigning(true);
    setFeedback({ type: '', message: '' });
    try {
      const tx = parsedImport.tx;
      setHandshakeStep(3);
      await receiveAndCounterSign(tx, 'device_b');
      setFeedback({ type: 'success', message: `¡Pago Bilateral Confirmado! +${tx.payload.amount} ${tx.payload.asset}` });
      try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors: ['#10B981', '#0062FF'] }); } catch (e) {}
      setShowImportModal(false);
      setImportPayload('');
      setParsedImport(null);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al contrafirmar' });
    } finally {
      setIsCounterSigning(false);
    }
  };

  const handleParseImport = (raw) => {
    setImportPayload(raw);
    setImportError('');
    setParsedImport(null);
    if (!raw?.trim()) return;
    try {
      const data = JSON.parse(raw);
      const tx = data.tx || data;
      if (!tx || (!tx.txHash && !tx.payerSignature)) {
        setImportError('JSON no contiene payload de pago válido');
        return;
      }
      setParsedImport({ raw: data, tx });
    } catch (e) {
      setImportError('JSON inválido: ' + e.message);
    }
  };

  const handleCopyPayload = () => {
    if (pendingTx) {
      navigator.clipboard.writeText(JSON.stringify(pendingTx));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onlineStatus = isOnline;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      {/* Online/Offline Banner */}
      <div style={{
        padding: '8px 14px',
        borderRadius: 12,
        background: onlineStatus ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, fontWeight: 700,
        color: onlineStatus ? 'var(--color-emerald)' : 'var(--color-rose)'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: onlineStatus ? 'var(--color-emerald)' : 'var(--color-rose)' }} />
        {onlineStatus ? 'Online — Conectado a Stellar Testnet' : 'Offline — Modo sin conexión activo'}
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
          <Send size={16} /> Enviar Pago (A)
        </button>
        <button onClick={() => { setMode('receive'); setFeedback({ type: '', message: '' }); }} style={{
          flex: 1, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: mode === 'receive' ? '#FFFFFF' : 'transparent',
          color: mode === 'receive' ? 'var(--color-emerald)' : 'var(--text-muted)',
          boxShadow: mode === 'receive' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}>
          <ArrowDownLeft size={16} /> Terminal Cobrar (B)
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

      {/* ==================== SENDER MODE (Payer A) ==================== */}
      {mode === 'pay' && (
        <div className="pollar-panel">
          <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Enviar Pago a Comercio</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Disponible en Bóveda: <strong style={{ color: 'var(--pollar-blue)' }}>{availableOffline.toFixed(2)} {deviceA.asset}</strong>
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '4px 10px', borderRadius: 20, fontFamily: 'var(--font-mono)' }}>
              Nonce #{deviceA.currentNonce + 1}
            </span>
          </div>

          {/* Scan Invoice Button */}
          <button onClick={startScan} style={{
            width: '100%', padding: '14px 16px', borderRadius: 16,
            background: 'var(--bg-card-muted)', border: '1.5px solid var(--border-subtle)',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Camera size={18} /> Escanear Factura QR del Comercio
          </button>

          <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Dirección del Comercio (Stellar G...)</label>
              <input type="text" value={payeeAddress} onChange={(e) => setPayeeAddress(e.target.value)}
                className="pollar-input" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }} placeholder="G..." required />
            </div>

            <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--bg-card-muted)', borderRadius: 20, border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Monto a Enviar</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', lineHeight: 1 }}>${payAmount || '0'}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pollar-blue)' }}>{deviceA.asset}</span>
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
                  ${amt}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Concepto / Memo</label>
              <input type="text" value={payMemo} onChange={(e) => setPayMemo(e.target.value)} className="pollar-input" />
            </div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button type="submit" disabled={availableOffline <= 0 || parseFloat(payAmount) > availableOffline} className="pollar-btn-primary" style={{ flex: 1 }}>
                <QrCode size={18} /> Firmar y Generar QR
              </button>
            </div>

            {availableOffline <= 0 && (
              <div style={{ padding: 14, borderRadius: 14, background: 'var(--color-rose-bg)', color: 'var(--color-rose)', border: '1px solid rgba(244, 63, 94, 0.2)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} shrink={0} />
                <span>Saldo en bóveda agotado. Asigna fondos desde la pestaña Bóveda.</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ==================== PAYMENT QR + SHARE (Payer A) ==================== */}
      {pendingTx && paymentQr && mode === 'pay' && (
        <div className="pollar-panel" style={{ border: '2px solid var(--color-emerald)', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)', background: 'var(--color-emerald-bg)', padding: '6px 14px', borderRadius: 20 }}>
            <ShieldCheck size={18} /> Pago Criptográfico Firmado (Ed25519)
          </div>
          
          <img src={paymentQr} alt="QR Pago" style={{ width: 220, height: 220, borderRadius: 18, background: '#FFFFFF', padding: 12, border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }} />
          
          <div>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', display: 'block' }}>
              ${pendingTx.payload.amount} {pendingTx.payload.asset}
            </span>
            <p style={{ fontSize: 12, color: 'var(--color-emerald)', fontWeight: 700, marginTop: 4 }}>
              Muestra este QR al comercio o comparte el payload
            </p>
          </div>

          {/* Share buttons */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button onClick={handleCopyPayload} style={{
              flex: 1, padding: '12px', borderRadius: 14,
              background: copied ? 'var(--color-emerald-bg)' : 'var(--pollar-blue-light)',
              border: '1.5px solid', borderColor: copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 98, 255, 0.25)',
              color: copied ? 'var(--color-emerald)' : 'var(--pollar-blue)',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar payload'}
            </button>
            {onOpenTransport && (
              <button onClick={onOpenTransport} style={{
                flex: 1, padding: '12px', borderRadius: 14,
                background: 'var(--bg-card-muted)', border: '1.5px solid var(--border-subtle)',
                color: 'var(--text-muted)', fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Bluetooth size={16} /> Compartir por...
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== RECEIVE MODE (Merchant B) ==================== */}
      {mode === 'receive' && (
        <div className="pollar-panel">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowDownLeft size={20} color="var(--color-emerald)" /> Terminal de Cobro POS
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Paso 1: Genera factura → Paso 2: Escanea pago del cliente o importa payload
            </p>
          </div>

          {/* Scan Payment QR */}
          <button onClick={startScan} style={{
            width: '100%', padding: '14px 16px', borderRadius: 16,
            background: 'var(--color-emerald-bg)', border: '1.5px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--color-emerald)', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Camera size={18} /> Escanear QR de Pago del Cliente
          </button>

          {/* Import payload manually */}
          <button onClick={() => setShowImportModal(true)} style={{
            width: '100%', padding: '14px 16px', borderRadius: 16,
            background: 'var(--pollar-blue-light)', border: '1.5px solid rgba(0, 98, 255, 0.25)',
            color: 'var(--pollar-blue)', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <ClipboardPaste size={18} /> Importar pago (pegar payload)
          </button>

          {/* Invoice QR Display */}
          <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--pollar-blue-light)', borderRadius: 20, border: '2px dashed rgba(0, 98, 255, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pollar-blue)' }}>Factura para el cliente</span>
            {invoiceQr && <img src={invoiceQr} alt="Invoice QR" style={{ width: 180, height: 180, borderRadius: 14, background: '#FFFFFF', padding: 10 }} />}
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--pollar-blue)' }}>${receiveAmount} {deviceB.asset}</span>
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

      {/* ==================== IMPORT PAYMENT MODAL (Merchant B) ==================== */}
      {showImportModal && (
        <div className="pollar-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="pollar-modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>Importar Pago del Cliente</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pega el payload que copiaste del pagador</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="pollar-icon-btn"><X size={18} /></button>
            </div>
            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <textarea
                value={importPayload}
                onChange={(e) => handleParseImport(e.target.value)}
                placeholder='Pega aquí el JSON del payload de pago...'
                style={{ width: '100%', height: 120, padding: 12, borderRadius: 14, border: '1px solid var(--border-subtle)', fontSize: 11, fontFamily: 'var(--font-mono)', resize: 'vertical' }}
              />
              {importError && <div style={{ padding: 10, borderRadius: 12, background: 'var(--color-rose-bg)', color: 'var(--color-rose)', fontSize: 12 }}>{importError}</div>}
              {parsedImport && (
                <div style={{ padding: 12, borderRadius: 14, background: 'var(--color-emerald-bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-emerald)' }}>Payload válido</span>
                  <span style={{ fontSize: 18, fontWeight: 900 }}>${parsedImport.tx.payload.amount} {parsedImport.tx.payload.asset}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>De: {parsedImport.tx.payload.payer?.slice(0, 16)}...</span>
                </div>
              )}
              <button onClick={handleImportPayload} disabled={!parsedImport || isCounterSigning} className="pollar-btn-primary">
                {isCounterSigning ? 'Contrafirmando...' : 'Confirmar Contrafirma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
