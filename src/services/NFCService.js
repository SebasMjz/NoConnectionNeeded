/**
 * NFCService — Web NFC API wrapper (Chrome 89+ on Android).
 * No plugins needed - uses the browser's built-in NFC support.
 */

let hasWebNFC = false;
try {
  hasWebNFC = typeof window !== 'undefined' && 'NDEFReader' in window;
} catch {}

const POLLAR_MIME_TYPE = 'application/vnd.pollar-p2p';

export class NFCService {
  constructor() {
    this.isAvailable = false;
    this.onPayloadReceived = null;
  }

  async initialize() {
    if (hasWebNFC) {
      this.isAvailable = true;
      console.log('[NFC] Web NFC API available (Chrome 89+)');
      return true;
    }

    // Web NFC not available - check if we're on mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // Many Android devices have NFC but Chrome may not expose Web NFC
      // Still report available - we'll handle errors gracefully
      this.isAvailable = false;
    }

    console.warn('[NFC] Web NFC API not available');
    this.isAvailable = false;
    return false;
  }

  static isNFCSupported() {
    return hasWebNFC;
  }

  async read() {
    if (!this.isAvailable) {
      throw new Error('NFC requiere Android con soporte Web NFC. Usa Chrome 89+. Usa QR como alternativa.');
    }

    const reader = new NDEFReader();
    await reader.scan();

    return new Promise((resolve, reject) => {
      const onReading = (event) => {
        for (const record of event.message.records) {
          if (record.mediaType === POLLAR_MIME_TYPE || record.recordType === 'text') {
            const decoder = new TextDecoder();
            try { resolve(JSON.parse(decoder.decode(record.data))); } catch { resolve(null); }
            return;
          }
        }
        resolve(null);
      };
      const onError = () => reject(new Error('NFC read error'));

      reader.addEventListener('reading', onReading);
      reader.addEventListener('readingerror', onError);

      // Timeout after 30s
      setTimeout(() => {
        reader.removeEventListener('reading', onReading);
        reader.removeEventListener('readingerror', onError);
        reject(new Error('NFC read timeout'));
      }, 30000);
    });
  }

  async write(payload) {
    if (!this.isAvailable) {
      throw new Error('NFC requiere Android con soporte Web NFC. Usa Chrome 89+. Usa QR como alternativa.');
    }

    const writer = new NDEFWriter();
    await writer.write({
      records: [{
        recordType: 'mime',
        mediaType: POLLAR_MIME_TYPE,
        data: new TextEncoder().encode(JSON.stringify(payload))
      }]
    });
    return true;
  }

  async cleanup() {
    this.onPayloadReceived = null;
  }
}

let instance = null;
export function getNFCService() {
  if (!instance) instance = new NFCService();
  return instance;
}

export default NFCService;
