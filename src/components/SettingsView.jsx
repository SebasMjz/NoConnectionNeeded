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

export default function SettingsView({ onClose, onLogout, onNavigateRegistry }) {
  const {
    currentUser,
    settings,
    updateSettings,
    isBiometricAvailable,
    checkBiometricAvailable,
    registerBiometric,
    logout,
    linkedWallets,
    activeWallet,
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
          {/* Avatar */}
          <div style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: currentUser?.avatar ? 'transparent' : 'linear-gradient(135deg, var(--pollar-blue), #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18, fontWeight: 900,
            overflow: 'hidden', border: '1.5px solid rgba(0,98,255,0.15)',
          }}>
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (currentUser?.name || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                {currentUser?.name || 'Usuario'}
              </p>
              {/* Google badge */}
              {currentUser?.provider === 'google' && (
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: currentUser?.email ? 'inherit' : 'var(--font-mono)' }}>
              {currentUser?.email || (currentUser?.publicKey ? currentUser.publicKey.slice(0, 22) + '...' : '')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {currentUser?.provider && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)',
                  padding: '1px 6px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.3
                }}>
                  {currentUser.provider}
                </span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: linkedWallets.length > 0 ? 'var(--color-emerald-bg)' : '#F1F5F9',
                color: linkedWallets.length > 0 ? 'var(--color-emerald)' : 'var(--text-light)',
                padding: '1px 6px', borderRadius: 6,
              }}>
                {linkedWallets.length} wallet{linkedWallets.length !== 1 ? 's' : ''}
              </span>
            </div>
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
          onClick={() => {
            if (onLogout) onLogout();
            else logout();
            if (onClose) onClose();
          }}
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
