import React, { useState, useEffect } from 'react';
import {
  QrCode, Bluetooth, Wifi, Nfc, AlertCircle, Loader2, CheckCircle2, X, Copy, Check, Send, Download
} from 'lucide-react';
import { getBluetoothService } from '../services/BluetoothService';
import { getNFCService } from '../services/NFCService';
import { getWifiDirectService } from '../services/WifiDirectService';

export default function P2PTransportSelector({ onClose, payload, onPayloadCopied }) {
  const [availableTransports, setAvailableTransports] = useState([]);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

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
      if (wifiAvail) transports.push({ id: 'wifi', label: 'WiFi Direct', icon: Wifi, color: '#f59e0b', available: true });
    } catch {}

    setAvailableTransports(transports);
    setChecking(false);
  };

  const handleSelect = async (transportId) => {
    if (transportId === 'qr') {
      onClose();
      return;
    }

    if (!payload) {
      setStatus('Primero crea un pago (Firmar QR) para compartir el payload.');
      setTimeout(() => setStatus(''), 4000);
      return;
    }

    setIsTransferring(true);

    try {
      if (transportId === 'bluetooth') {
        await handleBluetoothSend();
      } else if (transportId === 'nfc') {
        await handleNFCSend();
      } else if (transportId === 'wifi') {
        await handleWifiSend();
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleBluetoothSend = async () => {
    const bt = getBluetoothService();
    setStatus('Buscando dispositivos Bluetooth...');
    
    const device = await bt.startScan((peer) => {
      setStatus(`Dispositivo encontrado: ${peer.name || peer.id}`);
    });
    
    if (!device) {
      setStatus('No se encontraron dispositivos. Asegúrate de que el otro dispositivo esté en modo visible.');
      return;
    }

    setStatus('Conectando...');
    await bt.sendPayload(payload);
    setStatus('✅ Payload enviado exitosasmente por Bluetooth');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleNFCSend = async () => {
    const nfc = getNFCService();
    setStatus('Acerca los dispositivos para transferir por NFC...');
    
    try {
      await nfc.write(payload);
      setStatus('✅ Payload enviado por NFC');
    } catch (err) {
      setStatus('Error NFC: ' + err.message);
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const handleWifiSend = async () => {
    const wifi = getWifiDirectService();
    setStatus('Obteniendo IP local...');
    
    const ip = await wifi.getLocalIP();
    if (ip) {
      setStatus(`Tu IP local: ${ip} — Comparte esta dirección al otro dispositivo.`);
    } else {
      setStatus('No se pudo obtener IP local.');
    }
  };

  const handleCopy = () => {
    if (payload) {
      navigator.clipboard.writeText(JSON.stringify(payload));
      setCopied(true);
      if (onPayloadCopied) onPayloadCopied(JSON.stringify(payload));
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
          {isTransferring && <Loader2 size={12} style={{ display: 'inline', marginRight: 6, animation: 'spin 1s linear infinite' }} />}
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
              <button key={t.id} onClick={() => handleSelect(t.id)} disabled={isTransferring} style={{
                padding: '14px 12px', borderRadius: 16,
                border: `1.5px solid ${t.color}22`, background: `${t.color}08`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer', transition: 'all 0.15s ease',
                opacity: isTransferring ? 0.5 : 1
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

      {/* Copy to clipboard - PRIMARY ACTION for testing */}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: 'var(--pollar-blue-light)', border: '1.5px solid rgba(0, 98, 255, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pollar-blue)' }}>Copiar payload para testing</span>
          <button onClick={handleCopy} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 800,
            background: copied ? 'var(--color-emerald-bg)' : 'var(--pollar-blue)',
            color: copied ? 'var(--color-emerald)' : '#fff',
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar payload'}
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          Copia el payload y pégalo en "Terminal Cobrar (B)" → "Importar pago" para simular el pago P2P en un solo dispositivo.
        </p>
      </div>

      {availableTransports.length === 1 && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'var(--color-amber-bg)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-amber)', fontSize: 11, fontWeight: 600 }}>
          <AlertCircle size={14} />
          Solo QR disponible. Instala plugins de Capacitor para habilitar Bluetooth, NFC y WiFi Direct.
        </div>
      )}
    </div>
  );
}
