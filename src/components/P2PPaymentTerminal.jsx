import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateQrDataUrl } from '../services/stellarCrypto';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  QrCode,
  Scan,
  Send,
  ArrowDownLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Zap,
  ClipboardPaste
} from 'lucide-react';

export default function P2PPaymentTerminal() {
  const {
    activeDevice,
    deviceA,
    deviceB,
    createOfflinePayment,
    receiveAndCounterSign
  } = useWallet();

  const [mode, setMode] = useState(activeDevice === 'device_b' ? 'receive' : 'pay');

  const [payAmount, setPayAmount] = useState('2.50');
  const [payMemo, setPayMemo] = useState('Compra Offline');
  const [payeeAddress, setPayeeAddress] = useState(deviceB.publicKey);
  const [paymentQr, setPaymentQr] = useState('');
  const [pendingTx, setPendingTx] = useState(null);

  const [receiveAmount, setReceiveAmount] = useState('2.50');
  const [receiveMemo, setReceiveMemo] = useState('Cobro');
  const [invoiceQr, setInvoiceQr] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [handshakeStep, setHandshakeStep] = useState(0);

  const availableOffline = deviceA.derivedOffline - deviceA.spentOffline;

  useEffect(() => {
    if (mode === 'receive') {
      generateQrDataUrl({
        type: 'POLLAR_INVOICE',
        payee: deviceB.publicKey,
        amount: parseFloat(receiveAmount) || 0,
        asset: deviceB.asset,
        memo: receiveMemo,
        timestamp: Date.now(),
      }, '#00f2fe').then(setInvoiceQr);
    }
  }, [mode, receiveAmount, receiveMemo, deviceB.publicKey, deviceB.asset]);

  useEffect(() => {
    if (pendingTx) {
      generateQrDataUrl({
        type: 'POLLAR_PAYMENT_PAYLOAD',
        tx: pendingTx
      }, '#10b981').then(setPaymentQr);
    }
  }, [pendingTx]);

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      try {
        scanner = new Html5QrcodeScanner('qr-reader', {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          rememberLastUsedCamera: true
        });
        scanner.render(
          (decodedText) => {
            handleScannedData(decodedText);
            scanner.clear();
            setIsScanning(false);
          },
          () => {}
        );
      } catch (err) {
        console.warn('QR Scanner error:', err);
      }
    }
    return () => { if (scanner) try { scanner.clear(); } catch (e) {} };
  }, [isScanning]);

  const handlePay = async (e) => {
    e?.preventDefault();
    setFeedback({ type: '', message: '' });
    setHandshakeStep(1);
    try {
      const tx = await createOfflinePayment(payeeAddress, payAmount, payMemo);
      setPendingTx(tx);
      setHandshakeStep(2);
      setFeedback({ type: 'success', message: 'Pago firmado. Muestra el QR al cobrador.' });
    } catch (err) {
      setHandshakeStep(0);
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleInstantPay = async () => {
    setFeedback({ type: '', message: '' });
    setHandshakeStep(1);
    try {
        const tx = await createOfflinePayment(deviceB.publicKey, payAmount, payMemo);
        setHandshakeStep(2);
        setTimeout(async () => {
          await receiveAndCounterSign(tx, 'device_b');
          setHandshakeStep(3);
        setFeedback({ type: 'success', message: `Pago completado: -${payAmount} USDT` });
        setPendingTx(null);
      }, 400);
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
        setFeedback({ type: 'success', message: `Factura: ${data.amount} ${data.asset}` });
      } else if (data.type === 'POLLAR_PAYMENT_PAYLOAD' || data.txHash) {
        setHandshakeStep(3);
        const payload = data.tx || data;
        await receiveAndCounterSign(payload, activeDevice);
        setFeedback({ type: 'success', message: `Pago validado: ${payload.payload.amount} USDT` });
        setPendingTx(null);
        setManualInput('');
      } else {
        throw new Error('Formato QR no reconocido');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">

      {/* Mode Toggle */}
      <div className="flex items-center p-1 glass-panel bg-[rgba(16,21,34,0.9)]">
        <button
          onClick={() => { setMode('pay'); setFeedback({ type: '', message: '' }); }}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            mode === 'pay'
              ? 'bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#07090e] shadow-[0_4px_15px_rgba(0,242,254,0.3)]'
              : 'text-[#94a3b8]'
          }`}
        >
          <Send className="w-4 h-4" /> Enviar
        </button>
        <button
          onClick={() => { setMode('receive'); setFeedback({ type: '', message: '' }); }}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            mode === 'receive'
              ? 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)]'
              : 'text-[#94a3b8]'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" /> Cobrar
        </button>
      </div>

      {/* Send Mode */}
      {mode === 'pay' && (
        <div className="glass-panel p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-[#00f2fe]" /> Pago Offline
            </h3>
            <p className="text-[10px] text-[#94a3b8]">
              Disponible: <strong className="text-[#00f2fe]">{availableOffline.toFixed(2)} {deviceA.asset}</strong>
            </p>
          </div>

          <form onSubmit={handlePay} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#94a3b8] mb-1 block">Destinatario (G...)</label>
              <input
                type="text"
                value={payeeAddress}
                onChange={(e) => setPayeeAddress(e.target.value)}
                className="w-full glass-input font-mono text-[11px] py-2"
                placeholder="G..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#94a3b8] mb-1 block">Monto</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={availableOffline}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full glass-input text-lg font-bold font-mono pr-12 py-2"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#00f2fe]">
                    {deviceA.asset}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#94a3b8] mb-1 block">Concepto</label>
                <input
                  type="text"
                  value={payMemo}
                  onChange={(e) => setPayMemo(e.target.value)}
                  className="w-full glass-input text-sm py-2"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="submit"
                disabled={availableOffline <= 0 || parseFloat(payAmount) > availableOffline}
                className="flex-1 btn-primary py-2.5 text-xs"
              >
                <QrCode className="w-4 h-4" /> Generar QR
              </button>
              <button
                type="button"
                onClick={handleInstantPay}
                disabled={availableOffline <= 0 || parseFloat(payAmount) > availableOffline}
                className="flex-1 btn-emerald py-2.5 text-xs"
              >
                <Zap className="w-4 h-4" /> Pago Directo
              </button>
            </div>

            {availableOffline <= 0 && (
              <div className="p-2.5 rounded-lg bg-[rgba(244,63,94,0.12)] text-[#f43f5e] border border-[rgba(244,63,94,0.25)] text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Saldo agotado. Transfiere fondos desde la Bóveda.</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Receive Mode */}
      {mode === 'receive' && (
        <div className="glass-panel p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <ArrowDownLeft className="w-4 h-4 text-[#10b981]" /> Generar Factura
            </h3>
            <p className="text-[10px] text-[#94a3b8]">
              Muestra el QR al pagador para cobrar
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#94a3b8] mb-1 block">Monto</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
                className="w-full glass-input text-lg font-bold font-mono py-2"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#94a3b8] mb-1 block">Concepto</label>
              <input
                type="text"
                value={receiveMemo}
                onChange={(e) => setReceiveMemo(e.target.value)}
                className="w-full glass-input text-sm py-2"
              />
            </div>
          </div>

          {invoiceQr && (
            <div className="flex flex-col items-center p-4 rounded-xl bg-[rgba(10,14,24,0.9)] border border-[rgba(0,242,254,0.25)] shadow-[0_0_20px_rgba(0,242,254,0.1)]">
              <img src={invoiceQr} alt="Factura QR" className="w-56 h-56 rounded-lg border border-[rgba(255,255,255,0.08)]" />
              <div className="mt-2.5 text-center">
                <span className="text-xs font-bold text-white block">{receiveAmount} {deviceB.asset}</span>
                <p className="text-[10px] text-[#94a3b8]">Escanea para pagar</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment QR Display */}
      {pendingTx && paymentQr && (
        <div className="glass-panel p-5 flex flex-col items-center space-y-3 border-[rgba(16,185,129,0.3)]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#10b981]">
            <ShieldCheck className="w-4 h-4" /> Pago Firmado (Ed25519)
          </div>
          <img src={paymentQr} alt="QR Pago" className="w-56 h-56 rounded-lg border border-[rgba(255,255,255,0.08)]" />
          <span className="text-[10px] font-mono text-[#94a3b8] truncate max-w-[250px]">
            Hash: {pendingTx.txHash.substring(0, 20)}...
          </span>
        </div>
      )}

      {/* Scanner */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <Scan className="w-3.5 h-3.5 text-[#00f2fe]" /> Escáner QR
          </h3>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              isScanning
                ? 'bg-[#f43f5e] text-white'
                : 'bg-[rgba(0,242,254,0.12)] text-[#00f2fe] border border-[rgba(0,242,254,0.25)]'
            }`}
          >
            <Camera className="w-3 h-3" />
            {isScanning ? 'Cerrar' : 'Abrir Cámara'}
          </button>
        </div>

        {isScanning ? (
          <div className="p-1.5 rounded-xl bg-[rgba(10,14,24,0.9)] border border-[rgba(0,242,254,0.25)] relative overflow-hidden">
            <div id="qr-reader" className="w-full h-56 rounded-lg overflow-hidden" />
            <div className="scanline-effect" />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-[#64748b]">O pega el payload JSON manualmente:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder='{"type":"POLLAR_INVOICE",...}'
                className="flex-1 glass-input text-[10px] font-mono py-2"
              />
              <button
                onClick={() => handleScannedData(manualInput)}
                disabled={!manualInput}
                className="px-3 py-2 bg-[rgba(0,242,254,0.15)] hover:bg-[rgba(0,242,254,0.25)] text-[#00f2fe] rounded-lg text-[11px] font-bold transition-all"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Handshake Indicator */}
      <div className="glass-panel p-3.5 space-y-2">
        <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Handshake Criptográfico:</span>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          {[
            { step: 1, label: 'Firma A', color: 'cyan' },
            { step: 2, label: 'Transmitir', color: 'purple' },
            { step: 3, label: 'Contrafirma B', color: 'emerald' },
          ].map(({ step, label, color }) => (
            <div key={step} className={`p-1.5 rounded-lg border transition-all ${
              handshakeStep >= step
                ? color === 'cyan'
                  ? 'bg-[rgba(0,242,254,0.12)] text-[#00f2fe] border-[rgba(0,242,254,0.3)] font-bold'
                  : color === 'purple'
                  ? 'bg-[rgba(168,85,247,0.12)] text-[#a855f7] border-[rgba(168,85,247,0.3)] font-bold'
                  : 'bg-[rgba(16,185,129,0.12)] text-[#10b981] border-[rgba(16,185,129,0.3)] font-bold'
                : 'bg-[rgba(255,255,255,0.02)] text-[#4a5568] border-[rgba(255,255,255,0.04)]'
            }`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {feedback.message && (
        <div className={`p-3 rounded-xl flex items-center gap-2.5 text-[11px] font-medium ${
          feedback.type === 'success'
            ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981] border border-[rgba(16,185,129,0.25)]'
            : 'bg-[rgba(244,63,94,0.12)] text-[#f43f5e] border border-[rgba(244,63,94,0.25)]'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
