/**
 * WifiDirectService — Web-based local network discovery.
 * Uses WebSocket for peer-to-peer communication on local network.
 */

export class WifiDirectService {
  constructor() {
    this.isAvailable = false;
    this.connectedPeers = new Map();
    this.onPayloadReceived = null;
    this.onPeerDiscovered = null;
  }

  async initialize() {
    if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
      this.isAvailable = true;
      console.log('[WifiDirect] Web mode available');
      return true;
    }
    this.isAvailable = false;
    return false;
  }

  static isWifiDirectSupported() {
    return typeof navigator !== 'undefined' && navigator.onLine !== undefined;
  }

  async getLocalIP() {
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const ipMatch = /(\d{1,3}\.){3}\d{1,3}/.exec(event.candidate.candidate);
          if (ipMatch) { pc.close(); resolve(ipMatch[0]); }
        }
      };
      setTimeout(() => { pc.close(); resolve(null); }, 3000);
    });
  }

  async connectToPeer(ipAddress, port = 41234) {
    if (!this.isAvailable) throw new Error('WiFi Direct no disponible');
    try {
      const ws = new WebSocket(`ws://${ipAddress}:${port}`);
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = () => reject(new Error('Connection failed'));
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (this.onPayloadReceived) this.onPayloadReceived(payload);
        } catch {}
      };
      this.connectedPeers.set(`${ipAddress}:${port}`, { ws, ip: ipAddress, port });
      return true;
    } catch (e) { return false; }
  }

  async sendPayload(peerAddress, payload) {
    const peer = this.connectedPeers.get(peerAddress);
    if (!peer || !peer.ws) throw new Error('Peer not connected');
    peer.ws.send(JSON.stringify(payload));
    return true;
  }

  async disconnect(peerAddress) {
    const peer = this.connectedPeers.get(peerAddress);
    if (peer?.ws) peer.ws.close();
    this.connectedPeers.delete(peerAddress);
  }

  async cleanup() {
    for (const addr of this.connectedPeers.keys()) await this.disconnect(addr);
  }
}

let instance = null;
export function getWifiDirectService() { if (!instance) instance = new WifiDirectService(); return instance; }
export default WifiDirectService;
