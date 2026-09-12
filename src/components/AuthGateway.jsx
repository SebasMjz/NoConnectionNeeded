import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import PollarLogo from './PollarLogo';
import WalletConnectModal from './WalletConnectModal';
import {
  Mail,
  Wallet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound,
  UserPlus,
  Fingerprint,
  Eye,
  EyeOff
} from 'lucide-react';

export default function AuthGateway({ onLoginSuccess }) {
  const {
    loginWithEmail,
    loginWithPassword,
    registerUser,
    loginWithGoogle,
    loginWithWallet,
    loginAsPreset,
    isBiometricAvailable,
    authenticateWithBiometric,
    settings,
  } = useWallet();

  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'otp' | 'biometric'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const inputRefs = useRef([]);

  // Auto-switch biometric tab if biometric is available and has creds
  useEffect(() => {
    if (isBiometricAvailable() && settings.biometricEnabled && email) {
      setAuthTab('biometric');
      setStep('biometric');
    }
  }, []);

  // ─── Email/Password ──────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setFeedback({ type: 'error', message: 'Ingresa un correo electrónico válido.' });
      return;
    }
    setFeedback({ type: '', message: '' });
    setIsLoading(true);

    if (authTab === 'register') {
      // Direct registration with email + password (skip OTP for simplicity)
      try {
        await registerUser(email, password);
        if (onLoginSuccess) onLoginSuccess();
      } catch (err) {
        setFeedback({ type: 'error', message: err.message });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Login with email OTP
      setTimeout(() => {
        setIsLoading(false);
        setOtpDigits(['7', '3', '9', '2', '0', '1']);
        setStep('otp');
      }, 450);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) setOtpDigits(pasted.split(''));
  };

  const handleConfirmOtp = () => {
    const code = otpDigits.join('');
    if (code.length < 6) {
      setFeedback({ type: 'error', message: 'Ingresa el código de 6 dígitos completo.' });
      return;
    }
    setIsLoading(true);
    setFeedback({ type: '', message: '' });
    setTimeout(() => {
      if (authTab === 'register') {
        registerUser(email, password).then(() => {
          setIsLoading(false);
          if (onLoginSuccess) onLoginSuccess();
        }).catch(err => {
          setIsLoading(false);
          setFeedback({ type: 'error', message: err.message });
        });
      } else {
        loginWithEmail(email);
        setIsLoading(false);
        if (onLoginSuccess) onLoginSuccess();
      }
    }, 350);
  };

  // ─── Login with password ────────────────────────────────────────────────
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

  // ─── Register ─────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !password) {
      setFeedback({ type: 'error', message: 'Completa email, contraseña y confirmación.' });
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

  // ─── Biometric login ──────────────────────────────────────────────────
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

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      loginWithGoogle(email && email.includes('@') ? email : 'usuario.pollar@gmail.com');
      setIsLoading(false);
      if (onLoginSuccess) onLoginSuccess();
    }, 450);
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
      {/* Auth Card Container */}
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
            {step === 'biometric' ? 'Autenticación biométrica' :
             step === 'otp' ? 'Código de verificación' :
             authTab === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
          </p>
        </div>

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

        {/* ─── INPUT STEP ─── */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email + Password Form */}
            <form
              onSubmit={authTab === 'register' ? handleRegister : handleLoginPassword}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {/* Email */}
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

              {/* Password */}
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

              {/* Feedback */}
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

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="pollar-btn-primary"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  authTab === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'
                )}
              </button>

              {/* Biometric quick login */}
              {authTab === 'login' && isBiometricAvailable() && (
                <button
                  type="button"
                  onClick={() => { setAuthTab('biometric'); setStep('biometric'); }}
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

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0' }}>
              <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
              <span style={{ padding: '0 12px', fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>o continuar con</span>
              <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
            </div>

            {/* Social & Wallet Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleGoogleLogin} type="button" className="pollar-btn-secondary"
                style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0' }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Google</span>
              </button>

              <button onClick={() => setIsWalletModalOpen(true)} type="button"
                className="pollar-btn-outline-blue">
                <Wallet size={18} />
                <span>Continuar con una billetera</span>
              </button>
            </div>
          </div>
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
              <p style={{ fontSize: 14, fontWeight: 800 }}>
                Usa tu huella digital para iniciar sesión
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {email || 'Ingresa tu email primero'}
              </p>
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
              <button onClick={() => { setStep('input'); setAuthTab('login'); }}
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

        {/* ─── OTP STEP ─── */}
        {step === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
            <div style={{
              padding: 14, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)',
              borderRadius: 16, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700
            }}>
              <KeyRound size={18} />
              <span>Código enviado a {email}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}
              onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  style={{
                    width: 44, height: 52, borderRadius: 14,
                    border: digit ? '1.5px solid var(--pollar-blue)' : '1.5px solid #E2E8F0',
                    background: digit ? '#FFFFFF' : '#F8FAFC', textAlign: 'center',
                    fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-main)', outline: 'none', transition: 'all 0.15s ease'
                  }}
                />
              ))}
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

            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Código de verificación de prueba: 739201
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep('input'); setFeedback({ type: '', message: '' }); }}
                className="pollar-btn-secondary" style={{ flex: 1 }}>
                Volver
              </button>
              <button onClick={handleConfirmOtp} disabled={isLoading}
                className="pollar-btn-primary" style={{ flex: 1 }}>
                {isLoading ? 'Verificando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* Quick Access Preset Chips (only on login tab) */}
        {step === 'input' && authTab === 'login' && (
          <div style={{ paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-light)', textAlign: 'center' }}>
              Acceso Rápido
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => { loginAsPreset('pagador'); if (onLoginSuccess) onLoginSuccess(); }}
                style={{
                  padding: '12px 14px', borderRadius: 16,
                  background: 'var(--pollar-blue-light)',
                  border: '1px solid rgba(0, 98, 255, 0.15)',
                  textAlign: 'left', cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pollar-blue)', display: 'block' }}>⚡ Pagador</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>pagador@pollar.io</span>
              </button>
              <button
                onClick={() => { loginAsPreset('comercio'); if (onLoginSuccess) onLoginSuccess(); }}
                style={{
                  padding: '12px 14px', borderRadius: 16,
                  background: 'var(--color-emerald-bg)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  textAlign: 'left', cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)', display: 'block' }}>🏪 Comercio POS</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>comercio@pollar.io</span>
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
