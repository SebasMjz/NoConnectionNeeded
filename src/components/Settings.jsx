import React from 'react';
import { X } from 'lucide-react';

export default function Settings({ onClose }) {
  return (
    <div className="hsk-modal-overlay" onClick={onClose}>
      <div className="hsk-modal-sheet" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h2>
          <button className="hsk-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="hsk-list-item">
            <div className="hsk-list-left">
              <div className="hsk-list-icon">🔗</div>
              <div>
                <div className="hsk-list-title">Network</div>
                <div className="hsk-list-subtitle">HashKey Testnet</div>
              </div>
            </div>
          </div>

          <div className="hsk-list-item">
            <div className="hsk-list-left">
              <div className="hsk-list-icon">💳</div>
              <div>
                <div className="hsk-list-title">Wallets</div>
                <div className="hsk-list-subtitle">Manage wallets</div>
              </div>
            </div>
          </div>

          <div className="hsk-list-item">
            <div className="hsk-list-left">
              <div className="hsk-list-icon">🔒</div>
              <div>
                <div className="hsk-list-title">Security</div>
                <div className="hsk-list-subtitle">Biometrics, PIN</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
