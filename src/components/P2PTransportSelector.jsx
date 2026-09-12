import React, { useState, useEffect } from 'react';
import {
  QrCode, Bluetooth, Wifi, Nfc, AlertCircle, Loader2, CheckCircle2, X, Copy, Check
} from 'lucide-react';
import { getBluetoothService } from '../services/BluetoothService';
import { getNFCService } from '../services/NFCService';
import { getWifiDirectService } from '../services/WifiDirectService';

const TRANSPORT_INFO = {
  qr: { label: 'Código QR', icon: QrCode, color: '#0062FF' },
  bluetooth: { label: 'Bluetooth', icon: Bluetooth, color: '#7c3aed' },
  nfc: { label: 'NFC', icon: Nfc, color: '#10b981' },
  wifi: { label: 'WiFi Local', icon: Wifi, color: '#f59e0b' },
};

export default function P2PTransportSelector({ onClose, payload }) {
  const [availableTransports, setAvailableTransports] = useState([]);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => { checkAvailableTransports(); }, []);

  const checkAvailableTransports = async () => {
    setChecking(true);
    const transports = [{ id: 'qr', label: 'Código QR', icon: QrCode, color: '#0062FF', available: true }];

    try {
      const bt = getBluetoothService();
      const btAvail = await bt.initialize();
      if (btAvail) transports.push({ id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth, color: '#7c3aed', available: true });
    } catch {}

    try {
      const nfc = getNFCService();
      const nfcAvail = await nfc.initialize();
      if (nfcAvail) transports.push({ id: 'nfc', label: 'NFC', icon: Nfc, color: '#10b981', available: true });
    } catch {}

    try {
      const wifi = getWifiDirectService();
      const wifiAvail = await wifi.initialize();
      if (wifiAvail) transports.push({ id: 'wifi', label: 'WiFi Local', icon: Wifi, color: '#f59e0b', available: true });
    } catch {}

    setAvailableTransports(transports);
    setChecking(false);
  };

  const handleSelect = async (transportId) => {
    if (!payload) {
      setStatus('No hay payload para compartir');
      return;
    }

    const json = JSON.stringify(payload);

    try {
      if (transportId === 'qr') {
        onClose();
      } else if (transportId === 'bluetooth') {
        setStatus('Buscando dispositivos Bluetooth...');
        const bt = getBluetoothService();
        const device = await bt.startScan((peer) => {
          setStatus(`Dispositivo encontrado: ${peer.name || peer.id}`);
        });
        if (!device) setStatus('No se encontraron dispositivos. Usa QR como alternativa.');
      } else if (transportId === 'wifi') {
        setStatus('Compartiendo por red local...');
        const wifi = getWifiDirectService();
        const ip = await wifi.getLocalIP();
        if (ip) setStatus(`Tu IP local: ${ip} — Comparte esta dirección al otro dispositivo.`);
        else setStatus('No se pudo obtener IP local. Usa QR como alternativa.');
      } else if (transportId === 'nfc') {
        setStatus('NFC requiere Android con soporte Web NFC. Usa QR como alternativa.');
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  const handleCopy = () => {
    if (payload) {
      navigator.clipboard.writeText(JSON.stringify(payload));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: '20px 20px 40px 20px', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
      zIndex: 1000, maxHeight: '70vh', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>Enviar por</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {status && (
        <div style={{ padding: 10, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', fontSize: 12, marginBottom: 12 }}>
          {status}
        </div>
      )}

      {checking ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader2 size={24} style={{ color: 'var(--pollar-blue)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {availableTransports.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => handleSelect(t.id)} style={{
                padding: '14px 12px', borderRadius: 16,
                border: `1.5px solid ${t.color}22`, background: `${t.color}08`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${t.color}18`, color: t.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={18} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Copy to clipboard fallback */}
      {payload && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 14, background: 'var(--bg-card-muted)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>O copia el payload para compartir por cualquier medio:</span>
            <button onClick={handleCopy} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: copied ? 'var(--color-emerald-bg)' : 'var(--pollar-blue-light)',
              color: copied ? 'var(--color-emerald)' : 'var(--pollar-blue)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {availableTransports.length === 1 && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'var(--color-amber-bg)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-amber)', fontSize: 11, fontWeight: 600 }}>
          <AlertCircle size={14} />
          Solo QR disponible. Instala plugins de Capacitor para habilitar Bluetooth, NFC y WiFi Direct.
        </div>
      )}
    </div>
  );
}
