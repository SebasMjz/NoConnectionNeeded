/**
 * BarcodeService — QR scanning for web and mobile.
 * Web: uses html5-qrcode (camera via getUserMedia)
 * Mobile: uses @capacitor/barcode-scanner (native plugin)
 */

let BarcodeScanner;
try {
  BarcodeScanner = require('@capacitor/barcode-scanner').BarcodeScanner;
} catch (e) {
  // Web fallback - html5-qrcode loaded dynamically
}

export class BarcodeService {
  constructor() {
    this.isAvailable = !!BarcodeScanner || typeof window !== 'undefined';
    this.isScanning = false;
  }

  static isSupported() {
    return !!BarcodeScanner || typeof window !== 'undefined';
  }

  async requestPermission() {
    if (BarcodeScanner) {
      try {
        const result = await BarcodeScanner.checkPermission({ force: true });
        if (result.granted) return true;
        if (result.denied) throw new Error('Permiso de cámara denegado');
        if (result.neverAskAgain) throw new Error('Permiso denegado permanentemente. Habilítalo en Ajustes.');
        return false;
      } catch (err) {
        throw new Error('Error al solicitar permiso: ' + (err.message || 'error desconocido'));
      }
    }
    // Web: permission handled by browser
    return true;
  }

  async scan() {
    if (!this.isAvailable) {
      throw new Error('Escáner no disponible en este dispositivo');
    }

    // Try native plugin first
    if (BarcodeScanner) {
      try {
        await this.requestPermission();
        this.isScanning = true;
        const result = await BarcodeScanner.startScan({
          targetedWidth: 600,
          targetedHeight: 600,
          orientation: 'portrait',
        });
        this.isScanning = false;
        if (result.hasContent && result.content) return result.content;
        return null;
      } catch (err) {
        this.isScanning = false;
        if (err.message?.includes('cancelled') || err.message?.includes('canceled')) return null;
        throw new Error('Error al escanear: ' + (err.message || 'error desconocido'));
      }
    }

    // Web fallback: use html5-qrcode
    if (typeof window !== 'undefined') {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        this.isScanning = true;

        return new Promise((resolve, reject) => {
          const qrRegionId = 'pollar-qr-reader-web';
          
          // Create container if not exists
          let container = document.getElementById(qrRegionId);
          if (!container) {
            container = document.createElement('div');
            container.id = qrRegionId;
            container.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
            document.body.appendChild(container);
          }
          container.style.display = 'flex';

          const html5QrCode = new Html5Qrcode(qrRegionId);

          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          // Add cancel button
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancelar';
          cancelBtn.style.cssText = 'padding:12px 32px;border-radius:20px;background:rgba(255,255,255,0.2);color:#fff;font-size:14px;font-weight:800;border:none;cursor:pointer;';
          cancelBtn.onclick = async () => {
            try { await html5QrCode.stop(); } catch {}
            container.style.display = 'none';
            this.isScanning = false;
            resolve(null);
          };
          container.appendChild(cancelBtn);

          html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              html5QrCode.stop().then(() => {
                container.style.display = 'none';
                this.isScanning = false;
                resolve(decodedText);
              }).catch(() => {
                container.style.display = 'none';
                this.isScanning = false;
                resolve(decodedText);
              });
            },
            () => {} // ignore errors during scan
          ).catch(err => {
            container.style.display = 'none';
            this.isScanning = false;
            reject(new Error('No se pudo iniciar la cámara. Asegúrate de dar permiso.'));
          });
        });
      } catch (err) {
        this.isScanning = false;
        throw new Error('Error al iniciar escáner web: ' + (err.message || 'error desconocido'));
      }
    }

    throw new Error('Escáner no disponible');
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
  if (!instance) instance = new BarcodeService();
  return instance;
}

export default BarcodeService;
