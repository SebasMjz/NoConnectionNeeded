/**
 * BarcodeService — QR scanner using html5-qrcode.
 * Works on web, Android WebView, and iOS Safari.
 * No native plugin needed.
 */

let Html5QrcodeClass = null;

async function ensureHtml5Qrcode() {
  if (Html5QrcodeClass) return Html5QrcodeClass;
  try {
    const mod = await import('html5-qrcode');
    Html5QrcodeClass = mod.Html5Qrcode || mod.default?.Html5Qrcode || mod;
    return Html5QrcodeClass;
  } catch {
    return null;
  }
}

export class BarcodeService {
  constructor() {
    this.isScanning = false;
    this.scanner = null;
  }

  async isAvailable() {
    const html5 = await ensureHtml5Qrcode();
    return !!html5 && typeof window !== 'undefined';
  }

  async requestPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (err) {
        console.warn('Camera permission error:', err);
        return false;
      }
    }
    return true;
  }

  async scan() {
    if (typeof window === 'undefined') {
      throw new Error('Escáner no disponible en este dispositivo');
    }

    const Html5Qrcode = await ensureHtml5Qrcode();
    if (!Html5Qrcode) {
      throw new Error('Escáner no disponible en este dispositivo');
    }

    this.isScanning = true;

    return new Promise((resolve, reject) => {
      const qrRegionId = 'pollar-qr-reader-container';
      
      let overlay = document.getElementById('pollar-qr-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pollar-qr-overlay';
        document.body.appendChild(overlay);
      }
      
      overlay.innerHTML = '';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;';
      
      const readerDiv = document.createElement('div');
      readerDiv.id = qrRegionId;
      readerDiv.style.cssText = 'width:100%;max-width:400px;min-height:300px;';
      overlay.appendChild(readerDiv);
      
      const label = document.createElement('p');
      label.textContent = 'Apunta al código QR';
      label.style.cssText = 'color:#fff;font-size:14px;font-weight:700;margin:0;';
      overlay.appendChild(label);
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.style.cssText = 'padding:12px 32px;border-radius:20px;background:rgba(255,255,255,0.2);color:#fff;font-size:14px;font-weight:800;border:none;cursor:pointer;';
      overlay.appendChild(cancelBtn);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (this.scanner) {
          try { this.scanner.stop(); } catch {}
          this.scanner = null;
        }
        if (overlay) overlay.remove();
        this.isScanning = false;
      };

      cancelBtn.onclick = () => {
        cleanup();
        reject(new Error('cancelled'));
      };

      this.scanner = new Html5Qrcode(qrRegionId);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      this.scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          cleanup();
          resolve(decodedText);
        },
        () => {}
      ).catch(err => {
        cleanup();
        reject(new Error('No se pudo iniciar la cámara: ' + (err.message || 'error desconocido')));
      });
    });
  }

  async stop() {
    this.isScanning = false;
    if (this.scanner) {
      try { this.scanner.stop(); } catch {}
      this.scanner = null;
    }
    const overlay = document.getElementById('pollar-qr-overlay');
    if (overlay) overlay.remove();
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
