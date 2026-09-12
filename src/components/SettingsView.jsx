import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import {
  Fingerprint,
  Shield,
  ChevronRight,
  Wallet,
  MonitorSmartphone,
  CheckCircle2,
  AlertCircle,
  Trash2,
  LogOut,
  User,
  KeyRound
} from 'lucide-react';

export default function SettingsView({ onClose, onNavigateRegistry }) {
  const {
    currentUser,
    settings,
    updateSettings,
    isBiometricAvailable,
    checkBiometricAvailable,
    registerBiometric,
    logout,
  } = useWallet();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState('idle'); // 'idle' | 'registering' | 'success' | 'error'
  const [biometricError, setBiometricError] = useState('');

  useEffect(() => {
    checkBiometricAvailable().then(avail => setBiometricAvailable(avail));
  }, []);

  const handleBiometricToggle = async () => {
    if (settings.biometricEnabled) {
      // Disable
      updateSettings({ biometricEnabled: false });
    } else {
      // Enable — try to register credential
      setBiometricStatus('registering');
      setBiometricError('');
      try {
        await registerBiometric(currentUser?.email || currentUser?.id || 'user');
        updateSettings({ biometricEnabled: true });
        setBiometricStatus('success');
        setTimeout(() => setBiometricStatus('idle'), 2000);
      } catch (err) {
        setBiometricStatus('error');
        setBiometricError(err.message || 'No se pudo registrar biometría');
        setTimeout(() => setBiometricStatus('idle'), 4000);
      }
    }
  };

  const renderBiometricStatus = () => {
    if (biometricStatus === 'registering') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pollar-blue)', fontSize: 12 }}>
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Registrando...
        </div>
      );
    }
    if (biometricStatus === 'success') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-emerald)', fontSize: 12 }}>
          <CheckCircle2 size={14} />
          Biometría activada
        </div>
      );
    }
    if (biometricStatus === 'error') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-rose)', fontSize: 12 }}>
          <AlertCircle size={14} />
          {biometricError || 'Error'}
        </div>
      );
    }
    if (!biometricAvailable) {
      return (
        <span style={{ fontSize: 11, color: 'var(--text-light)', fontStyle: 'italic' }}>
          No disponible en este dispositivo
        </span>
      );
    }
    return (
      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
        Huella digital o Face ID
      </span>
    );
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px 24px 0 0',
      padding: '20px 20px 0 20px',
      maxHeight: '80vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 0
    }}>

      {/* ─── Section: Account ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-light)', marginBottom: 10, paddingLeft: 4 }}>
          Cuenta
        </p>

        {/* User info card */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 18,
          background: 'var(--bg-card-muted)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 8
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--pollar-blue), #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18, fontWeight: 900, flexShrink: 0
          }}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
              {currentUser?.name || 'Usuario'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentUser?.email || currentUser?.publicKey?.slice(0, 20) + '...'}
            </p>
            {currentUser?.provider && (
              <span style={{
                display: 'inline-block', marginTop: 4, fontSize: 9, fontWeight: 700,
                background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)',
                padding: '1px 6px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.3
              }}>
                {currentUser.provider}
              </span>
            )}
          </div>
          <User size={18} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
        </div>
      </div>

      {/* ─── Section: Security ───────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-light)', marginBottom: 10, paddingLeft: 4 }}>
          Seguridad
        </p>

        {/* Biometric Toggle */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 18,
          background: 'var(--bg-card-muted)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 8
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: settings.biometricEnabled ? 'var(--color-emerald-bg)' : 'var(--pollar-blue-light)',
            color: settings.biometricEnabled ? 'var(--color-emerald)' : 'var(--pollar-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Fingerprint size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                Usar biometría
              </span>
              {settings.biometricEnabled && (
                <CheckCircle2 size={14} style={{ color: 'var(--color-emerald)' }} />
              )}
            </div>
            {renderBiometricStatus()}
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleBiometricToggle}
            disabled={biometricStatus === 'registering' || !biometricAvailable}
            style={{
              width: 48, height: 28, borderRadius: 14,
              background: settings.biometricEnabled ? 'var(--color-emerald)' : '#E2E8F0',
              border: 'none',
              cursor: biometricAvailable ? 'pointer' : 'not-allowed',
              opacity: biometricAvailable ? 1 : 0.5,
              display: 'flex', alignItems: 'center',
              padding: 3, transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              transition: 'transform 0.2s ease',
              transform: settings.biometricEnabled ? 'translateX(20px)' : 'translateX(0)'
            }} />
          </button>
        </div>

        {/* Biometric info note */}
        {biometricAvailable && !settings.biometricEnabled && (
          <p style={{ fontSize: 10, color: 'var(--text-light)', paddingLeft: 4 }}>
            Activa la biometría para iniciar sesión sin contraseña
          </p>
        )}
      </div>

      {/* ─── Section: Wallets ───────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-light)', marginBottom: 10, paddingLeft: 4 }}>
          Billeteras
        </p>

        {/* Wallet Registry */}
        <button
          onClick={onNavigateRegistry}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 18,
            background: 'var(--bg-card-muted)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'var(--pollar-blue-light)',
            color: 'var(--pollar-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Wallet size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
              Gestionar billeteras
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Crear, importar o editar wallets personales
            </span>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
        </button>
      </div>

      {/* ─── Section: Session ────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, paddingBottom: 24 }}>
        <button
          onClick={() => { logout(); if (onClose) onClose(); }}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 16,
            background: 'var(--color-rose-bg)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer'
          }}
        >
          <LogOut size={17} style={{ color: 'var(--color-rose)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-rose)' }}>
            Cerrar sesión
          </span>
        </button>
      </div>
    </div>
  );
}
