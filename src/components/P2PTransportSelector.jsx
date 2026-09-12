import React, { useState, useEffect } from 'react';
import {
  QrCode, Bluetooth, Wifi, Nfc, AlertCircle, Loader2, CheckCircle2, X
} from 'lucide-react';
import { getBluetoothService } from '../services/BluetoothService';
import { getNFCService } from '../services/NFCService';
import { getWifiDirectService } from '../services/WifiDirectService';

const TRANSPORT_INFO = {
  qr: { label: 'Código QR', icon: QrCode, color: '#0062FF' },
  bluetooth: { label: 'Bluetooth LE', icon: Bluetooth, color: '#7c3aed' },
  nfc: { label: 'NFC', icon: Nfc, color: '#10b981' },
  wifi: { label: 'WiFi Direct', icon: Wifi, color: '#f59e0b' },
};

export default function P2PTransportSelector({ onSelectTransport, onClose }) {
  const [availableTransports, setAvailableTransports] = useState([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAvailableTransports();
  }, []);

  const checkAvailableTransports = async () => {
    setChecking(true);

    const transports = [
      { id: 'qr', label: 'Código QR', icon: QrCode, color: '#0062FF', available: true }, // QR siempre disponible
    ];

    // Check Bluetooth
    try {
      const bt = getBluetoothService();
      const btAvail = await bt.initialize();
      if (btAvail) {
        transports.push({ id: 'bluetooth', label: 'Bluetooth LE', icon: Bluetooth, color: '#7c3aed', available: true });
      }
    } catch {}

    // Check NFC
    try {
      const nfc = getNFCService();
      const nfcAvail = await nfc.initialize();
      if (nfcAvail) {
        transports.push({ id: 'nfc', label: 'NFC', icon: Nfc, color: '#10b981', available: true });
      }
    } catch {}

    // Check WiFi Direct
    try {
      const wifi = getWifiDirectService();
      const wifiAvail = await wifi.initialize();
      if (wifiAvail) {
        transports.push({ id: 'wifi', label: 'WiFi Direct', icon: Wifi, color: '#f59e0b', available: true });
      }
    } catch {}

    setAvailableTransports(transports);
    setChecking(false);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#fff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: '20px 20px 40px 20px',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>Medio de transferencia</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {checking ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--pollar-blue)' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {availableTransports.map((transport) => (
            <TransportCard
              key={transport.id}
              transport={transport}
              onClick={() => onSelectTransport(transport.id)}
            />
          ))}
        </div>
      )}

      {/* Info */}
      {availableTransports.length === 1 && (
        <div style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 12,
          background: 'var(--color-amber-bg)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--color-amber)',
          fontSize: 11,
          fontWeight: 600
        }}>
          <AlertCircle size={14} />
          Solo QR disponible. Instala los plugins de Capacitor para habilitar Bluetooth, NFC y WiFi Direct.
        </div>
      )}
    </div>
  );
}

function TransportCard({ transport, onClick }) {
  const Icon = transport.icon;

  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 12px',
        borderRadius: 16,
        border: `1.5px solid ${transport.color}22`,
        background: `${transport.color}08`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: `${transport.color}18`,
        color: transport.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={18} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
        {transport.label}
      </span>
      {transport.available && (
        <CheckCircle2 size={12} style={{ color: 'var(--color-emerald)' }} />
      )}
    </button>
  );
}
