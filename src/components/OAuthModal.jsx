import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const SAMPLE_ACCOUNTS = [
  {
    email: 'mi.cuenta@gmail.com',
    name: 'Mi Cuenta',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=main',
    color: '#4285F4',
  },
  {
    email: 'trabajo@gmail.com',
    name: 'Cuenta de Trabajo',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=work',
    color: '#34A853',
  },
];

/**
 * OAuthModal — Simulates a Google OAuth consent flow.
 * In production this should be replaced with a real Google Identity Services popup.
 *
 * Props:
 *  isOpen: boolean
 *  onClose: () => void
 *  onSuccess: (profile: { email, name, avatar, provider }) => void
 */
export default function OAuthModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'custom' | 'loading' | 'done'
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChoose = async (account) => {
    setSelected(account);
    setStep('loading');
    setError('');
    // Simulate OAuth network round-trip
    await new Promise(r => setTimeout(r, 900));
    setStep('done');
    await new Promise(r => setTimeout(r, 500));
    onSuccess({
      email: account.email,
      name: account.name,
      avatar: account.avatar,
      provider: 'google',
    });
    onClose();
    setStep('choose');
    setSelected(null);
  };

  const handleCustom = async (e) => {
    e.preventDefault();
    setError('');
    if (!customEmail.includes('@')) {
      setError('Ingresa un email de Google válido.');
      return;
    }
    const profile = {
      email: customEmail.trim().toLowerCase(),
      name: customName.trim() || customEmail.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(customEmail)}`,
      provider: 'google',
    };
    setSelected(profile);
    setStep('loading');
    await new Promise(r => setTimeout(r, 900));
    setStep('done');
    await new Promise(r => setTimeout(r, 500));
    onSuccess(profile);
    onClose();
    setStep('choose');
    setCustomEmail('');
    setCustomName('');
    setSelected(null);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        padding: '20px 16px',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 28,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          animation: 'slideUp 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Google header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f1f1f' }}>Continuar con Google</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', padding: 6, color: '#5f6368', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#5f6368', textAlign: 'center' }}>
          Elige una cuenta para iniciar sesión en <strong>Pollar Pay</strong>
        </p>

        {/* Loading / Done state */}
        {(step === 'loading' || step === 'done') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0' }}>
            {step === 'loading' ? (
              <>
                <Loader2 size={36} style={{ color: '#4285F4', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>Verificando con Google…</p>
                {selected && <p style={{ fontSize: 12, color: '#5f6368' }}>{selected.email}</p>}
              </>
            ) : (
              <>
                <CheckCircle2 size={36} style={{ color: '#34A853' }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#34A853' }}>¡Autenticado exitosamente!</p>
              </>
            )}
          </div>
        )}

        {/* Choose account */}
        {step === 'choose' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SAMPLE_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => handleChoose(acc)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 16,
                    border: '1.5px solid #e8eaed',
                    background: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <img
                    src={acc.avatar}
                    alt={acc.name}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: acc.color + '20', border: `2px solid ${acc.color}40` }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1f1f1f' }}>{acc.name}</p>
                    <p style={{ fontSize: 11, color: '#5f6368' }}>{acc.email}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: '#e8eaed' }} />
              <span style={{ fontSize: 11, color: '#9aa0a6', fontWeight: 500 }}>o usa otro email</span>
              <div style={{ flex: 1, height: 1, background: '#e8eaed' }} />
            </div>

            <button
              onClick={() => setStep('custom')}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 14,
                border: '1.5px solid #e8eaed', background: '#f8f9fa',
                fontSize: 13, fontWeight: 700, color: '#1a73e8',
                cursor: 'pointer',
              }}
            >
              Usar otra cuenta de Google
            </button>
          </>
        )}

        {/* Custom email */}
        {step === 'custom' && (
          <form onSubmit={handleCustom} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3c4043', display: 'block', marginBottom: 5 }}>
                Email de Google
              </label>
              <input
                type="email"
                value={customEmail}
                onChange={e => setCustomEmail(e.target.value)}
                placeholder="tu@gmail.com"
                className="pollar-input"
                required
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#3c4043', display: 'block', marginBottom: 5 }}>
                Nombre (opcional)
              </label>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Tu nombre"
                className="pollar-input"
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d93025' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setStep('choose'); setError(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 12,
                  border: '1.5px solid #e8eaed', background: '#f8f9fa',
                  fontSize: 13, fontWeight: 700, color: '#3c4043', cursor: 'pointer',
                }}
              >
                Volver
              </button>
              <button
                type="submit"
                style={{
                  flex: 2, padding: '10px', borderRadius: 12,
                  background: '#1a73e8', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                }}
              >
                Continuar
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p style={{ fontSize: 10, color: '#9aa0a6', textAlign: 'center' }}>
          Al continuar, aceptas los Términos de Servicio de Pollar y la Política de privacidad de Google.
        </p>
      </div>
    </div>
  );
}
