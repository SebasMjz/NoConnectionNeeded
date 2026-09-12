/**
 * BarcodeService — Native QR scanning for Capacitor Android/iOS.
 * Uses @capacitor/barcode-scanner for reliable camera access in WebView.
 */

let BarcodeScanner;
try {
  BarcodeScanner = require('@capacitor/barcode-scanner').BarcodeScanner;
} catch (e) {
  // Web fallback
}

export class BarcodeService {
  constructor() {
    this.isAvailable = !!BarcodeScanner;
    this.isScanning = false;
  }

  /**
   * Check if barcode scanning is available.
   */
  static isSupported() {
    return !!BarcodeScanner;
  }

  /**
   * Request camera permission from the OS.
   */
  async requestPermission() {
    if (!BarcodeScanner) {
      throw new Error('Barcode scanner not available');
    }
    try {
      const result = await BarcodeScanner.checkPermission({ force: true });
      if (result.granted) return true;
      if (result.denied) {
        throw new Error('Permiso de cámara denegado');
      }
      if (result.neverAskAgain) {
        throw new Error('Permiso de cámara denegado permanentemente. Habilítalo en Ajustes.');
      }
      return false;
    } catch (err) {
      throw new Error('Error al solicitar permiso: ' + (err.message || 'error desconocido'));
    }
  }

  /**
   * Start scanning and return the decoded text.
   * @returns {Promise<string>} decoded QR content
   */
  async scan() {
    if (!BarcodeScanner) {
      throw new Error('Escáner no disponible en este dispositivo');
    }
    if (this.isScanning) {
      throw new Error('Escaneo ya en curso');
    }

    try {
      // Request permission first
      await this.requestPermission();

      this.isScanning = true;

      // Start scanning
      const result = await BarcodeScanner.startScan({
        targetedWidth: 600,
        targetedHeight: 600,
        orientation: 'portrait',
      });

      if (result.hasContent && result.content) {
        return result.content;
      }
      return null;
    } catch (err) {
      if (err.message?.includes('cancelled') || err.message?.includes('User cancelled')) {
        return null; // User cancelled
      }
      throw new Error('Error al escanear: ' + (err.message || 'error desconocido'));
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Stop scanning (cleanup).
   */
  async stop() {
    if (BarcodeScanner && this.isScanning) {
      try {
        await BarcodeScanner.stopScan();
      } catch (e) {}
    }
    this.isScanning = false;
  }

  /**
   * Check if currently scanning.
   */
  isActive() {
    return this.isScanning;
  }
}

// Singleton
let instance = null;
export function getBarcodeService() {
  if (!instance) {
    instance = new BarcodeService();
  }
  return instance;
}

export default BarcodeService;
