import React, { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';

// Paleta Heartless
const PALETTE = {
  bg: '#0B0F14',
  surface: '#131920',
  surface2: '#1A2230',
  border: '#242E3E',
  text: '#E2E8F0',
  textMuted: '#8B99AD',
  accent: '#4A9FD4',
  positive: '#34D399',
  negative: '#F87171',
  warning: '#FBBF24',
};

// ============================================
// HEADER con Online/Offline Toggle
// ============================================
function Header({ onDisconnect }) {
  const { currentUser, hskBalance, isOnline, setOnline, refreshBalances } = useWallet();

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', background: PALETTE.surface,
      borderBottom: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${PALETTE.accent} 0%, ${PALETTE.positive} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, fontWeight: 700
        }}>P</div>
        <span style={{ fontSize: 18, fontWeight: 700, color: PALETTE.text }}>Pollar</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Online/Offline Toggle */}
        <button
          onClick={() => setOnline(!isOnline)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20,
            border: `1px solid ${isOnline ? PALETTE.positive : PALETTE.negative}`,
            background: isOnline ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
            color: isOnline ? PALETTE.positive : PALETTE.negative,
            fontSize: 11, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isOnline ? PALETTE.positive : PALETTE.negative
          }} />
          {isOnline ? 'Online' : 'Offline'}
        </button>

        {/* Gas balance */}
        <div style={{
          padding: '6px 10px', borderRadius: 8,
          background: PALETTE.surface2, border: `1px solid ${PALETTE.border}`,
          fontSize: 11, color: PALETTE.textMuted
        }}>
          {parseFloat(hskBalance || 0).toFixed(4)} HSK
        </div>

        {/* Disconnect */}
        <button
          onClick={onDisconnect}
          style={{
            padding: 8, borderRadius: 8, border: 'none',
            background: PALETTE.surface2, color: PALETTE.textMuted,
            cursor: 'pointer'
          }}
          title="Desconectar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64M12 2v10"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

// ============================================
// BALANCE CARD
// ============================================
function BalanceCard() {
  const { usdcBalance, vaultBalance, currentUser, refreshBalances } = useWallet();

  useEffect(() => {
    if (currentUser?.address) {
      const interval = setInterval(() => refreshBalances(currentUser.address), 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.address, refreshBalances]);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${PALETTE.surface} 0%, ${PALETTE.surface2} 100%)`,
      borderRadius: 16, padding: 20,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: PALETTE.textMuted }}>Balance Total (USDC)</span>
        <button
          onClick={() => refreshBalances(currentUser?.address)}
          style={{
            background: 'none', border: 'none', color: PALETTE.accent,
            cursor: 'pointer', padding: 4
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: PALETTE.text }}>
          ${parseFloat(usdcBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
        <span style={{ fontSize: 14, color: PALETTE.textMuted }}>USDC</span>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 10,
        background: PALETTE.bg, fontSize: 11
      }}>
        <div>
          <span style={{ color: PALETTE.textMuted }}>Vault: </span>
          <span style={{ color: PALETTE.positive, fontWeight: 600 }}>{parseFloat(vaultBalance || 0).toFixed(2)} USDC</span>
        </div>
        <div
          onClick={() => navigator.clipboard.writeText(currentUser?.address || '')}
          style={{ color: PALETTE.accent, cursor: 'pointer' }}
        >
          {currentUser?.address?.slice(0, 6)}...{currentUser?.address?.slice(-4)}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MARKET WIDGET
// ============================================
function MarketWidget() {
  const [prices] = useState([
    { symbol: 'BTC', name: 'Bitcoin', price: 67432.50, change: 2.34 },
    { symbol: 'ETH', name: 'Ethereum', price: 3521.80, change: -1.12 },
    { symbol: 'HSK', name: 'HashKey', price: 0.12, change: 0.45 },
    { symbol: 'USDC', name: 'USD Coin', price: 1.00, change: 0.00 },
  ]);

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 14,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text }}>Mercado</span>
        <span style={{ fontSize: 10, color: PALETTE.textMuted }}>24h</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {prices.map(coin => (
          <div key={coin.symbol} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: PALETTE.surface2, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: PALETTE.textMuted
              }}>
                {coin.symbol.slice(0, 3)}
              </div>
              <span style={{ fontSize: 12, color: PALETTE.text }}>{coin.name}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: PALETTE.text }}>
                ${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{
                fontSize: 10,
                color: coin.change >= 0 ? PALETTE.positive : PALETTE.negative
              }}>
                {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// NEWS WIDGET
// ============================================
function NewsWidget() {
  const [news] = useState([
    { title: 'HashKey Chain lanza staking para HSK', source: 'CoinDesk', time: '2h' },
    { title: 'USDC supera $40B en circulacion', source: 'The Block', time: '5h' },
    { title: 'Stellar integra nuevos protocolos DeFi', source: 'Decrypt', time: '1d' },
  ]);

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 14,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text }}>Noticias</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {news.map((item, i) => (
          <div key={i} style={{
            padding: '8px 10px', borderRadius: 8,
            background: PALETTE.bg, cursor: 'pointer'
          }}>
            <div style={{ fontSize: 11, color: PALETTE.text, marginBottom: 4, lineHeight: 1.3 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 10, color: PALETTE.textMuted }}>
              {item.source} - hace {item.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SYNC WIDGET
// ============================================
function SyncWidget() {
  const { pendingTx, syncPendingTx, isOnline } = useWallet();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    try {
      await syncPendingTx();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 14,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text }}>Sync</span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: pendingTx.length > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)',
          color: pendingTx.length > 0 ? PALETTE.warning : PALETTE.positive
        }}>
          {pendingTx.length} pendientes
        </span>
      </div>

      {pendingTx.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
          {pendingTx.slice(0, 3).map(tx => (
            <div key={tx.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', fontSize: 11, borderBottom: `1px solid ${PALETTE.border}`
            }}>
              <span style={{ color: PALETTE.textMuted }}>{tx.type}</span>
              <span style={{ color: PALETTE.accent, fontWeight: 600 }}>{tx.amount} USDC</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: PALETTE.positive, marginBottom: 10 }}>
          Sin transacciones pendientes
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={!isOnline || syncing || pendingTx.length === 0}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: 'none', fontSize: 11, fontWeight: 600,
          background: isOnline && pendingTx.length > 0 ? PALETTE.accent : PALETTE.surface2,
          color: isOnline && pendingTx.length > 0 ? '#fff' : PALETTE.textMuted,
          cursor: isOnline && pendingTx.length > 0 ? 'pointer' : 'not-allowed'
        }}
      >
        {syncing ? 'Sincronizando...' : 'Sync Ahora'}
      </button>
    </div>
  );
}

// ============================================
// P2P - Send / Receive
// ============================================
function P2PSend() {
  const { sendUSDC, currentUser, addPendingTx, isOnline } = useWallet();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handleSend = async () => {
    if (!toAddress || !amount) {
      setStatus('Ingresa direccion y monto');
      return;
    }
    if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
      setStatus('Direccion invalida (0x... 42 caracteres)');
      return;
    }

    setStatus('Enviando...');
    try {
      let txHash;
      if (isOnline) {
        txHash = await sendUSDC(toAddress, amount);
        setStatus(`Tx enviada: ${txHash.slice(0, 16)}...`);
      } else {
        addPendingTx({ type: 'SEND', to: toAddress, amount, from: currentUser.address });
        setStatus(`Guardado offline. Tx: ${amount} USDC a ${toAddress.slice(0, 8)}...`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 16,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text, marginBottom: 12 }}>
        Enviar USDC
      </div>

      <input
        placeholder="0x... direccion (42 caracteres)"
        value={toAddress}
        onChange={e => setToAddress(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${PALETTE.border}`, background: PALETTE.bg,
          color: PALETTE.text, fontSize: 12, marginBottom: 8
        }}
      />

      <input
        type="number"
        placeholder="Monto (USDC)"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${PALETTE.border}`, background: PALETTE.bg,
          color: PALETTE.text, fontSize: 12, marginBottom: 12
        }}
      />

      <button
        onClick={handleSend}
        style={{
          width: '100%', padding: '10px 16px', borderRadius: 8,
          border: 'none', fontSize: 12, fontWeight: 600,
          background: PALETTE.accent, color: '#fff', cursor: 'pointer'
        }}
      >
        {isOnline ? 'Enviar Online' : 'Guardar Offline'} {amount && `$${amount}`}
      </button>

      {status && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: status.startsWith('Error') ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)',
          fontSize: 10, color: status.startsWith('Error') ? PALETTE.negative : PALETTE.positive
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

function P2PReceive() {
  const { receivePayload, addPendingTx, isOnline } = useWallet();
  const [payload, setPayload] = useState('');
  const [status, setStatus] = useState('');

  const handleReceive = async () => {
    if (!payload) {
      setStatus('Pega el payload');
      return;
    }
    setStatus('Verificando...');
    try {
      const result = receivePayload(payload);
      if (isOnline) {
        setStatus(`Recibido online: $${result.amount} USDC`);
      } else {
        addPendingTx({ type: 'RECEIVE', ...result, synced: false });
        setStatus(`Guardado offline: $${result.amount} USDC`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 16,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text, marginBottom: 12 }}>
        Recibir Pago P2P
      </div>

      <textarea
        placeholder="Pega el payload JSON aqui"
        value={payload}
        onChange={e => setPayload(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${PALETTE.border}`, background: PALETTE.bg,
          color: PALETTE.text, fontSize: 11, minHeight: 80,
          fontFamily: 'monospace', resize: 'vertical', marginBottom: 12
        }}
      />

      <button
        onClick={handleReceive}
        style={{
          width: '100%', padding: '10px 16px', borderRadius: 8,
          border: 'none', fontSize: 12, fontWeight: 600,
          background: PALETTE.positive, color: '#fff', cursor: 'pointer'
        }}
      >
        Confirmar Recepcion
      </button>

      {status && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: status.startsWith('Error') ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)',
          fontSize: 10, color: status.startsWith('Error') ? PALETTE.negative : PALETTE.positive
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// ============================================
// MINT CARD
// ============================================
function MintCard() {
  const { mintUSDC, currentUser, refreshBalances } = useWallet();
  const [amount, setAmount] = useState('100');
  const [status, setStatus] = useState('');

  const handleMint = async () => {
    if (!amount) return;
    setStatus('Minting...');
    try {
      const tx = await mintUSDC(amount);
      await refreshBalances(currentUser.address);
      setStatus(`Minted ${amount} USDC`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 14,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text }}>Mint MockUSDC</span>
        <span style={{ fontSize: 10, color: PALETTE.warning }}>Testnet</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['100', '500', '1000'].map(v => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${amount === v ? PALETTE.accent : PALETTE.border}`,
              background: amount === v ? 'rgba(74,159,212,0.1)' : 'transparent',
              color: amount === v ? PALETTE.accent : PALETTE.textMuted, cursor: 'pointer'
            }}
          >
            ${v}
          </button>
        ))}
      </div>

      <button
        onClick={handleMint}
        style={{
          width: '100%', padding: '10px 16px', borderRadius: 8,
          border: 'none', fontSize: 12, fontWeight: 600,
          background: PALETTE.accent, color: '#fff', cursor: 'pointer'
        }}
      >
        Mint {amount} USDC
      </button>

      {status && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: status.startsWith('Error') ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)',
          fontSize: 10, color: status.startsWith('Error') ? PALETTE.negative : PALETTE.positive
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// ============================================
// VAULT CARD
// ============================================
function VaultCard() {
  const { depositToVault, withdrawFromVault, vaultBalance, currentUser, refreshBalances } = useWallet();
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState('deposit');
  const [status, setStatus] = useState('');

  const handleAction = async () => {
    if (!amount) return;
    setStatus(action === 'deposit' ? 'Depositing...' : 'Withdrawing...');
    try {
      if (action === 'deposit') {
        await depositToVault(amount);
        setStatus(`Deposited ${amount} USDC`);
      } else {
        await withdrawFromVault(amount);
        setStatus(`Withdrew ${amount} USDC`);
      }
      await refreshBalances(currentUser.address);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{
      background: PALETTE.surface, borderRadius: 12, padding: 14,
      border: `1px solid ${PALETTE.border}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PALETTE.text }}>Vault</span>
        <span style={{ fontSize: 11, color: PALETTE.positive }}>{vaultBalance} USDC</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setAction('deposit')}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: action === 'deposit' ? PALETTE.positive : PALETTE.surface2,
            color: action === 'deposit' ? '#fff' : PALETTE.textMuted
          }}
        >
          Deposit
        </button>
        <button
          onClick={() => setAction('withdraw')}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: action === 'withdraw' ? PALETTE.negative : PALETTE.surface2,
            color: action === 'withdraw' ? '#fff' : PALETTE.textMuted
          }}
        >
          Withdraw
        </button>
      </div>

      <input
        type="number"
        placeholder="Monto (USDC)"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${PALETTE.border}`, background: PALETTE.bg,
          color: PALETTE.text, fontSize: 12, marginBottom: 12
        }}
      />

      <button
        onClick={handleAction}
        style={{
          width: '100%', padding: '10px 16px', borderRadius: 8,
          border: 'none', fontSize: 12, fontWeight: 600,
          background: action === 'deposit' ? PALETTE.positive : PALETTE.negative,
          color: '#fff', cursor: 'pointer'
        }}
      >
        {action === 'deposit' ? 'Deposit' : 'Withdraw'} {amount && `$${amount}`}
      </button>

      {status && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: status.startsWith('Error') ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)',
          fontSize: 10, color: status.startsWith('Error') ? PALETTE.negative : PALETTE.positive
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// ============================================
// AUTH GATEWAY - Auto-login con relayer key
// ============================================
function AuthGateway({ onConnect, onDemo }) {
  useEffect(() => {
    const relayerKey = '0x8a2928db10eb8fbe530a6c130f93d910fbd8b526f9522fad60340c3fe8ee6268';
    onConnect(relayerKey);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', background: PALETTE.bg
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: PALETTE.surface, borderRadius: 16, padding: '32px 24px',
        border: `1px solid ${PALETTE.border}`, textAlign: 'center'
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `linear-gradient(135deg, ${PALETTE.accent} 0%, ${PALETTE.positive} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 auto 16px'
        }}>P</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: PALETTE.text, marginBottom: 8 }}>Pollar</h1>
        <p style={{ fontSize: 12, color: PALETTE.textMuted, marginBottom: 24 }}>
          Offline P2P Payments on HashKey Chain
        </p>
        <div style={{ fontSize: 11, color: PALETTE.accent }}>Conectando...</div>
      </div>
    </div>
  );
}

// ============================================
// APP CONTENT
// ============================================
function AppContent() {
  const { currentUser, isConnecting, connectWithPrivateKey, generateDemoWallet, disconnect } = useWallet();
  const [activeTab, setActiveTab] = useState('home');

  if (!currentUser) {
    return (
      <AuthGateway
        onConnect={connectWithPrivateKey}
        onDemo={generateDemoWallet}
      />
    );
  }

  const tabs = [
    { id: 'home', label: 'Wallet' },
    { id: 'p2p', label: 'P2P' },
    { id: 'mint', label: 'Mint' },
    { id: 'vault', label: 'Vault' },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: PALETTE.bg, color: PALETTE.text
    }}>
      <Header onDisconnect={disconnect} />

      <main style={{ flex: 1, padding: 16, paddingBottom: 80 }}>
        {activeTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BalanceCard />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MarketWidget />
              <SyncWidget />
            </div>
            <NewsWidget />
          </div>
        )}

        {activeTab === 'p2p' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <P2PSend />
            <P2PReceive />
          </div>
        )}

        {activeTab === 'mint' && <MintCard />}
        {activeTab === 'vault' && <VaultCard />}
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '8px 16px', background: PALETTE.surface,
        borderTop: `1px solid ${PALETTE.border}`
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          background: PALETTE.surface2, borderRadius: 12, padding: '6px 0'
        }}>
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, padding: '8px 0', border: 'none',
                background: 'none', color: activeTab === id ? PALETTE.accent : PALETTE.textMuted,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}
