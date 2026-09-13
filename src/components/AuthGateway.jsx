import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { Wallet, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function AuthGateway() {
  const { login, loginAsDemo } = useWallet();
  const [privateKey, setPrivateKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!privateKey.trim()) {
      setError('Ingresa una clave privada');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      login(privateKey.trim());
    } catch (err) {
      setError(err.message || 'Clave privada inválida');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = () => {
    loginAsDemo();
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
      background: '#0A0F0D'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: '#141A17',
        borderRadius: 24,
        padding: '32px 24px',
        border: '1px solid #1E2522',
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #00B386 0%, #00D68F 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontSize: 24, fontWeight: 700
          }}>P</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF' }}>Pollar</h1>
          <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Offline P2P Payments on HashKey Chain
          </p>
        </div>

        {/* Private Key Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>
            Private Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x..."
              className="hsk-input"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', color: '#6B7280'
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 10, borderRadius: 8,
            background: '#FEF2F2', color: '#DC2626', fontSize: 12
          }}>
            {error}
          </div>
        )}

        {/* Login Button */}
        <button onClick={handleLogin} disabled={isLoading} className="hsk-btn hsk-btn-primary">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><KeyRound size={16} /> Import Wallet</>
          )}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#1E2522' }} />
          <span style={{ fontSize: 11, color: '#6B7280' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1E2522' }} />
        </div>

        {/* Demo Button */}
        <button onClick={handleDemo} className="hsk-btn hsk-btn-secondary">
          <Wallet size={16} /> Try Demo Wallet
        </button>

        {/* Info */}
        <p style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', lineHeight: 1.4 }}>
          Your private key never leaves this device. All transactions are signed offline.
        </p>
      </div>
    </div>
  );
}
