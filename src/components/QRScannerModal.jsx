import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, Upload, AlertCircle, RefreshCw, FlipHorizontal } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHint,
  CapacitorBarcodeScannerCameraDirection
} from '@capacitor/barcode-scanner';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess, title = 'Escanear Código QR' }) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    let qrInstance = null;

    // On native Android, we can try native BarcodeScanner first if preferred,
    // but Html5Qrcode embedded modal gives a beautiful unified in-app UI.
    const startScanner = async () => {
      setIsLoading(true);
      setError('');

      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          throw new Error('No se detectaron cámaras en este dispositivo.');
        }

        setCameras(devices);

        // Find rear/back camera by label preference
        let preferredIndex = devices.findIndex(d => {
          const l = (d.label || '').toLowerCase();
          return l.includes('back') || l.includes('trasera') || l.includes('rear') || l.includes('environment');
        });
        if (preferredIndex === -1) preferredIndex = 0;
        setCurrentCameraIndex(preferredIndex);

        const chosenCameraId = devices[preferredIndex].id;

        qrInstance = new Html5Qrcode('pollar-interactive-qr-reader');
        scannerRef.current = qrInstance;

        await qrInstance.start(
          chosenCameraId,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minDim = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(minDim * 0.75);
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
          },
          async (decodedText) => {
            if (isMounted) {
              await stopScanner();
              onScanSuccess(decodedText);
              onClose();
            }
          },
          () => {
            // Per-frame scanner message: ignore
          }
        );

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[QRScannerModal] Error starting camera:', err);
        setError(err.message || 'No se pudo acceder a la cámara. Revisa los permisos en tu dispositivo.');
        setIsLoading(false);
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          console.warn('[QRScannerModal] Error stopping scanner:', e);
        }
        scannerRef.current = null;
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const handleSwitchCamera = async () => {
    if (cameras.length <= 1 || !scannerRef.current) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    setIsLoading(true);

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      await scannerRef.current.start(
        cameras[nextIndex].id,
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        },
        async (decodedText) => {
          if (scannerRef.current?.isScanning) {
            await scannerRef.current.stop();
          }
          onScanSuccess(decodedText);
          onClose();
        },
        () => {}
      );
      setIsLoading(false);
    } catch (err) {
      setError('Error al cambiar de cámara: ' + err.message);
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsLoading(true);

    try {
      const html5Qr = new Html5Qrcode('pollar-qr-file-decoder-temp');
      const text = await html5Qr.scanFile(file, true);
      try { await html5Qr.clear(); } catch (e) {}
      onScanSuccess(text);
      onClose();
    } catch (err) {
      setError('No se encontró ningún código QR legible en esta imagen.');
      setIsLoading(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleNativeScanFallback = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const res = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
        scanInstructions: 'Apunta al código QR',
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      });
      if (res && res.ScanResult) {
        onScanSuccess(res.ScanResult);
        onClose();
      }
    } catch (err) {
      if (!err.message?.includes('cancel')) {
        setError(err.message || 'Error en escáner nativo');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pollar-modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="pollar-modal-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 460,
          padding: 24,
          background: '#0F172A',
          color: '#FFFFFF',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(0, 98, 255, 0.2)', color: 'var(--pollar-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>{title}</h3>
              <p style={{ fontSize: 11, color: '#94A3B8' }}>Apunta tu cámara al código QR para escanear</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94A3B8', cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera Viewport */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          background: '#020617',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          {isLoading && !error && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(2, 6, 23, 0.8)', gap: 12
            }}>
              <div style={{
                width: 36, height: 36, border: '3px solid rgba(0,98,255,0.3)',
                borderTopColor: 'var(--pollar-blue)', borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Iniciando cámara...</span>
            </div>
          )}

          {error && (
            <div style={{
              padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 12, zIndex: 20
            }}>
              <AlertCircle size={36} color="var(--color-rose)" />
              <span style={{ fontSize: 13, color: '#F87171', fontWeight: 600 }}>{error}</span>
              <p style={{ fontSize: 11, color: '#94A3B8', maxWidth: 260 }}>
                Asegúrate de permitir el permiso de cámara o prueba cargando una foto con el QR.
              </p>
              {Capacitor.isNativePlatform() && (
                <button
                  onClick={handleNativeScanFallback}
                  className="pollar-btn-primary"
                  style={{ fontSize: 12, padding: '8px 16px', minWidth: 160 }}
                >
                  Abrir Escáner Nativo Android
                </button>
              )}
            </div>
          )}

          {/* Video Container Target for Html5Qrcode */}
          <div
            id="pollar-interactive-qr-reader"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Animated Viewfinder Overlay */}
          {!error && !isLoading && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{
                width: '65%', height: '65%',
                border: '2px solid var(--pollar-blue)',
                borderRadius: 16,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                position: 'relative'
              }}>
                {/* Corner Accents */}
                <div style={{ position: 'absolute', top: -2, left: -2, width: 16, height: 16, borderTop: '4px solid #10B981', borderLeft: '4px solid #10B981', borderRadius: '4px 0 0 0' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderTop: '4px solid #10B981', borderRight: '4px solid #10B981', borderRadius: '0 4px 0 0' }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: 16, height: 16, borderBottom: '4px solid #10B981', borderLeft: '4px solid #10B981', borderRadius: '0 0 0 4px' }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderBottom: '4px solid #10B981', borderRight: '4px solid #10B981', borderRadius: '0 0 4px 0' }} />
              </div>
            </div>
          )}
        </div>

        {/* Hidden container for file decoder */}
        <div id="pollar-qr-file-decoder-temp" style={{ display: 'none' }} />

        {/* Bottom Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 14,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                cursor: 'pointer'
              }}
            >
              <FlipHorizontal size={16} /> Cambiar Cámara
            </button>
          )}

          <label
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#FFFFFF', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer'
            }}
          >
            <Upload size={16} /> Subir Foto de QR
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
