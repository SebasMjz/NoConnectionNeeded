import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateQrDataUrl } from '../services/stellarCrypto';
import { downloadQrImage, shareQrToWhatsApp, scanQrFromImageFile } from '../utils/qrSharing';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
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
  ClipboardPaste,
  ArrowRight,
  RefreshCw,
  X,
  Sparkles,
  Smartphone,
  SwitchCamera,
  Download,
  MessageCircle,
  Image,
  Upload
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
  const [receiveMemo, setReceiveMemo] = useState('Cobro Tienda');
  const [invoiceQr, setInvoiceQr] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanContext, setScanContext] = useState('any'); // 'invoice' | 'payment' | 'any'
  const [manualInput, setManualInput] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [handshakeStep, setHandshakeStep] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' (back) | 'user' (front)
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  // Manual counter-sign modal state
  const [showManualCounterSign, setShowManualCounterSign] = useState(false);
  const [manualPayload, setManualPayload] = useState('');
  const [parsedPayload, setParsedPayload] = useState(null);
  const [payloadError, setPayloadError] = useState('');
  const [isCounterSigning, setIsCounterSigning] = useState(false);

  // File upload scanner state
  const fileInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const scannerRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback({ type: '', message: '' });
    setIsUploadingImage(true);

    try {
      if (isScanning) {
        stopCamera();
      }

      const decodedText = await scanQrFromImageFile(file);
      if (decodedText) {
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        setFeedback({ type: 'success', message: '¡Código QR detectado y leído exitosamente desde la imagen!' });
        await handleScannedData(decodedText);
      }
    } catch (err) {
      console.error('File scan error:', err);
      setFeedback({ 
        type: 'error', 
        message: err.message || 'No se pudo leer el código QR de la imagen. Verifica que sea legible.' 
      });
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const availableOffline = deviceA.derivedOffline - deviceA.spentOffline;
  const quickAmounts = ['1.00', '2.50', '5.00', '10.00', '20.00'];

  // Sync default payee when deviceB changes
  useEffect(() => {
    if (!payeeAddress || payeeAddress === deviceA.publicKey) {
      setPayeeAddress(deviceB.publicKey);
    }
  }, [deviceB.publicKey, deviceA.publicKey]);

  // Generate Invoice QR in Receive Mode (Pure Black & White)
  useEffect(() => {
    if (mode === 'receive') {
      generateQrDataUrl({
        type: 'POLLAR_INVOICE',
        payee: deviceB.publicKey,
        amount: parseFloat(receiveAmount) || 0,
        asset: deviceB.asset,
        memo: receiveMemo,
        timestamp: Date.now(),
      }).then(setInvoiceQr);
    }
  }, [mode, receiveAmount, receiveMemo, deviceB.publicKey, deviceB.asset]);

  // Generate Payment QR when signed (Pure Black & White)
  useEffect(() => {
    if (pendingTx) {
      generateQrDataUrl({
        type: 'POLLAR_PAYMENT_PAYLOAD',
        tx: pendingTx
      }).then(setPaymentQr);
    }
  }, [pendingTx]);

  // Start Camera with permissions and clean stream release
  const startCamera = async (targetContext = 'any') => {
    setScanContext(targetContext);
    setCameraError('');
    setIsScanning(true);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacing }
        });
        // Immediately release hardware lock so Html5Qrcode can bind to the device cleanly
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.warn('Camera permission check notice:', err);
    }
  };

  // Flip Camera between rear (environment) and front (user)
  const flipCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    setCameraError('');

    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {}
      }

      setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'));
    } catch (e) {
      console.warn('Error flipping camera:', e);
    } finally {
      setTimeout(() => setIsSwitchingCamera(false), 350);
    }
  };

  // Helper to reliably identify rear vs front camera device IDs
  const getTargetCamera = (cameras, facing) => {
    if (!cameras || cameras.length === 0) {
      return { facingMode: facing };
    }

    const isBack = facing === 'environment';

    if (isBack) {
      // 1. Explicit rear camera labels
      const backCam = cameras.find(c => {
        const l = (c.label || '').toLowerCase();
        return l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('trasera') || l.includes('posterior') || l.includes('0, facing back');
      });
      if (backCam) return backCam.id;

      // 2. Camera without front/selfie in label
      const notFrontCam = cameras.find(c => {
        const l = (c.label || '').toLowerCase();
        return l && !l.includes('front') && !l.includes('user') && !l.includes('delantera') && !l.includes('selfie') && !l.includes('facing front');
      });
      if (notFrontCam) return notFrontCam.id;

      // 3. Fallback: on many Androids with multiple cameras, index 1 is rear or index 0 is rear
      if (cameras.length > 1) {
        return cameras[1].id;
      }
      return { facingMode: 'environment' };
    } else {
      // Front camera requested
      const frontCam = cameras.find(c => {
        const l = (c.label || '').toLowerCase();
        return l.includes('front') || l.includes('user') || l.includes('delantera') || l.includes('selfie') || l.includes('facing front');
      });
      if (frontCam) return frontCam.id;

      return { facingMode: 'user' };
    }
  };

  // Trigger hardware autofocus on active camera track
  const triggerAutoFocus = async () => {
    try {
      const videoEl = document.querySelector('#pollar-qr-reader video');
      if (videoEl && videoEl.srcObject) {
        const track = videoEl.srcObject.getVideoTracks()[0];
        if (track && track.applyConstraints) {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
        }
      }
    } catch (e) {
      console.warn('Tap to focus notice:', e);
    }
  };

  // Camera QR Scanner instance lifecycle
  useEffect(() => {
    let html5QrCode = null;
    let isMounted = true;

    if (isScanning) {
      const qrRegionId = 'pollar-qr-reader';
      const timer = setTimeout(async () => {
        if (!isMounted) return;

        try {
          // Enumerate all available cameras on device
          let cameras = [];
          try {
            cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0 && isMounted) {
              setAvailableCameras(cameras);
            }
          } catch (e) {
            console.warn('Could not enumerate cameras:', e);
          }

          const readerElem = document.getElementById(qrRegionId);
          if (!readerElem || !isMounted) return;

          html5QrCode = new Html5Qrcode(qrRegionId);
          scannerRef.current = html5QrCode;

          const cameraTarget = getTargetCamera(cameras, cameraFacing);

          // HD configuration with continuous autofocus to prevent blurriness
          const videoConstraints = typeof cameraTarget === 'string'
            ? {
                deviceId: { exact: cameraTarget },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                advanced: [{ focusMode: 'continuous' }]
              }
            : {
                facingMode: cameraFacing,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                advanced: [{ focusMode: 'continuous' }]
              };

          const config = {
            fps: 24,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdge * 0.78);
              return {
                width: Math.max(220, qrboxSize),
                height: Math.max(220, qrboxSize)
              };
            },
            aspectRatio: 1.0,
            disableFlip: false,
            videoConstraints: videoConstraints
          };

          const onScanSuccess = (decodedText) => {
            handleScannedData(decodedText);
            stopCamera();
          };

          try {
            await html5QrCode.start(
              cameraTarget,
              config,
              onScanSuccess,
              () => {}
            );
          } catch (firstErr) {
            console.warn('Initial camera start attempt with HD constraints failed, trying direct mode:', firstErr);
            if (!isMounted) return;

            // Fallback to simple camera target without complex constraints
            await html5QrCode.start(
              typeof cameraTarget === 'string' ? cameraTarget : { facingMode: cameraFacing },
              {
                fps: 20,
                aspectRatio: 1.0,
                qrbox: { width: 250, height: 250 }
              },
              onScanSuccess,
              () => {}
            );
          }

          // Directly enable continuous autofocus and autoexposure on the active MediaStreamTrack
          setTimeout(() => {
            if (!isMounted) return;
            try {
              const videoEl = document.querySelector('#pollar-qr-reader video');
              if (videoEl && videoEl.srcObject) {
                const stream = videoEl.srcObject;
                const track = stream.getVideoTracks()[0];
                if (track && track.getCapabilities) {
                  const caps = track.getCapabilities();
                  const advanced = [];
                  if (caps.focusMode && caps.focusMode.includes('continuous')) {
                    advanced.push({ focusMode: 'continuous' });
                  }
                  if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
                    advanced.push({ exposureMode: 'continuous' });
                  }
                  if (advanced.length > 0) {
                    track.applyConstraints({ advanced }).catch(() => {});
                  }
                }
              }
            } catch (e) {
              console.warn('Post-start autofocus notice:', e);
            }
          }, 300);

        } catch (err) {
          console.error('All camera start attempts failed:', err);
          if (isMounted) {
            setCameraError('No se pudo acceder a la cámara. Revisa los permisos de la aplicación.');
          }
        }
      }, 250);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
          } catch (e) {}
        }
      };
    }
  }, [isScanning, cameraFacing]);

  const stopCamera = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      } catch (e) {}
    }
    setIsScanning(false);
    setIsSwitchingCamera(false);
  };

  const handlePay = async (e) => {
    e?.preventDefault();
    setFeedback({ type: '', message: '' });
    setHandshakeStep(1);
    try {
      const tx = await createOfflinePayment(payeeAddress, payAmount, payMemo);
      setPendingTx(tx);
      setHandshakeStep(2);
      setFeedback({ type: 'success', message: '¡Pago firmado! Muestra este código QR al comercio para contrafirma.' });
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

      // Case 1: Payer scanned an Invoice QR from Merchant
      if (data.type === 'POLLAR_INVOICE') {
        setPayeeAddress(data.payee);
        setPayAmount(data.amount?.toString() || '1.00');
        setPayMemo(data.memo || 'Pago');
        setMode('pay');
        setFeedback({ 
          type: 'success', 
          message: `Factura recibida: ${data.amount} ${data.asset} para ${data.payee.slice(0, 8)}...` 
        });
        if (navigator.vibrate) navigator.vibrate([40, 40]);
      } 
      // Case 2: Merchant scanned a Signed Payment Payload from Payer
      else if (data.type === 'POLLAR_PAYMENT_PAYLOAD' || data.txHash) {
        setHandshakeStep(3);
        const payload = data.tx || data;
        await receiveAndCounterSign(payload, 'device_b');
        setFeedback({ 
          type: 'success', 
          message: `¡Pago Bilateral Confirmado! +${payload.payload.amount} ${payload.payload.asset} recibidos y almacenados en Árbol de Merkle.` 
        });

        // Confetti celebration
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.55 },
            colors: ['#10B981', '#0062FF', '#34D399', '#60A5FA']
          });
          if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
        } catch (e) {}

        setPendingTx(null);
        setManualInput('');
      } else {
        throw new Error('Formato QR no compatible con Pollar');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al procesar QR' });
    }
  };

  // Parse manual payload for counter-sign preview
  const handleParseManualPayload = (raw) => {
    setManualPayload(raw);
    setPayloadError('');
    setParsedPayload(null);

    if (!raw || !raw.trim()) return;

    try {
      const data = JSON.parse(raw);

      // Accept both wrapped and unwrapped formats
      const tx = data.tx || data;
      if (!tx || (!tx.txHash && !tx.payerSignature)) {
        setPayloadError('El JSON no contiene un payload de pago válido. Falta txHash o firma.');
        return;
      }

      if (!tx.payload || !tx.payload.amount) {
        setPayloadError('El payload no contiene datos de monto o destinatario.');
        return;
      }

      setParsedPayload({ raw: data, tx });
    } catch (e) {
      setPayloadError('JSON inválido: ' + e.message);
    }
  };

  // Handle manual counter-sign submission
  const handleManualCounterSign = async () => {
    if (!parsedPayload) return;
    setIsCounterSigning(true);
    setFeedback({ type: '', message: '' });

    try {
      const tx = parsedPayload.tx;
      setHandshakeStep(3);
      await receiveAndCounterSign(tx, 'device_b');
      setFeedback({
        type: 'success',
        message: `¡Pago Bilateral Confirmado! +${tx.payload.amount} ${tx.payload.asset} recibidos y almacenados en Árbol de Merkle.`
      });

      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.55 },
          colors: ['#10B981', '#0062FF', '#34D399', '#60A5FA']
        });
        if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
      } catch (e) {}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 16, gap: 4 }}>
        <button
          onClick={() => { setMode('pay'); setFeedback({ type: '', message: '' }); stopCamera(); }}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: mode === 'pay' ? '#FFFFFF' : 'transparent',
            color: mode === 'pay' ? 'var(--pollar-blue)' : 'var(--text-muted)',
            boxShadow: mode === 'pay' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Send size={16} /> Enviar Pago (A)
        </button>
        <button
          onClick={() => { setMode('receive'); setFeedback({ type: '', message: '' }); stopCamera(); }}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: mode === 'receive' ? '#FFFFFF' : 'transparent',
            color: mode === 'receive' ? 'var(--color-emerald)' : 'var(--text-muted)',
            boxShadow: mode === 'receive' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowDownLeft size={16} /> Terminal Cobrar (B)
        </button>
      </div>

      {/* CAMERA SCANNER MODAL / OVERLAY */}
      {isScanning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 150,
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 20px 40px 20px'
        }}>
          {/* Top Bar */}
          <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={20} color="var(--pollar-blue)" />
              <span style={{ fontSize: 15, fontWeight: 800 }}>
                {scanContext === 'invoice' ? 'Escanear Factura QR' : 'Escanear QR de Pago'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Upload QR Image from Gallery */}
              <button
                type="button"
                onClick={triggerFileSelect}
                title="Subir QR desde Galería o WhatsApp"
                style={{
                  padding: '8px 12px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  border: '1px solid rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <Image size={15} />
                <span>Galería</span>
              </button>

              {/* Flip Camera Button */}
              <button
                type="button"
                onClick={flipCamera}
                disabled={isSwitchingCamera}
                title="Girar Cámara (Trasera / Frontal)"
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  border: '1px solid rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <SwitchCamera size={16} className={isSwitchingCamera ? 'animate-spin' : ''} />
                <span>{isSwitchingCamera ? 'Girando...' : (cameraFacing === 'environment' ? 'Trasera' : 'Frontal')}</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Camera Viewport */}
          <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div
              onClick={triggerAutoFocus}
              title="Toca para re-enfocar"
              style={{
                width: '100%',
                borderRadius: 24,
                overflow: 'hidden',
                background: '#1E293B',
                border: '2px solid rgba(0, 98, 255, 0.5)',
                position: 'relative',
                boxShadow: '0 0 30px rgba(0, 98, 255, 0.3)',
                cursor: 'pointer'
              }}
            >
              <div id="pollar-qr-reader" style={{ width: '100%', minHeight: 280 }} />
              {/* Scanning Target Guide & Laser Sweep */}
              <div className="pollar-scanner-target">
                <div className="pollar-scanner-laser" />
              </div>
            </div>

            {cameraError ? (
              <div style={{ padding: 12, borderRadius: 14, background: 'rgba(244,63,94,0.2)', color: '#FDA4AF', fontSize: 12, textAlign: 'center' }}>
                {cameraError}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontWeight: 700 }}>
                  {cameraFacing === 'environment' ? '📷 Cámara Trasera (Autofocus HD)' : '🤳 Cámara Frontal'}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                  Apunta al código QR. Toca la pantalla para re-enfocar o "Girar" para alternar.
                </p>
              </div>
            )}
          </div>

          {/* Cancel button */}
          <button
            onClick={stopCamera}
            style={{
              padding: '12px 32px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 800
            }}
          >
            Cerrar Cámara
          </button>
        </div>
      )}

      {/* ========================================================
          SEND MODE (Payer / Device A)
          ======================================================== */}
      {mode === 'pay' && (
        <div className="pollar-panel">
          
          <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Transferir a Destinatario</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Disponible en Bóveda: <strong style={{ color: 'var(--pollar-blue)' }}>{availableOffline.toFixed(2)} {deviceA.asset}</strong>
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '4px 10px', borderRadius: 20, fontFamily: 'var(--font-mono)' }}>
              Nonce #{deviceA.currentNonce + 1}
            </span>
          </div>

          {/* Quick Scan or Upload Invoice Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => startCamera('invoice')}
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'var(--pollar-blue-light)',
                border: '1.5px solid rgba(0, 98, 255, 0.25)',
                color: 'var(--pollar-blue)',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Camera size={17} />
              <span>Escanear Cámara</span>
            </button>
            <button
              type="button"
              onClick={triggerFileSelect}
              disabled={isUploadingImage}
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: '#F8FAFC',
                border: '1.5px solid #CBD5E1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Image size={17} />
              <span>{isUploadingImage ? 'Leyendo...' : 'Subir de Galería'}</span>
            </button>
          </div>

          <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Recipient Address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Dirección de Destino (Stellar G...)</label>
              <input
                type="text"
                value={payeeAddress}
                onChange={(e) => setPayeeAddress(e.target.value)}
                className="pollar-input"
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                placeholder="G..."
                required
              />
            </div>

            {/* Big Amount Card Display */}
            <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--bg-card-muted)', borderRadius: 20, border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Monto a Enviar</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-1px', lineHeight: 1 }}>
                  ${payAmount || '0'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pollar-blue)' }}>{deviceA.asset}</span>
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div style={{ display: 'flex', gap: 8 }}>
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPayAmount(amt)}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    border: payAmount === amt ? '1.5px solid var(--pollar-blue)' : '1px solid var(--border-subtle)',
                    background: payAmount === amt ? 'var(--pollar-blue-light)' : '#FFFFFF',
                    color: payAmount === amt ? 'var(--pollar-blue)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Concept / Memo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Concepto / Memo</label>
              <input
                type="text"
                value={payMemo}
                onChange={(e) => setPayMemo(e.target.value)}
                className="pollar-input"
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={availableOffline <= 0 || parseFloat(payAmount) > availableOffline}
                className="pollar-btn-primary"
                style={{ flex: 1 }}
              >
                <QrCode size={18} /> Firmar y Generar QR
              </button>
            </div>

            {availableOffline <= 0 && (
              <div style={{
                padding: 14,
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
                <AlertTriangle size={18} shrink={0} />
                <span>Saldo en bóveda agotado. Asigna fondos desde la pestaña Bóveda.</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ========================================================
          PAYMENT QR PRESENTATION (Payer signed payload)
          ======================================================== */}
      {pendingTx && paymentQr && mode === 'pay' && (
        <div className="pollar-panel" style={{ border: '2px solid var(--color-emerald)', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)', background: 'var(--color-emerald-bg)', padding: '6px 14px', borderRadius: 20 }}>
            <ShieldCheck size={18} /> Pago Criptográfico Firmado (Ed25519)
          </div>

          <img 
            src={paymentQr} 
            alt="QR Pago" 
            style={{ 
              width: 220, 
              height: 220, 
              borderRadius: 18, 
              background: '#FFFFFF', 
              padding: 12, 
              border: '2px solid #CBD5E1', 
              boxShadow: 'var(--shadow-card)',
              imageRendering: 'pixelated'
            }} 
          />

          <div>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', display: 'block' }}>
              ${pendingTx.payload.amount} {pendingTx.payload.asset}
            </span>
            <p style={{ fontSize: 12, color: 'var(--color-emerald)', fontWeight: 700, marginTop: 4 }}>
              👉 Muestra este QR al comercio o envíalo por WhatsApp
            </p>
          </div>

          {/* Action Buttons: Download & WhatsApp */}
          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 300, marginTop: 2 }}>
            <button
              type="button"
              onClick={() => downloadQrImage(paymentQr, `pollar_pago_${pendingTx.payload.amount}_${pendingTx.payload.asset}.png`)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 14,
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Download size={15} /> Descargar
            </button>
            <button
              type="button"
              onClick={() => shareQrToWhatsApp({
                dataUrl: paymentQr,
                title: 'Pago Offline Pollar Firmado',
                text: `Comprobante de Pago Firmado:\nMonto: $${pendingTx.payload.amount} ${pendingTx.payload.asset}\nDe: ${pendingTx.payload.payer.slice(0, 8)}...\nPara: ${pendingTx.payload.payee.slice(0, 8)}...\nNonce: #${pendingTx.payload.nonce}`,
                filename: `pollar_pago_${pendingTx.payload.amount}.png`
              })}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 14,
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
              <MessageCircle size={16} /> WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          RECEIVE MODE / POS TERMINAL (Merchant / Device B)
          ======================================================== */}
      {mode === 'receive' && (
        <div className="pollar-panel">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowDownLeft size={20} color="var(--color-emerald)" /> Terminal de Cobro POS
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Paso 1: Muestra esta factura al cliente ➔ Paso 2: Escanea su pago firmado
            </p>
          </div>

          {/* Quick Scan or Upload Customer Payment QR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => startCamera('payment')}
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'var(--color-emerald-bg)',
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--color-emerald)',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Camera size={17} />
              <span>Escanear Cámara</span>
            </button>
            <button
              type="button"
              onClick={triggerFileSelect}
              disabled={isUploadingImage}
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: '#F8FAFC',
                border: '1.5px solid #CBD5E1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Image size={17} />
              <span>{isUploadingImage ? 'Leyendo...' : 'Subir de Galería'}</span>
            </button>
          </div>

          {/* Manual Counter-Sign Button */}
          <button
            onClick={() => setShowManualCounterSign(true)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 16,
              background: 'var(--pollar-blue-light)',
              border: '1.5px solid rgba(0, 98, 255, 0.25)',
              color: 'var(--pollar-blue)',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <ClipboardPaste size={18} />
            <span>Contrafirmar sin Cámara</span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Monto a Cobrar</label>
              <input
                type="number"
                step="0.01"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
                className="pollar-input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Concepto</label>
              <input
                type="text"
                value={receiveMemo}
                onChange={(e) => setReceiveMemo(e.target.value)}
                className="pollar-input"
              />
            </div>
          </div>

          {/* Factura QR Card */}
          {invoiceQr && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', background: 'var(--bg-card-muted)', borderRadius: 24, border: '1px solid var(--border-subtle)', gap: 12 }}>
              <img 
                src={invoiceQr} 
                alt="Factura QR" 
                style={{ 
                  width: 200, 
                  height: 200, 
                  borderRadius: 18, 
                  background: '#FFFFFF', 
                  padding: 12, 
                  border: '2px solid #CBD5E1', 
                  boxShadow: 'var(--shadow-card)',
                  imageRendering: 'pixelated'
                }} 
              />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', display: 'block' }}>
                  ${receiveAmount} {deviceB.asset}
                </span>
                <p style={{ fontSize: 12, color: 'var(--pollar-blue)', fontWeight: 700, marginTop: 2 }}>
                  Factura lista para escanear o enviar por WhatsApp
                </p>
              </div>

              {/* Action Buttons: Download & WhatsApp */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 280, marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => downloadQrImage(invoiceQr, `pollar_factura_${receiveAmount}_${deviceB.asset}.png`)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 14,
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 800,
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
                    dataUrl: invoiceQr,
                    title: `Factura de Cobro Pollar: $${receiveAmount} ${deviceB.asset}`,
                    text: `Factura de Cobro Pollar:\nMonto: $${receiveAmount} ${deviceB.asset}\nConcepto: ${receiveMemo || 'Cobro'}\nDestino: ${deviceB.publicKey.slice(0, 8)}...`,
                    filename: `pollar_factura_${receiveAmount}.png`
                  })}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 14,
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
            </div>
          )}
        </div>
      )}

      {/* Manual JSON Payload Fallback */}
      <div className="pollar-panel" style={{ padding: 16 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>O pega el payload JSON de prueba manualmente:</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder='{"type":"POLLAR_INVOICE",...}'
            className="pollar-input"
            style={{ fontSize: 12, fontFamily: 'var(--font-mono)', height: 42 }}
          />
          <button
            onClick={() => handleScannedData(manualInput)}
            disabled={!manualInput}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'var(--pollar-blue)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ClipboardPaste size={16} />
          </button>
        </div>
      </div>

      {/* Handshake Tracker */}
      <div className="pollar-panel" style={{ padding: 16, gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
          Protocolo Criptográfico Bilateral (NCN)
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { step: 1, label: '1. Factura POS', color: 'blue' },
            { step: 2, label: '2. Firma Ed25519', color: 'blue' },
            { step: 3, label: '3. Contrafirma POS', color: 'emerald' },
          ].map(({ step, label, color }) => (
            <div key={step} style={{
              padding: '8px 4px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 800,
              textAlign: 'center',
              background: handshakeStep >= step
                ? (color === 'emerald' ? 'var(--color-emerald-bg)' : 'var(--pollar-blue-light)')
                : 'var(--bg-card-muted)',
              color: handshakeStep >= step
                ? (color === 'emerald' ? 'var(--color-emerald)' : 'var(--pollar-blue)')
                : 'var(--text-light)',
              border: handshakeStep >= step
                ? (color === 'emerald' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0, 98, 255, 0.3)')
                : '1px solid var(--border-subtle)',
              transition: 'all 0.2s ease'
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback.message && (
        <div style={{
          padding: 16,
          borderRadius: 16,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: feedback.type === 'success' ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
          color: feedback.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)',
          border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ========================================================
          MANUAL COUNTER-SIGN MODAL
          ======================================================== */}
      {showManualCounterSign && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(7, 9, 14, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--pollar-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardPaste size={18} color="var(--pollar-blue)" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Contrafirmar sin Cámara</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Pega el contenido del QR del cliente</p>
                </div>
              </div>
              <button
                onClick={() => { setShowManualCounterSign(false); setManualPayload(''); setParsedPayload(null); setPayloadError(''); }}
                style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            {/* Instructions */}
            <div style={{ padding: 12, borderRadius: 14, background: 'var(--pollar-blue-light)', fontSize: 12, color: 'var(--pollar-blue)', fontWeight: 600, lineHeight: 1.5 }}>
              <strong>Como obtener el payload:</strong> El cliente debe abrir su código QR firmado y copiar el texto/JSON que contiene, luego enviártelo por mensaje o pegarlo directamente aquí.
            </div>

            {/* Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Payload JSON del Cliente</label>
              <textarea
                value={manualPayload}
                onChange={(e) => handleParseManualPayload(e.target.value)}
                placeholder='Pega aquí el JSON del QR... {"type":"POLLAR_PAYMENT_PAYLOAD","tx":{...}}'
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: 12,
                  borderRadius: 14,
                  border: payloadError ? '1.5px solid var(--color-rose)' : '1px solid var(--border-subtle)',
                  background: 'var(--bg-card-muted)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-main)',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
              {payloadError && (
                <p style={{ fontSize: 11, color: 'var(--color-rose)', fontWeight: 600, margin: 0 }}>{payloadError}</p>
              )}
            </div>

            {/* Parsed Payload Preview */}
            {parsedPayload && parsedPayload.tx && (
              <div style={{
                padding: 16,
                borderRadius: 16,
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                background: 'var(--color-emerald-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)' }}>
                  <ShieldCheck size={16} /> Payload Válido - Vista Previa
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 10, borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: 2 }}>Monto</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>${parsedPayload.tx.payload.amount} {parsedPayload.tx.payload.asset}</span>
                  </div>
                  <div style={{ padding: 10, borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: 2 }}>Concepto</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{parsedPayload.tx.payload.memo || 'Sin memo'}</span>
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: 2 }}>Pagador</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                    {parsedPayload.tx.payload.payer}
                  </span>
                </div>

                <div style={{ padding: 10, borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', display: 'block', marginBottom: 2 }}>Hash de Transacción</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                    {parsedPayload.tx.txHash?.slice(0, 40)}...
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--color-emerald)' }}>
                  <CheckCircle2 size={14} />
                  <span>Firma Ed25519 del pagador presente ✓</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleManualCounterSign}
              disabled={!parsedPayload || isCounterSigning}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 16,
                background: parsedPayload && !isCounterSigning ? 'var(--color-emerald)' : 'var(--bg-card-muted)',
                color: parsedPayload && !isCounterSigning ? '#FFFFFF' : 'var(--text-light)',
                fontSize: 14,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: 'none',
                cursor: parsedPayload && !isCounterSigning ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              {isCounterSigning ? (
                <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Contrafirmando...</>
              ) : (
                <><ShieldCheck size={18} /> Contrafirmar Pago</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Gallery / WhatsApp QR Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

    </div>
  );
}
