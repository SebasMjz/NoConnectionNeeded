import React from 'react';
import { useWallet } from '../context/WalletContext';

export default function P2P() {
  const { wallet } = useWallet();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="hsk-card">
        <div className="hsk-card-header">
          <div className="hsk-card-title">
            <span>P2P Offline Payments</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Send and receive payments offline via QR, Bluetooth, or NFC. 
          Transactions settle on-chain when you reconnect.
        </p>
        <button className="hsk-btn hsk-btn-primary">
          Scan QR to Pay
        </button>
      </div>
    </div>
  );
}
