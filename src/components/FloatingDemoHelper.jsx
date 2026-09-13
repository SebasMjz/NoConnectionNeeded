import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { Sparkles, X, Check, ChevronUp, RotateCcw, Zap } from 'lucide-react';

export default function FloatingDemoHelper() {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedNote, setCopiedNote] = useState('');
  const { wallet, loginAsPreset, requestFriendbotFunding, resetDemoData, role } = useWallet();

  const handleQuickPreset = (type) => {
    loginAsPreset(type);
    setCopiedNote(`${type === 'pagador' ? 'Pagador (A)' : 'Comercio (B)'} conectado`);
    setTimeout(() => { setCopiedNote(''); setIsOpen(false); }, 1500);
  };

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {copiedNote && (
        <div style={{
          marginBottom: 8, padding: '8px 16px', borderRadius: 20,
          background: '#0062FF', color: '#FFFFFF', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Check size={14} /> {copiedNote}
        </div>
      )}
      
      {isOpen && (
        <div style={{
          marginBottom: 12, width: 280, borderRadius: 24, padding: 16,
          background: '#FFFFFF', border: '1px solid #E2E8F0',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ padding: 6, borderRadius: 10, background: '#EEF5FF' }}>
                <Sparkles size={16} style={{ color: '#0062FF' }} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Demo Rápido</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ padding: 6, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer' }}>
              <X size={14} style={{ color: '#64748B' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => handleQuickPreset('pagador')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 12, borderRadius: 16, background: '#EEF5FF',
                border: '1px solid rgba(0,98,255,0.15)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#0062FF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>A</div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', display: 'block' }}>Pagador A</span>
                  <span style={{ fontSize: 10, color: '#64748B' }}>pagador@pollar.io</span>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0062FF' }}>Entrar</span>
            </button>

            <button
              onClick={() => handleQuickPreset('comercio')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 12, borderRadius: 16, background: '#ECFDF5',
                border: '1px solid rgba(16,185,129,0.15)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#10B981', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>B</div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', display: 'block' }}>Comercio B</span>
                  <span style={{ fontSize: 10, color: '#64748B' }}>comercio@pollar.io</span>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>Entrar</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
            <button
              onClick={() => requestFriendbotFunding(wallet?.publicKey)}
              style={{
                flex: 1, padding: '8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: '#FFFBEB', color: '#B45309', border: '1px solid rgba(245,158,11,0.2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              <Zap size={12} /> +10k XLM
            </button>
            <button
              onClick={() => resetDemoData()}
              style={{
                padding: '8px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer'
              }}
              title="Reiniciar"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 30,
          background: 'linear-gradient(135deg, #0052EE 0%, #0070F3 100%)',
          color: '#FFFFFF', fontSize: 12, fontWeight: 700,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 25px rgba(0,98,255,0.4)'
        }}
      >
        <Sparkles size={16} />
        <span>Demo</span>
      </button>
    </div>
  );
}
