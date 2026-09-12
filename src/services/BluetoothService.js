const BLE_SERVICE_UUID = 'pollar-ble-service';
const POLLAR_DEVICE_NAME_PREFIX = 'POLLAR:';

export class BluetoothService {
  constructor() {
    this.isAvailable = false;
    this.isScanning = false;
    this.onPayloadReceived = null;
    this.onPeerDiscovered = null;
  }

  async initialize() {
    if (typeof navigator !== 'undefined' && navigator.bluetooth) {
      this.isAvailable = true;
      console.log('[Bluetooth] Web Bluetooth API available');
      return true;
    }
    console.warn('[Bluetooth] Web Bluetooth API not available');
    this.isAvailable = false;
    return false;
  }

  static isBluetoothSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  async startScan(onDiscovered) {
    if (!this.isAvailable) throw new Error('Bluetooth no disponible');
    this.onPeerDiscovered = onDiscovered;
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'POLLAR' }],
        optionalServices: [BLE_SERVICE_UUID],
      });
      if (device && this.onPeerDiscovered) {
        this.onPeerDiscovered({ id: device.id, name: device.name });
      }
      this.isScanning = true;
      return device;
    } catch (e) {
      console.warn('[Bluetooth] Scan cancelled:', e.message);
      return null;
    }
  }

  async stopScan() { this.isScanning = false; }
  async sendPayload(peerId, payload) { console.log('[Bluetooth] Send not implemented in Web mode'); return false; }
  async disconnect(peerId) {}
  async cleanup() { this.isScanning = false; }
}

let instance = null;
export function getBluetoothService() { if (!instance) instance = new BluetoothService(); return instance; }
export default BluetoothService;
