/**
 * BluetoothService — Transferencia real de payloads entre dispositivos.
 * Usa Web Bluetooth API para enviar y recibir pagos entre dispositivos Pollar.
 */

// UUIDs para el servicio P2P de Pollar
const POLLAR_SERVICE_UUID = '0000p0ll-0000-1000-8000-00805f9b34fb';
const POLLAR_TX_CHAR_UUID = '0000p0ll-0001-1000-8000-00805f9b34fb';
const POLLAR_RX_CHAR_UUID = '0000p0ll-0002-1000-8000-00805f9b34fb';

export class BluetoothService {
  constructor() {
    this.isAvailable = false;
    this.device = null;
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this.onPayloadReceived = null;
  }

  async initialize() {
    if (typeof navigator !== 'undefined' && navigator.bluetooth) {
      this.isAvailable = true;
      console.log('[Bluetooth] Web Bluetooth API available');
      return true;
    }
    this.isAvailable = false;
    return false;
  }

  static isBluetoothSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  async startScan(onDiscovered) {
    if (!this.isAvailable) throw new Error('Bluetooth no disponible');

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'POLLAR' },
          { services: [POLLAR_SERVICE_UUID] }
        ],
        optionalServices: [POLLAR_SERVICE_UUID]
      });

      if (device && onDiscovered) {
        onDiscovered({
          id: device.id,
          name: device.name || 'Dispositivo P2P'
        });
      }

      this.device = device;
      return device;
    } catch (e) {
      console.warn('[Bluetooth] Scan cancelled or failed:', e.message);
      return null;
    }
  }

  async sendPayload(payload) {
    if (!this.device) throw new Error('No hay dispositivo conectado');

    try {
      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(POLLAR_SERVICE_UUID);
      this.txCharacteristic = await service.getCharacteristic(POLLAR_TX_CHAR_UUID);
      
      const data = JSON.stringify(payload);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      const chunkSize = 512;
      for (let i = 0; i < dataBuffer.length; i += chunkSize) {
        const chunk = dataBuffer.slice(i, i + chunkSize);
        await this.txCharacteristic.writeValue(chunk);
      }
      
      await this.txCharacteristic.writeValue(new Uint8Array([0]));
      return true;
    } catch (e) {
      throw new Error('Error al enviar payload: ' + (e.message || 'error'));
    }
  }

  async startReceiving(onPayload) {
    if (!this.device) throw new Error('No hay dispositivo conectado');

    try {
      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(POLLAR_SERVICE_UUID);
      this.rxCharacteristic = await service.getCharacteristic(POLLAR_RX_CHAR_UUID);
      
      await this.rxCharacteristic.startNotifications();
      
      let buffer = new Uint8Array(0);
      
      this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const data = event.target.value;
        const chunk = new Uint8Array(data.buffer);
        
        if (chunk.length === 1 && chunk[0] === 0) {
          const decoder = new TextDecoder();
          const json = decoder.decode(buffer);
          try {
            const payload = JSON.parse(json);
            if (onPayload) onPayload(payload);
          } catch (e) {
            console.error('[Bluetooth] Error parsing payload:', e);
          }
          buffer = new Uint8Array(0);
        } else {
          const newBuffer = new Uint8Array(buffer.length + chunk.length);
          newBuffer.set(buffer);
          newBuffer.set(chunk, buffer.length);
          buffer = newBuffer;
        }
      });
      
      return true;
    } catch (e) {
      throw new Error('Error al recibir payload: ' + (e.message || 'error'));
    }
  }

  async stopScan() {}
  async disconnect() {
    if (this.device && this.device.gatt) this.device.gatt.disconnect();
    this.device = null;
    this.server = null;
  }

  async cleanup() {
    await this.disconnect();
    this.onPayloadReceived = null;
  }
}

let instance = null;
export function getBluetoothService() {
  if (!instance) instance = new BluetoothService();
  return instance;
}

export default BluetoothService;
