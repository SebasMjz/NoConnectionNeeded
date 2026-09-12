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
  KeyRound
} from 'lucide-react';

export default function AuthGateway({ onLoginSuccess }) {
  const { loginWithEmail, loginWithGoogle, loginWithWallet, loginAsPreset } = useWallet();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('input');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const inputRefs = useRef([]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setFeedback({ type: 'error', message: 'Por favor ingresa un correo electrónico válido.' });
      return;
    }
    setFeedback({ type: '', message: '' });
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Generate a realistic 6-digit code or prompt user
      setOtpDigits(['7', '3', '9', '2', '0', '1']);
      setStep('otp');
    }, 450);
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance
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
    if (/^\d{6}$/.test(pasted)) {
      setOtpDigits(pasted.split(''));
    }
  };

  const handleConfirmOtp = () => {
    const code = otpDigits.join('');
    if (code.length < 6) {
      setFeedback({ type: 'error', message: 'Por favor ingresa el código de 6 dígitos completo.' });
      return;
    }
    setIsLoading(true);
    setFeedback({ type: '', message: '' });
    setTimeout(() => {
      loginWithEmail(email);
      setIsLoading(false);
      if (onLoginSuccess) onLoginSuccess();
    }, 350);
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
            {step === 'input' ? 'Iniciar sesión o registrarse' : 'Código de verificación'}
          </p>
        </div>

        {step === 'input' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="pollar-input"
                  required
                />
              </div>

              {feedback.message && (
                <div style={{
                  padding: 12,
                  borderRadius: 14,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--color-rose-bg)',
                  color: 'var(--color-rose)'
                }}>
                  <AlertCircle size={16} />
                  <span>{feedback.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="pollar-btn-primary"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Continuar con Email'
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0' }}>
              <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
              <span style={{ padding: '0 12px', fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>o continuar con</span>
              <div style={{ flexGrow: 1, height: 1, background: '#E2E8F0' }} />
            </div>

            {/* Social & Wallet Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Google Button */}
              <button
                onClick={handleGoogleLogin}
                type="button"
                className="pollar-btn-secondary"
                style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Google</span>
              </button>

              {/* Wallet Button */}
              <button
                onClick={() => setIsWalletModalOpen(true)}
                type="button"
                className="pollar-btn-outline-blue"
              >
                <Wallet size={18} />
                <span>Continuar con una billetera</span>
              </button>
            </div>
          </div>
        ) : (
          /* OTP Screen */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
            <div style={{ padding: 14, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <KeyRound size={18} />
              <span>Código enviado a {email}</span>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'center', gap: 8 }}
              onPaste={handleOtpPaste}
            >
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
                    width: 44,
                    height: 52,
                    borderRadius: 14,
                    border: digit ? '1.5px solid var(--pollar-blue)' : '1.5px solid #E2E8F0',
                    background: digit ? '#FFFFFF' : '#F8FAFC',
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>

            {feedback.message && (
              <div style={{
                padding: 10,
                borderRadius: 12,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'var(--color-rose-bg)',
                color: 'var(--color-rose)'
              }}>
                <AlertCircle size={15} />
                <span>{feedback.message}</span>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Ingresa el código de 6 dígitos para autenticarte.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStep('input'); setFeedback({ type: '', message: '' }); }}
                className="pollar-btn-secondary"
                style={{ flex: 1 }}
              >
                Volver
              </button>
              <button
                onClick={handleConfirmOtp}
                disabled={isLoading}
                className="pollar-btn-primary"
                style={{ flex: 1 }}
              >
                {isLoading ? 'Verificando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* Quick Access Preset Chips */}
        <div style={{ paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-light)', textAlign: 'center' }}>
            Acceso Rápido
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => {
                loginAsPreset('pagador');
                if (onLoginSuccess) onLoginSuccess();
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'var(--pollar-blue-light)',
                border: '1px solid rgba(0, 98, 255, 0.15)',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pollar-blue)', display: 'block' }}>⚡ Pagador</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>pagador@pollar.io</span>
            </button>
            <button
              onClick={() => {
                loginAsPreset('comercio');
                if (onLoginSuccess) onLoginSuccess();
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'var(--color-emerald-bg)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)', display: 'block' }}>🏪 Comercio POS</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>comercio@pollar.io</span>
            </button>
          </div>
        </div>

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
