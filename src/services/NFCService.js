/**
 * NFCService — Web NFC API wrapper (Chrome 89+ on Android).
 * Uses native browser NDEFReader API - no plugin needed.
 */

const POLLAR_MIME_TYPE = 'application/vnd.pollar-p2p';

export class NFCService {
  constructor() {
    this.isAvailable = false;
    this.onPayloadReceived = null;
  }

  async initialize() {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      this.isAvailable = true;
      console.log('[NFC] Web NFC API available');
      return true;
    }
    console.warn('[NFC] Web NFC API not available');
    this.isAvailable = false;
    return false;
  }

  static isNFCSupported() {
    return typeof window !== 'undefined' && 'NDEFReader' in window;
  }

  async read() {
    if (!this.isAvailable) throw new Error('NFC no disponible');
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
      reader.addEventListener('reading', onReading);
      reader.addEventListener('readingerror', () => reject(new Error('NFC read error')));
      setTimeout(() => { reader.removeEventListener('reading', onReading); reject(new Error('NFC timeout')); }, 30000);
    });
  }

  async write(payload) {
    if (!this.isAvailable) throw new Error('NFC no disponible');
    const writer = new NDEFWriter();
    await writer.write({ records: [{ recordType: 'mime', mediaType: POLLAR_MIME_TYPE, data: new TextEncoder().encode(JSON.stringify(payload)) }] });
    return true;
  }

  async cleanup() { this.onPayloadReceived = null; }
}

let instance = null;
export function getNFCService() { if (!instance) instance = new NFCService(); return instance; }
export default NFCService;
