/**
 * NFCService — Transferencia real de payloads entre dispositivos.
 * Usa Web NFC API (NDEFReader/NDEFWriter) disponible en Chrome 89+ en Android.
 * Permite leer y escribir tags NFC con payloads P2P.
 */

const POLLAR_MIME_TYPE = 'application/vnd.pollar-p2p';

export class NFCService {
  constructor() {
    this.isAvailable = false;
    this.onPayloadReceived = null;
    this.abortController = null;
  }

  async initialize() {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      this.isAvailable = true;
      console.log('[NFC] Web NFC API available');
      return true;
    }
    this.isAvailable = false;
    return false;
  }

  static isNFCSupported() {
    return typeof window !== 'undefined' && 'NDEFReader' in window;
  }

  /**
   * Leer un tag NFC que contenga un payload Pollar
   * @returns {Promise<object>} payload parseado
   */
  async read() {
    if (!this.isAvailable) throw new Error('NFC no disponible en este navegador. Usa Chrome 89+ en Android.');

    const reader = new NDEFReader();
    this.abortController = new AbortController();
    
    try {
      await reader.scan({ signal: this.abortController.signal });
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.abortController.abort();
          resolve(null);
        }, 30000);

        reader.addEventListener('reading', (event) => {
          clearTimeout(timeout);
          for (const record of event.message.records) {
            if (record.mediaType === POLLAR_MIME_TYPE || record.recordType === 'text') {
              const decoder = new TextDecoder();
              try {
                resolve(JSON.parse(decoder.decode(record.data)));
              } catch {
                resolve(null);
              }
              return;
            }
          }
          resolve(null);
        });

        reader.addEventListener('readingerror', () => {
          clearTimeout(timeout);
          reject(new Error('Error al leer tag NFC'));
        });
      });
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw new Error('Error al escanear NFC: ' + (err.message || 'error'));
    }
  }

  /**
   * Escribir un payload en un tag NFC o emular tag para otro dispositivo
   * @param {object} payload - datos a escribir
   */
  async write(payload) {
    if (!this.isAvailable) throw new Error('NFC no disponible en este navegador. Usa Chrome 89+ en Android.');

    const writer = new NDEFWriter();
    const data = JSON.stringify(payload);
    
    try {
      await writer.write({
        records: [{
          recordType: 'mime',
          mediaType: POLLAR_MIME_TYPE,
          data: new TextEncoder().encode(data)
        }]
      });
      return true;
    } catch (err) {
      throw new Error('Error al escribir tag NFC: ' + (err.message || 'error'));
    }
  }

  /**
   * Iniciar escucha continua de tags NFC
   * @param {function} onPayload callback cuando se detecta un payload
   */
  async startListening(onPayload) {
    if (!this.isAvailable) throw new Error('NFC no disponible');

    const reader = new NDEFReader();
    this.abortController = new AbortController();
    
    try {
      await reader.scan({ signal: this.abortController.signal });
      
      reader.addEventListener('reading', (event) => {
        for (const record of event.message.records) {
          if (record.mediaType === POLLAR_MIME_TYPE || record.recordType === 'text') {
            const decoder = new TextDecoder();
            try {
              const payload = JSON.parse(decoder.decode(record.data));
              if (onPayload) onPayload(payload);
            } catch {}
          }
        }
      });
      
      return true;
    } catch (err) {
      throw new Error('Error al iniciar escucha NFC: ' + (err.message || 'error'));
    }
  }

  async stopListening() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async cleanup() {
    await this.stopListening();
    this.onPayloadReceived = null;
  }
}

let instance = null;
export function getNFCService() {
  if (!instance) instance = new NFCService();
  return instance;
}

export default NFCService;
