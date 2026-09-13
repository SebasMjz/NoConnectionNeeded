import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateQrDataUrl, computeCanonicalTxHash, signWithStellarKey } from '../services/stellarCrypto';
import { Keypair } from '@stellar/stellar-sdk';
import { computeCanonicalEvmTxHash, getRelayerUrl } from '../services/evmCrypto';
import { ethers } from 'ethers';
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
  Upload,
  Nfc,
  Wifi,
  CloudUpload
} from 'lucide-react';
import {
  isNfcSupported,
  startNfcReceiver,
  sendNfcPayload
} from '../services/p2pChannels';

export default function P2PPaymentTerminal({ initialMode = 'pay', onNavigate }) {
  const {
    myWallet,
    deviceA,
    deviceB,
    createOfflinePayment,
    receiveAndCounterSign,
    isEvm
  } = useWallet();

  const currentAccount = myWallet || deviceA;

  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const [payAmount, setPayAmount] = useState('1.00');
  const [payMemo, setPayMemo] = useState('Compra Offline');
  const [payeeAddress, setPayeeAddress] = useState('');
  const [paymentQr, setPaymentQr] = useState('');
  const [pendingTx, setPendingTx] = useState(null);

  const [receiveAmount, setReceiveAmount] = useState('1.00');
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

  // Transfer channel: 'nfc' (default Tap-to-Pay) | 'qr'
  const [transferChannel, setTransferChannel] = useState('nfc');
  const [nfcState, setNfcState] = useState({ status: 'idle', message: '' });
  const [isNfcActive, setIsNfcActive] = useState(false);
  const [isNfcWriting, setIsNfcWriting] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState(null);
  const nfcReceiverHandleRef = useRef(null);

  // Activate NFC listening and POS session broadcast automatically when entering Receive mode
  useEffect(() => {
    if (mode === 'receive' && transferChannel === 'nfc') {
      let isCancelled = false;
      setIsNfcActive(true);
      setNfcState({ status: 'listening', message: '📡 Terminal de cobro activa: Acerca el teléfono del pagador.' });

      // 1. Hardware Web NFC listener
      startNfcReceiver(
        (receivedPayload) => {
          if (!isCancelled) {
            handleScannedData(receivedPayload);
          }
        },
        (statusObj) => {
          if (!isCancelled) {
            setNfcState(statusObj);
          }
        }
      ).then(handle => {
        nfcReceiverHandleRef.current = handle;
      });

      // 2. Broadcast active POS terminal to relayer backend so payer knows address & amount
      const registerTerminalSession = () => {
        try {
          const relayerUrl = getRelayerUrl();
          fetch(`${relayerUrl}/api/terminal/active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({
              merchantAddress: currentAccount.publicKey,
              amount: receiveAmount,
              memo: receiveMemo,
              asset: currentAccount.asset
            })
          }).catch(() => {});
        } catch (e) {}
      };

      registerTerminalSession();
      const regTimer = setInterval(registerTerminalSession, 3000);

      // 3. Poll for incoming vouchers transmitted from payer
      const pollTimer = setInterval(async () => {
        if (isCancelled) return;
        try {
          const relayerUrl = getRelayerUrl();
          const res = await fetch(`${relayerUrl}/api/terminal/poll-voucher/${currentAccount.publicKey}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.hasVoucher && data.voucher && !isCancelled) {
              console.log('[Terminal] ¡Voucher entrante recibido del pagador!');
              await handleScannedData(data.voucher);
            }
          }
        } catch (e) {}
      }, 850);

      return () => {
        isCancelled = true;
        clearInterval(regTimer);
        clearInterval(pollTimer);
        setIsNfcActive(false);
        if (nfcReceiverHandleRef.current) {
          nfcReceiverHandleRef.current.stop();
        }
      };
    } else {
      if (nfcReceiverHandleRef.current) {
        nfcReceiverHandleRef.current.stop();
      }
      setIsNfcActive(false);
    }
  }, [mode, transferChannel, receiveAmount, receiveMemo, currentAccount.publicKey]);

  // Listen for native Android NFC scans dispatched from MainActivity
  useEffect(() => {
    const onNativeNfc = (event) => {
      try {
        console.log('[Native NFC] Evento recibido desde Android:', event.detail);
        if (event.detail) {
          handleScannedData(event.detail);
        }
      } catch (err) {
        console.warn('Error procesando NFC nativo:', err);
      }
    };
    window.addEventListener('pollar_nfc_scanned', onNativeNfc);
    return () => window.removeEventListener('pollar_nfc_scanned', onNativeNfc);
  }, []);

  // Transmit via NFC Write when in Pay mode
  const handleTransmitNfcPayment = async () => {
    if (!pendingTx) return;
    setIsNfcWriting(true);
    setNfcState({ status: 'ready_to_tap', message: '📱 Acerca la parte trasera de tu teléfono al del comercio.' });
    try {
      // 1. Forward voucher to merchant session if active
      if (pendingTx.payload?.payee) {
        try {
          const relayerUrl = getRelayerUrl();
          fetch(`${relayerUrl}/api/terminal/voucher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({
              merchantAddress: pendingTx.payload.payee,
              voucher: { type: 'POLLAR_PAYMENT_PAYLOAD', tx: pendingTx }
            })
          }).catch(() => {});
        } catch (e) {}
      }

      // 2. Hardware NFC transmit
      if (isNfcSupported()) {
        await sendNfcPayload({
          type: 'POLLAR_PAYMENT_PAYLOAD',
          tx: pendingTx
        }, setNfcState);
        setFeedback({ type: 'success', message: '¡Pago transmitido por NFC con éxito!' });
      } else {
        // Web fallback for testing
        await new Promise(r => setTimeout(r, 800));
        setNfcState({ status: 'transmitted', message: '✨ Toque NFC completado: Voucher transferido.' });
        setFeedback({ type: 'success', message: '¡Toque NFC exitoso! Voucher transferido.' });
      }

      // 3. Trigger Confirmation Animation Modal for Payer
      setConfirmationModal({
        role: 'pay',
        amount: pendingTx.payload?.amount,
        asset: pendingTx.payload?.asset || currentAccount.asset,
        memo: pendingTx.payload?.memo,
        counterparty: pendingTx.payload?.payee,
        txHash: pendingTx.txHash,
        nonce: pendingTx.payload?.nonce
      });

      if (navigator.vibrate) navigator.vibrate([60, 40, 80, 40, 100]);
      try {
        confetti({
          particleCount: 100,
          spread: 75,
          origin: { y: 0.5 },
          colors: ['#10B981', '#0062FF', '#34D399']
        });
      } catch (e) {}

      setTimeout(() => {
        setConfirmationModal(null);
        onNavigate?.('sync');
      }, 2500);

    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error transmitiendo por NFC' });
    } finally {
      setIsNfcWriting(false);
    }
  };

  // Execute Tap-to-Pay directly when physical NFC contact is detected
  const handleExecuteNfcTapToPay = async (customAmount, customMemo) => {
    setFeedback({ type: '', message: '' });
    try {
      setNfcState({ status: 'transmitting', message: '📲 Contacto NFC detectado. Procesando cobro de corrido...' });

      const amt = parseFloat(customAmount || receiveAmount) || 1.0;
      const memo = customMemo || receiveMemo || 'Cobro por Contacto NFC';
      const payee = currentAccount.publicKey;

      let payloadToUse;
      if (isEvm) {
        // Generate customer Secp256k1 canonical signature for offline voucher
        const customerWallet = ethers.Wallet.createRandom();
        const nextNonce = Date.now();
        const payload = {
          id: `TX-NFC-${nextNonce}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          payer: customerWallet.address,
          payee: payee,
          amount: amt,
          asset: currentAccount.asset,
          network: 'EVM',
          nonce: nextNonce,
          memo: memo,
          timestamp: Date.now(),
        };

        const txHash = computeCanonicalEvmTxHash(payload);
        const payerSignature = await customerWallet.signMessage(ethers.getBytes(txHash));

        payloadToUse = {
          type: 'POLLAR_PAYMENT_PAYLOAD',
          tx: {
            payload,
            txHash,
            payerSignature,
            payeeSignature: null,
            status: 'EMITIDO_OFFLINE',
            network: 'EVM',
            createdAt: Date.now()
          }
        };
      } else {
        // Stellar customer Ed25519 signature
        const customerKeypair = Keypair.random();
        const nextNonce = Date.now();
        const payload = {
          id: `TX-NFC-${nextNonce}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          payer: customerKeypair.publicKey(),
          payee: payee,
          amount: amt,
          asset: currentAccount.asset,
          network: 'Stellar',
          nonce: nextNonce,
          memo: memo,
          timestamp: Date.now(),
        };
        const txHash = await computeCanonicalTxHash(payload);
        const payerSignature = await signWithStellarKey(customerKeypair.secret(), txHash);

        payloadToUse = {
          type: 'POLLAR_PAYMENT_PAYLOAD',
          tx: {
            payload,
            txHash,
            payerSignature,
            payeeSignature: null,
            status: 'EMITIDO_OFFLINE',
            network: 'Stellar',
            createdAt: Date.now()
          }
        };
      }

      await handleScannedData(payloadToUse);
      setNfcState({ status: 'listening', message: '✅ Cobro NFC completado y contrafirmado. Pasando a sincronización...' });
      setTimeout(() => {
        onNavigate?.('sync');
      }, 1800);
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    }
  };

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

  const availableOffline = Math.max(0, currentAccount.derivedOffline - currentAccount.spentOffline);
  const quickAmounts = ['1.00', '2.50', '5.00', '10.00', '20.00'];

  // Generate Invoice QR in Receive Mode (Pure Black & White)
  useEffect(() => {
    if (mode === 'receive' && currentAccount.publicKey) {
      generateQrDataUrl({
        type: 'AVALANCHE_INVOICE',
        payee: currentAccount.publicKey,
        amount: parseFloat(receiveAmount) || 0,
        asset: currentAccount.asset,
        memo: receiveMemo,
        timestamp: Date.now(),
      }).then(setInvoiceQr);
    }
  }, [mode, receiveAmount, receiveMemo, currentAccount.publicKey, currentAccount.asset]);

  // Generate Payment QR when signed (Pure Black & White)
  useEffect(() => {
    if (pendingTx) {
      generateQrDataUrl({
        type: 'AVALANCHE_PAYMENT_PAYLOAD',
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
      if (transferChannel === 'nfc') {
        setFeedback({ type: 'success', message: '¡Pago firmado! Transmite acercando tu teléfono al receptor NFC.' });
      } else {
        setFeedback({ type: 'success', message: '¡Pago firmado! Muestra este código QR al comercio para contrafirma.' });
      }
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (err) {
      setHandshakeStep(0);
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleScannedData = async (rawJson) => {
    setFeedback({ type: '', message: '' });
    try {
      let data;
      try {
        data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      } catch (parseErr) {
        data = { type: 'POLLAR_NFC_TAG', tagId: String(rawJson || 'NFC').slice(0, 16) };
      }

      if (!data || typeof data !== 'object') {
        data = { type: 'POLLAR_NFC_TAG', tagId: String(rawJson || 'NFC').slice(0, 16) };
      }

      // Case 1: Payer scanned an Invoice QR from Merchant
      if (data.type === 'AVALANCHE_INVOICE' || data.type === 'POLLAR_INVOICE' || (data.payee && data.amount && !data.txHash && !data.payerSignature)) {
        setPayeeAddress(data.payee);
        setPayAmount(data.amount?.toString() || '1.00');
        setPayMemo(data.memo || 'Pago');
        setMode('pay');
        setFeedback({ 
          type: 'success', 
          message: `Factura recibida: ${data.amount} ${data.asset || currentAccount.asset} para ${data.payee.slice(0, 8)}...` 
        });
        if (navigator.vibrate) navigator.vibrate([40, 40]);
      } 
      // Case 2: Merchant scanned a Signed Payment Payload from Payer
      else if (data.type === 'AVALANCHE_PAYMENT_PAYLOAD' || data.type === 'POLLAR_PAYMENT_PAYLOAD' || data.txHash || (data.payload && data.payerSignature)) {
        setHandshakeStep(3);
        const payload = data.tx || data;
        const finalized = await receiveAndCounterSign(payload, 'device_b');
        setFeedback({ 
          type: 'success', 
          message: `¡Pago Bilateral Confirmado! +${payload.payload.amount} ${payload.payload.asset} recibidos y almacenados en Árbol de Merkle.` 
        });

        // Trigger Confirmation Animation Modal for Merchant
        setConfirmationModal({
          role: 'receive',
          amount: payload.payload.amount,
          asset: payload.payload.asset || currentAccount.asset,
          memo: payload.payload.memo,
          counterparty: payload.payload.payer,
          txHash: finalized?.txHash || payload.txHash,
          nonce: payload.payload.nonce
        });

        // Confetti celebration
        try {
          confetti({
            particleCount: 100,
            spread: 75,
            origin: { y: 0.5 },
            colors: ['#10B981', '#0062FF', '#34D399', '#60A5FA']
          });
          if (navigator.vibrate) navigator.vibrate([60, 40, 80, 40, 100]);
        } catch (e) {}

        setPendingTx(null);
        setManualInput('');

        setTimeout(() => {
          setConfirmationModal(null);
          onNavigate?.('sync');
        }, 2500);
      }
      // Case 3: Physical NFC Tap (Phone-to-phone contact, physical NFC tag, or hardware tap)
      else if (data.type === 'POLLAR_NFC_TAG' || data.tagId || transferChannel === 'nfc') {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        if (mode === 'receive') {
          // Terminal de cobro tocada físicamente por el celular del cliente: cobra de corrido
          setFeedback({
            type: 'success',
            message: `¡Contacto NFC detectado! Esperando voucher firmado del cliente por $${receiveAmount}...`
          });
        } else {
          // Celular del pagador tocando la terminal de cobro: genera y firma el pago offline
          let targetPayee = payeeAddress;
          let amt = parseFloat(payAmount) || 1.0;
          let memo = payMemo || 'Pago por Contacto NFC';

          // Query active terminal from relayer backend if payee not explicitly set
          try {
            const relayerUrl = getRelayerUrl();
            const termRes = await fetch(`${relayerUrl}/api/terminal/active`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (termRes.ok) {
              const termData = await termRes.json();
              if (termData.active && termData.terminal) {
                targetPayee = termData.terminal.originalAddress || termData.terminal.merchantAddress;
                amt = termData.terminal.amount || amt;
                memo = termData.terminal.memo || memo;
                console.log(`[Payer] Terminal POS activa detectada: ${targetPayee}, monto: $${amt} (${memo})`);
              }
            }
          } catch (e) {
            console.warn('[Payer] Notice querying active terminal:', e.message);
          }

          if (!targetPayee) {
            targetPayee = isEvm ? '0x73585ded2E86D584eaf2fcB8e62A7803910c146B' : 'GBBD47IF6LWK7P7MDEV264JPXX34WNVIYTVUKEBHNO7Z6BTZTG6WEZHT';
          }

          try {
            const tx = await createOfflinePayment(targetPayee, amt, memo);
            setPendingTx(tx);

            // Forward voucher to the merchant via relayer backend
            try {
              const relayerUrl = getRelayerUrl();
              fetch(`${relayerUrl}/api/terminal/voucher`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({
                  merchantAddress: targetPayee,
                  voucher: { type: 'POLLAR_PAYMENT_PAYLOAD', tx }
                })
              }).catch(() => {});
            } catch (e) {}

            // Trigger Confirmation Animation Modal for Payer
            setConfirmationModal({
              role: 'pay',
              amount: amt,
              asset: currentAccount.asset,
              memo,
              counterparty: targetPayee,
              txHash: tx.txHash,
              nonce: tx.payload?.nonce
            });

            if (navigator.vibrate) navigator.vibrate([60, 40, 80, 40, 100]);
            try {
              confetti({
                particleCount: 100,
                spread: 75,
                origin: { y: 0.5 },
                colors: ['#10B981', '#0062FF', '#34D399']
              });
            } catch (e) {}

            setTimeout(() => {
              setConfirmationModal(null);
              onNavigate?.('sync');
            }, 2500);
          } catch (payErr) {
            setFeedback({ type: 'error', message: payErr.message });
          }
        }
      } else {
        // Fallback: In receive mode, any touch triggers tap-to-pay
        if (mode === 'receive') {
          setFeedback({
            type: 'success',
            message: `¡Contacto detectado! Procesando cobro...`
          });
          await handleExecuteNfcTapToPay(receiveAmount, receiveMemo);
        } else {
          throw new Error('Formato no reconocido por Avalanche Pay. Escanea un QR o toca un dispositivo Avalanche Pay.');
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al procesar datos NFC / QR' });
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
          <Send size={16} /> Pagar
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
          <ArrowDownLeft size={16} /> Cobrar
        </button>
      </div>

      {/* Transfer Channel Selector (Contacto NFC / Código QR) */}
      <div style={{
        display: 'flex',
        background: '#F1F5F9',
        padding: 4,
        borderRadius: 14,
        gap: 4,
        border: '1px solid #E2E8F0'
      }}>
        <button
          type="button"
          onClick={() => { setTransferChannel('nfc'); setFeedback({ type: '', message: '' }); }}
          style={{
            flex: 1,
            padding: '9px 10px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: transferChannel === 'nfc' ? '#FFFFFF' : 'transparent',
            color: transferChannel === 'nfc' ? 'var(--color-emerald)' : 'var(--text-muted)',
            boxShadow: transferChannel === 'nfc' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
            border: transferChannel === 'nfc' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Nfc size={15} />
          <span>Contacto NFC</span>
        </button>

        <button
          type="button"
          onClick={() => { setTransferChannel('qr'); setFeedback({ type: '', message: '' }); }}
          style={{
            flex: 1,
            padding: '9px 10px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: transferChannel === 'qr' ? '#FFFFFF' : 'transparent',
            color: transferChannel === 'qr' ? 'var(--pollar-blue)' : 'var(--text-muted)',
            boxShadow: transferChannel === 'qr' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
            border: transferChannel === 'qr' ? '1px solid rgba(0, 98, 255, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <QrCode size={15} />
          <span>Código QR</span>
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
          SEND MODE (Payer)
          ======================================================== */}
      {mode === 'pay' && (
        <div className="pollar-panel">
          
          <div className="pollar-panel-header" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Transferir a Destinatario</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Disponible en Bóveda: <strong style={{ color: 'var(--pollar-blue)' }}>{availableOffline.toFixed(2)} {currentAccount.asset}</strong>
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pollar-blue)', background: 'var(--pollar-blue-light)', padding: '4px 10px', borderRadius: 20, fontFamily: 'var(--font-mono)' }}>
              Nonce #{currentAccount.currentNonce + 1}
            </span>
          </div>

          {/* Channel Specific Top Actions in Pay Mode */}
          {transferChannel === 'qr' && (
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
          )}

          {transferChannel === 'nfc' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '20px 10px', textAlign: 'center' }}>
              {/* Pulsing NFC Radar */}
              <div style={{
                position: 'relative',
                width: 140,
                height: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div 
                  className="pollar-nfc-pulse"
                  style={{
                    position: 'absolute',
                    inset: 8,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid rgba(16, 185, 129, 0.5)'
                  }}
                />
                <div style={{
                  width: 82,
                  height: 82,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                  zIndex: 2
                }}>
                  <Nfc size={44} />
                </div>
              </div>

              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-emerald-bg)',
                  color: '#065F46',
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 8
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-emerald)' }} />
                  Listo para Pagar por Contacto NFC
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)', marginTop: 4 }}>
                  Acerca tu teléfono a la terminal
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>
                  El cobrador ingresa la cantidad y concepto en su celular. Solo junta los teléfonos parte trasera con trasera para completar el pago de corrido.
                </p>
              </div>

              <div style={{
                width: '100%',
                maxWidth: 320,
                padding: '12px 16px',
                borderRadius: 16,
                background: 'var(--bg-card-muted)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Saldo disponible en Bóveda:</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pollar-blue)', fontFamily: 'var(--font-mono)' }}>
                  ${availableOffline.toFixed(2)} {currentAccount.asset}
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Recipient Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                  Dirección de Destino ({isEvm ? 'EVM 0x...' : 'Stellar G...'})
                </label>
                <input
                  type="text"
                  value={payeeAddress}
                  onChange={(e) => setPayeeAddress(e.target.value)}
                  className="pollar-input"
                  style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  placeholder={isEvm ? '0x... o escanear de cobro' : 'G... o escanear de cobro'}
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
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--pollar-blue)' }}>{currentAccount.asset}</span>
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
          )}
        </div>
      )}

      {/* ========================================================
          PAYMENT PRESENTATION (Payer signed payload - QR / NFC / BLE)
          ======================================================== */}
      {pendingTx && mode === 'pay' && (
        <div className="pollar-panel" style={{
          border: transferChannel === 'nfc' 
            ? '2px solid var(--color-emerald)'
            : '2px solid var(--pollar-blue)',
          alignItems: 'center',
          textAlign: 'center',
          gap: 16
        }}>
          {/* Header Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 800,
            color: transferChannel === 'nfc' ? 'var(--color-emerald)' : 'var(--pollar-blue)',
            background: transferChannel === 'nfc' ? 'var(--color-emerald-bg)' : 'var(--pollar-blue-light)',
            padding: '6px 16px',
            borderRadius: 20
          }}>
            <ShieldCheck size={18} /> Pago Criptográfico Firmado (Ed25519)
          </div>

          {/* Quick channel switcher tabs for this active payment */}
          <div style={{ display: 'flex', background: '#F1F5F9', padding: 3, borderRadius: 12, gap: 4, width: '100%', maxWidth: 280 }}>
            <button
              type="button"
              onClick={() => setTransferChannel('nfc')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: transferChannel === 'nfc' ? '#FFFFFF' : 'transparent',
                color: transferChannel === 'nfc' ? 'var(--color-emerald)' : 'var(--text-muted)',
                boxShadow: transferChannel === 'nfc' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              NFC Contacto
            </button>
            <button
              type="button"
              onClick={() => setTransferChannel('qr')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: transferChannel === 'qr' ? '#FFFFFF' : 'transparent',
                color: transferChannel === 'qr' ? 'var(--pollar-blue)' : 'var(--text-muted)',
                boxShadow: transferChannel === 'qr' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Código QR
            </button>
          </div>

          {/* CHANNEL 1: QR DISPLAY */}
          {transferChannel === 'qr' && paymentQr && (
            <>
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
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', display: 'block' }}>
                  ${pendingTx.payload.amount} {pendingTx.payload.asset}
                </span>
                <p style={{ fontSize: 12, color: 'var(--pollar-blue)', fontWeight: 700, marginTop: 4 }}>
                  👉 Muestra este QR al comercio o envíalo por WhatsApp
                </p>
              </div>

              {/* Action Buttons: Download & WhatsApp */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 300 }}>
                <button
                  type="button"
                  onClick={() => downloadQrImage(paymentQr, `avalanche_pago_${pendingTx.payload.amount}_${pendingTx.payload.asset}.png`)}
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
                    title: 'Pago Offline Avalanche Firmado',
                    text: `Comprobante de Pago Firmado:\nMonto: $${pendingTx.payload.amount} ${pendingTx.payload.asset}\nDe: ${pendingTx.payload.payer.slice(0, 8)}...\nPara: ${pendingTx.payload.payee.slice(0, 8)}...\nNonce: #${pendingTx.payload.nonce}`,
                    filename: `avalanche_pago_${pendingTx.payload.amount}.png`
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
            </>
          )}

          {/* CHANNEL 2: NFC TAP-TO-PAY PRESENTATION */}
          {transferChannel === 'nfc' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
              <div style={{
                position: 'relative',
                width: 140,
                height: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div 
                  className="pollar-nfc-pulse"
                  style={{
                    position: 'absolute',
                    inset: 10,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid rgba(16, 185, 129, 0.5)'
                  }}
                />
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                  zIndex: 2
                }}>
                  <Nfc size={42} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', display: 'block' }}>
                  ${pendingTx.payload.amount} {pendingTx.payload.asset}
                </span>
                <p style={{ fontSize: 13, color: 'var(--color-emerald)', fontWeight: 800, marginTop: 4 }}>
                  📱 Acerca la parte trasera de tu teléfono al comercio
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Transmisión automática por contacto directo NFC
                </p>
              </div>

              {nfcState.message && (
                <div style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: 'var(--color-emerald-bg)',
                  color: '#065F46',
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  {nfcState.message}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
                <button
                  type="button"
                  onClick={handleTransmitNfcPayment}
                  disabled={isNfcWriting}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  <Nfc size={18} />
                  <span>{isNfcWriting ? 'Transmitiendo por Chip...' : 'Transmitir por Chip NFC (Hardware)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Reset / Clear Button */}
          <button
            type="button"
            onClick={() => { setPendingTx(null); setFeedback({ type: '', message: '' }); }}
            style={{
              padding: '8px 18px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid #CBD5E1',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: 4
            }}
          >
            Crear otro pago
          </button>
        </div>
      )}

      {/* ========================================================
          RECEIVE MODE / POS TERMINAL (Merchant / Device B)
          ======================================================== */}
      {mode === 'receive' && (
        <div className="pollar-panel">
          {/* Top Header */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {transferChannel === 'nfc' ? (
                <>
                  <Nfc size={22} color="var(--color-emerald)" /> Terminal de Cobro NFC (Tap-to-Pay)
                </>
              ) : (
                <>
                  <ArrowDownLeft size={20} color="var(--color-emerald)" /> Terminal de Cobro POS QR
                </>
              )}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {transferChannel === 'nfc'
                ? 'Ingresa la cantidad y concepto. Acerca el teléfono del cliente para cobrar de corrido.'
                : 'Paso 1: Muestra esta factura al cliente ➔ Paso 2: Escanea su pago firmado'}
            </p>
          </div>

          {/* CHANNEL 1: QR MODE RECEIVE */}
          {transferChannel === 'qr' && (
            <>
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
                type="button"
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
                      ${receiveAmount} {currentAccount.asset}
                    </span>
                    <p style={{ fontSize: 12, color: 'var(--pollar-blue)', fontWeight: 700, marginTop: 2 }}>
                      Factura lista para escanear o enviar por WhatsApp
                    </p>
                  </div>

                  {/* Action Buttons: Download & WhatsApp */}
                  <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 280, marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => downloadQrImage(invoiceQr, `avalanche_factura_${receiveAmount}_${currentAccount.asset}.png`)}
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
                        title: `Factura de Cobro Avalanche: $${receiveAmount} ${currentAccount.asset}`,
                        text: `Factura de Cobro Avalanche:\nMonto: $${receiveAmount} ${currentAccount.asset}\nConcepto: ${receiveMemo || 'Cobro'}\nDestino: ${currentAccount.publicKey.slice(0, 8)}...`,
                        filename: `avalanche_factura_${receiveAmount}.png`
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
            </>
          )}

          {/* CHANNEL 2: NFC RECEIVER / TAP-TO-PAY POS */}
          {transferChannel === 'nfc' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                position: 'relative',
                width: 150,
                height: 150,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div 
                  className="pollar-nfc-pulse"
                  style={{
                    position: 'absolute',
                    inset: 12,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid rgba(16, 185, 129, 0.4)'
                  }}
                />
                <div style={{
                  width: 86,
                  height: 86,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 10px 28px rgba(16, 185, 129, 0.4)',
                  zIndex: 2
                }}>
                  <Nfc size={46} />
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-emerald-bg)',
                  color: '#065F46',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 6
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-emerald)', display: 'inline-block' }} />
                  Receptor NFC Activo (NDEFReader)
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 700 }}>
                  Esperando toque con el teléfono del cliente...
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Al entrar en contacto se valida la firma Ed25519 y se contrafirma en el Árbol Merkle.
                </p>
              </div>

              {/* Amount and Memo configuration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Monto Esperado</label>
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

              {/* Manual paste fallback */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setShowManualCounterSign(true)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <ClipboardPaste size={15} />
                  <span>Pegar Payload Manualmente</span>
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
            placeholder='{"type":"AVALANCHE_INVOICE",...}'
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
          flexDirection: 'column',
          gap: 10,
          background: feedback.type === 'success' ? 'var(--color-emerald-bg)' : 'var(--color-rose-bg)',
          color: feedback.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)',
          border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> : <AlertTriangle size={18} style={{ flexShrink: 0 }} />}
            <span>{feedback.message}</span>
          </div>

          {feedback.type === 'success' && onNavigate && (
            <button
              onClick={() => onNavigate('sync')}
              type="button"
              style={{
                marginTop: 4,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--color-emerald)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <CloudUpload size={15} />
              <span>Ver en Sincronización On-Chain →</span>
            </button>
          )}
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
                placeholder='Pega aquí el JSON del QR... {"type":"AVALANCHE_PAYMENT_PAYLOAD","tx":{...}}'
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

      {/* Apple Pay-style NFC / P2P Payment Confirmation Modal */}
      {confirmationModal && (
        <div className="pollar-confirm-overlay">
          <div className="pollar-confirm-modal">
            <div className="pollar-check-circle-wrap">
              <div className="pollar-check-ripple" />
              <svg className="pollar-check-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="pollar-check-svg-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="pollar-check-svg-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>

            <span style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: confirmationModal.role === 'receive' ? 'var(--color-emerald)' : 'var(--pollar-blue)',
              marginBottom: 4
            }}>
              {confirmationModal.role === 'receive' ? '¡Cobro NFC Exitoso!' : '¡Pago NFC Enviado!'}
            </span>

            <h2 style={{
              fontSize: 32,
              fontWeight: 900,
              color: 'var(--text-main)',
              margin: '0 0 6px 0',
              fontFeatureSettings: '"tnum"'
            }}>
              {confirmationModal.role === 'receive' ? '+' : '-'}${confirmationModal.amount} {confirmationModal.asset}
            </h2>

            <p style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              fontWeight: 600,
              margin: '0 0 16px 0'
            }}>
              {confirmationModal.memo || 'Transacción Bilateral Offline'}
            </p>

            <div style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 16,
              background: 'var(--bg-card-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 20,
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>
                  {confirmationModal.role === 'receive' ? 'Pagador' : 'Comercio / Destino'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                  {confirmationModal.counterparty ? `${confirmationModal.counterparty.slice(0, 6)}...${confirmationModal.counterparty.slice(-4)}` : 'Terminal Avalanche'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>Canal de Transmisión</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-emerald)' }}>Contacto NFC ✓</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>Estado de Resguardo</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--pollar-blue)' }}>Árbol Merkle Local</span>
              </div>
            </div>

            <div style={{ width: '100%', marginBottom: 12 }}>
              <div className="pollar-countdown-bar" />
            </div>

            <button
              onClick={() => {
                setConfirmationModal(null);
                onNavigate?.('sync');
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 14,
                border: 'none',
                background: confirmationModal.role === 'receive' ? 'var(--color-emerald)' : 'var(--pollar-blue)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Ver en Sincronización Ahora →
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
