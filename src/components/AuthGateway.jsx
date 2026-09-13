import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import PollarLogo from './PollarLogo';
import WalletConnectModal from './WalletConnectModal';
import { Capacitor } from '@capacitor/core';
import GoogleAuthService from '../services/GoogleAuthService';
import { usePollar } from '@pollar/react';
import {
  Mail,
  Wallet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  UserPlus,
  Fingerprint,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';

export default function AuthGateway({ onLoginSuccess }) {
  const {
    loginWithEmail,
    loginWithPassword,
    loginWithOAuth,
    registerUser,
    loginWithWallet,
    loginWithGoogle,
    isBiometricAvailable,
    authenticateWithBiometric,
    settings,
  } = useWallet();

  const pollar = usePollar();
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'biometric'
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // ─── Auto-redirect when Pollar login succeeds ───────────────────────
  React.useEffect(() => {
    if (pollar.isAuthenticated) {
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    }
  }, [pollar.isAuthenticated, onLoginSuccess]);

  // ─── Google Sign-In (native Android OR real Pollar OAuth) ─────────────
  const handleGoogleButtonClick = async () => {
    setIsLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      if (Capacitor.isNativePlatform()) {
        // → Native Android: launch real Google account picker
        const profile = await GoogleAuthService.signIn();
        if (profile) {
          handleOAuthSuccess(profile);
        }
      } else {
        // → Web: real Google login via Pollar SDK
        await pollar.login({ provider: 'google' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Error al autenticar con Google' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── OAuth ──────────────────────────────────────────────────────────
  const handleOAuthSuccess = (profile) => {
    loginWithOAuth(profile);
    if (onLoginSuccess) onLoginSuccess();
  };

  // ─── Email / Password ───────────────────────────────────────────────
  const handleLoginPassword = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !password) {
      setFeedback({ type: 'error', message: 'Completa email y contraseña.' });
      return;
    }
    setIsLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      await loginWithPassword(email, password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !password) {
      setFeedback({ type: 'error', message: 'Completa email y contraseña.' });
      return;
    }
    if (password.length < 6) {
      setFeedback({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setIsLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      await registerUser(email, password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Biometric ──────────────────────────────────────────────────────
  const handleBiometricLogin = async () => {
    setFeedback({ type: '', message: '' });
    setIsLoading(true);
    try {
      await authenticateWithBiometric(email);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Biometría cancelada o fallida' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletLoginComplete = () => {
    if (onLoginSuccess) onLoginSuccess();
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: '#F8FAFC'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: '#FFFFFF',
        borderRadius: 32,
        padding: '36px 28px',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08), 0 1px 4px rgba(15, 23, 42, 0.02)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>

        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <PollarLogo size={58} showText={true} textColor="text-slate-900" textSize="text-3xl" />
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
            {step === 'biometric' ? 'Autenticación biométrica' : 'Pagos P2P offline con Stellar'}
          </p>
        </div>

        {/* ─── POLLAR SDK — Primary CTA ─── */}
        {step === 'input' && (
          <button
            id="btn-pollar-sdk-login"
            onClick={async () => {
              try {
                setIsLoading(true);
                setFeedback({ type: '', message: '' });
                if (typeof pollar.openLoginModal === 'function') {
                  pollar.openLoginModal();
                } else {
                  await pollar.login();
                }
              } catch (err) {
                setFeedback({ type: 'error', message: err?.message || 'Error al conectar con Pollar' });
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '15px 20px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #0062FF 0%, #5B3FE8 100%)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(0,98,255,0.28)',
              fontSize: 14,
              fontWeight: 900,
              color: '#fff',
              cursor: 'pointer',
              letterSpacing: '-0.2px',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <PollarLogo size={20} showText={false} />
            {isLoading ? 'Conectando...' : 'Continuar con Pollar'}
          </button>
        )}

        {/* Divider between Pollar SDK and other methods */}
        {step === 'input' && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ padding: '0 12px', fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}>o continúa con</span>
            <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
          </div>
        )}

        {/* ─── PRIMARY: Google OAuth Button ─── */}
        {step === 'input' && (
          <button
            id="btn-google-oauth"
            onClick={handleGoogleButtonClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '14px 20px',
              borderRadius: 16,
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              fontSize: 14,
              fontWeight: 800,
              color: '#1f1f1f',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continuar con Google
          </button>
        )}

        {/* Wallet button */}
        {step === 'input' && (
          <button
            id="btn-wallet-connect"
            onClick={() => setIsWalletModalOpen(true)}
            type="button"
            className="pollar-btn-outline-blue"
          >
            <Wallet size={18} />
            <span>Continuar con una billetera</span>
          </button>
        )}

        {/* Divider */}
        {step === 'input' && (
          <div style={{ display: 'flex', alignItems: 'center', margin: '0' }}>
            <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ padding: '0 12px', fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>o con email</span>
            <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
          </div>
        )}

        {/* Tab Switcher */}
        {step === 'input' && (
          <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 16, gap: 4 }}>
            <button
              onClick={() => { setAuthTab('login'); setFeedback({ type: '', message: '' }); }}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: authTab === 'login' ? '#FFFFFF' : 'transparent',
                color: authTab === 'login' ? 'var(--pollar-blue)' : 'var(--text-muted)',
                boxShadow: authTab === 'login' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowRight size={16} /> Iniciar Sesión
            </button>
            <button
              onClick={() => { setAuthTab('register'); setFeedback({ type: '', message: '' }); }}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: authTab === 'register' ? '#FFFFFF' : 'transparent',
                color: authTab === 'register' ? 'var(--pollar-blue)' : 'var(--text-muted)',
                boxShadow: authTab === 'register' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <UserPlus size={16} /> Registrarse
            </button>
          </div>
        )}

        {/* ─── INPUT STEP: Email form ─── */}
        {step === 'input' && (
          <form
            onSubmit={authTab === 'register' ? handleRegister : handleLoginPassword}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="pollar-input"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authTab === 'register' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
                  className="pollar-input"
                  required
                  minLength={authTab === 'register' ? 6 : 1}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', color: 'var(--text-muted)', display: 'flex'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {feedback.message && (
              <div style={{
                padding: 12, borderRadius: 14, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--color-rose-bg)', color: 'var(--color-rose)'
              }}>
                <AlertCircle size={16} />
                <span>{feedback.message}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="pollar-btn-primary">
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                authTab === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'
              )}
            </button>

            {authTab === 'login' && isBiometricAvailable() && (
              <button
                type="button"
                onClick={() => { setStep('biometric'); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 14, background: 'var(--pollar-blue-light)',
                  border: '1.5px solid rgba(0, 98, 255, 0.2)', color: 'var(--pollar-blue)',
                  fontSize: 13, fontWeight: 800
                }}
              >
                <Fingerprint size={18} />
                Usar biometría
              </button>
            )}
          </form>
        )}

        {/* ─── BIOMETRIC STEP ─── */}
        {step === 'biometric' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
            <div style={{
              padding: 20, background: 'var(--pollar-blue-light)',
              borderRadius: 20, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 12, color: 'var(--pollar-blue)'
            }}>
              <Fingerprint size={48} />
              <p style={{ fontSize: 14, fontWeight: 800 }}>Usa tu huella digital para iniciar sesión</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{email || 'Ingresa tu email primero'}</p>
            </div>

            {feedback.message && (
              <div style={{
                padding: 10, borderRadius: 12, fontSize: 12,
                background: 'var(--color-rose-bg)', color: 'var(--color-rose)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
                <AlertCircle size={15} />
                <span>{feedback.message}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep('input'); setFeedback({ type: '', message: '' }); }}
                className="pollar-btn-secondary" style={{ flex: 1 }}>
                Volver
              </button>
              <button onClick={handleBiometricLogin} disabled={isLoading}
                className="pollar-btn-primary" style={{ flex: 1 }}>
                {isLoading ? 'Verificando...' : 'Autenticar'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--text-light)', fontWeight: 500, paddingTop: 4 }}>
          <span>Protegido por</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--pollar-blue)', fontWeight: 800 }}>
            <PollarLogo size={14} showText={false} />
            <span>pollar</span>
          </div>
        </div>
      </div>

      {/* Wallet Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={handleWalletLoginComplete}
      />
    </div>
  );
}
