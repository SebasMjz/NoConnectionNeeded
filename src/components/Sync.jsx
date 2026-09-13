import React from 'react';
import { useWallet } from '../context/WalletContext';

export default function Sync() {
  const { transactions, isSyncing } = useWallet();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="hsk-card">
        <div className="hsk-card-header">
          <div className="hsk-card-title">
            <span>Sync Pending Transactions</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {transactions?.length || 0} pending transactions
        </p>
        <button className="hsk-btn hsk-btn-primary" disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>
    </div>
  );
}
