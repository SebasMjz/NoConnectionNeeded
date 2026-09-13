/**
 * BarcodeService — Universal QR scanning for Capacitor Android/iOS and Web.
 * Uses @capacitor/barcode-scanner (CapacitorBarcodeScanner) and html5-qrcode.
 */
import { Capacitor } from '@capacitor/core';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHint,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation
} from '@capacitor/barcode-scanner';

export class BarcodeService {
  constructor() {
    this.isScanning = false;
  }

  static isSupported() {
    return true;
  }

  /**
   * Start camera scanning and return the decoded QR text.
   * Works on native Android/iOS (using native camera) and web (using html5-qrcode).
   * @returns {Promise<string|null>}
   */
  async scan() {
    if (this.isScanning) {
      console.warn('[BarcodeService] Escaneo ya en curso');
      return null;
    }

    this.isScanning = true;

    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
        scanInstructions: 'Apunta la cámara al código QR de Pollar',
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
        web: {
          showCameraSelection: true,
          scannerFPS: 15,
        }
      });

      if (result && result.ScanResult) {
        return result.ScanResult;
      }
      return null;
    } catch (err) {
      const msg = err?.message || String(err);
      if (
        msg.includes('cancel') ||
        msg.includes('Cancel') ||
        msg.includes('stopped') ||
        msg.includes('User cancelled') ||
        msg.includes('dismissed')
      ) {
        return null; // Cancelado por el usuario
      }
      console.error('[BarcodeService] Error al escanear:', err);
      throw new Error('Error al acceder a la cámara: ' + (err.message || 'Verifica los permisos de cámara'));
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Decode QR code from an image file (useful on desktop, simulator, or gallery upload)
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  async scanFile(file) {
    const { Html5Qrcode } = await import('html5-qrcode');
    let tempDiv = document.getElementById('pollar-qr-file-decoder');
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = 'pollar-qr-file-decoder';
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
    }
    const html5Qr = new Html5Qrcode('pollar-qr-file-decoder');
    try {
      const text = await html5Qr.scanFile(file, true);
      return text;
    } finally {
      try { await html5Qr.clear(); } catch (e) {}
    }
  }

  async stop() {
    this.isScanning = false;
  }

  isActive() {
    return this.isScanning;
  }
}

let instance = null;
export function getBarcodeService() {
  if (!instance) {
    instance = new BarcodeService();
  }
  return instance;
}

export default BarcodeService;
