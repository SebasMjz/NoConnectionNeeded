import React, { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { Send, ArrowDownLeft, RefreshCw, Power, Copy, ExternalLink, Coins, Wallet as WalletIcon } from 'lucide-react';

function BalanceCard() {
  const { usdcBalance, vaultBalance, hskBalance, currentUser, refreshBalances, wallet } = useWallet();

  useEffect(() => {
    if (currentUser?.address) {
      const interval = setInterval(() => refreshBalances(currentUser.address), 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.address, refreshBalances]);

  return (
    <div className="hsk-balance-card">
      <div className="hsk-balance-top">
        <span className="hsk-balance-label">Total Balance (USDC)</span>
        <button className="hsk-balance-refresh" onClick={() => refreshBalances(currentUser?.address)}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="hsk-balance-amount">
        <span>${parseFloat(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        <span className="hsk-balance-currency">USDC</span>
      </div>

      <div style={{ fontSize: 11, opacity: 0.85 }}>
        Vault: {parseFloat(vaultBalance).toFixed(2)} USDC • Gas: {hskBalance} HSK
      </div>

      <div className="hsk-balance-address" onClick={() => navigator.clipboard.writeText(currentUser?.address || '')}>
        <span>{currentUser?.address?.slice(0, 6)}...{currentUser?.address?.slice(-4)}</span>
        <Copy size={12} />
      </div>
    </div>
  );
}

function ActionButtons({ onSend, onMint, onDeposit, onWithdraw }) {
  return (
    <div className="hsk-actions">
      <button className="hsk-action-btn" onClick={onSend}>
        <div className="hsk-action-icon"><Send size={20} style={{ color: '#00B386' }} /></div>
        <span className="hsk-action-label">Send</span>
      </button>

      <button className="hsk-action-btn" onClick={onMint}>
        <div className="hsk-action-icon"><Coins size={20} style={{ color: '#F59E0B' }} /></div>
        <span className="hsk-action-label">Mint</span>
      </button>

      <button className="hsk-action-btn" onClick={onDeposit}>
        <div className="hsk-action-icon"><ArrowDownLeft size={20} style={{ color: '#10B981' }} /></div>
        <span className="hsk-action-label">Deposit</span>
      </button>

      <button className="hsk-action-btn" onClick={onWithdraw}>
        <div className="hsk-action-icon"><WalletIcon size={20} style={{ color: '#0062FF' }} /></div>
        <span className="hsk-action-label">Withdraw</span>
      </button>
    </div>
  );
}

function P2P() {
  const { sendUSDC, sendMetaTransaction, currentUser, refreshBalances } = useWallet();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [isMeta, setIsMeta] = useState(false);

  const handleSend = async () => {
    if (!toAddress || !amount) {
      setStatus('Ingresa address y monto');
      return;
    }
    setStatus('Enviando...');
    try {
      let txHash;
      if (isMeta) {
        txHash = await sendMetaTransaction(toAddress, amount);
        setStatus(`✅ Meta-tx enviada: ${txHash.slice(0, 20)}...`);
      } else {
        txHash = await sendUSDC(toAddress, amount);
        setStatus(`✅ Tx enviada: ${txHash.slice(0, 20)}...`);
      }
      await refreshBalances(currentUser.address);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="hsk-card">
        <div className="hsk-card-header">
          <div className="hsk-card-title">
            <span>Send USDC</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <input type="checkbox" checked={isMeta} onChange={(e) => setIsMeta(e.target.checked)} />
            Gasless (meta-tx)
          </label>
        </div>

        <input
          className="hsk-input"
          placeholder="0x... address"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
        />

        <input
          className="hsk-input"
          type="number"
          placeholder="Amount (USDC)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button className="hsk-btn hsk-btn-primary" onClick={handleSend}>
          {isMeta ? 'Send Gasless' : 'Send'} {amount && `$${amount}`}
        </button>

        {status && (
          <div style={{ padding: 10, borderRadius: 8, background: status.startsWith('✅') ? '#ECFDF5' : '#FEF2F2', fontSize: 11, color: status.startsWith('✅') ? '#059669' : '#DC2626' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

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
      setStatus(`Minted ${amount} USDC! Tx: ${tx.slice(0, 16)}...`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="hsk-card">
      <div className="hsk-card-header">
        <div className="hsk-card-title">
          <span>Mint MockUSDC</span>
        </div>
        <span style={{ fontSize: 10, color: '#6B7280' }}>Testnet only</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {['100', '500', '1000'].map(v => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            style={{
              flex: 1, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid #E2E8F0', background: amount === v ? '#E6FFF5' : '#F8FAFC',
              cursor: 'pointer'
            }}
          >
            ${v}
          </button>
        ))}
      </div>

      <button className="hsk-btn hsk-btn-secondary" onClick={handleMint}>
        <Coins size={16} /> Mint {amount} USDC
      </button>

      {status && (
        <div style={{ padding: 10, borderRadius: 8, background: status.startsWith('Minted') ? '#ECFDF5' : '#FEF2F2', fontSize: 11, color: status.startsWith('Minted') ? '#059669' : '#DC2626' }}>
          {status}
        </div>
      )}
    </div>
  );
}

function DepositWithdraw() {
  const { depositToVault, withdrawFromVault, vaultBalance, currentUser, refreshBalances } = useWallet();
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState('deposit');

  const handleAction = async () => {
    if (!amount) return;
    setStatus(`${action === 'deposit' ? 'Depositing' : 'Withdrawing'}...`);
    try {
      if (action === 'deposit') {
        await depositToVault(amount);
        setStatus(`Deposited ${amount} USDC to Vault`);
      } else {
        await withdrawFromVault(amount);
        setStatus(`Withdrew ${amount} USDC from Vault`);
      }
      await refreshBalances(currentUser.address);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="hsk-card">
      <div className="hsk-card-header">
        <div className="hsk-card-title">
          <span>Vault: {vaultBalance} USDC</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setAction('deposit')}
          style={{
            flex: 1, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: action === 'deposit' ? '#00B386' : '#F1F5F9',
            color: action === 'deposit' ? '#fff' : '#64748B'
          }}
        >
          Deposit
        </button>
        <button
          onClick={() => setAction('withdraw')}
          style={{
            flex: 1, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: action === 'withdraw' ? '#00B386' : '#F1F5F9',
            color: action === 'withdraw' ? '#fff' : '#64748B'
          }}
        >
          Withdraw
        </button>
      </div>

      <input
        className="hsk-input"
        type="number"
        placeholder="Amount (USDC)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button className="hsk-btn hsk-btn-primary" onClick={handleAction}>
        {action === 'deposit' ? 'Deposit' : 'Withdraw'} {amount && `$${amount}`}
      </button>

      {status && (
        <div style={{ padding: 10, borderRadius: 8, background: status.startsWith('✅') || status.startsWith('Deposited') || status.startsWith('Withdrew') ? '#ECFDF5' : '#FEF2F2', fontSize: 11 }}>
          {status}
        </div>
      )}
    </div>
  );
}

function Header({ onDisconnect }) {
  const { currentUser, hskBalance, refreshBalances } = useWallet();

  return (
    <header className="hsk-header">
      <div className="hsk-header-brand">
        <div className="hsk-logo">P</div>
        <span className="hsk-brand-text">Pollar</span>
      </div>

      <div className="hsk-header-actions">
        <button
          className="hsk-chain-badge"
          onClick={() => refreshBalances(currentUser?.address)}
          title="Refresh balances"
        >
          <div className="hsk-chain-dot" style={{ background: '#10B981' }} />
          <span>{hskBalance} HSK</span>
        </button>

        <button className="hsk-icon-btn" onClick={onDisconnect} title="Disconnect">
          <Power size={18} />
        </button>
      </div>
    </header>
  );
}

function AuthGateway({ onConnect, onDemo }) {
  const [privateKey, setPrivateKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', background: '#0A0F0D'
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#141A17', borderRadius: 24,
        padding: '32px 24px',
        border: '1px solid #1E2522',
        display: 'flex', flexDirection: 'column', gap: 20
      }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>Private Key</label>
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
                background: 'none', color: '#6B7280', border: 'none', cursor: 'pointer'
              }}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          className="hsk-btn hsk-btn-primary"
          onClick={() => onConnect(privateKey)}
        >
          Connect Wallet
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#1E2522' }} />
          <span style={{ fontSize: 11, color: '#6B7280' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1E2522' }} />
        </div>

        <button className="hsk-btn hsk-btn-secondary" onClick={onDemo}>
          🎲 Generate Demo Wallet
        </button>

        <p style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', lineHeight: 1.4 }}>
          Connects to HashKey Chain Testnet. Your keys never leave this device.
        </p>
      </div>
    </div>
  );
}

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
    { id: 'home', label: 'Wallet', icon: WalletIcon },
    { id: 'send', label: 'Send', icon: Send },
    { id: 'mint', label: 'Mint', icon: Coins },
    { id: 'vault', label: 'Vault', icon: ArrowDownLeft },
  ];

  return (
    <div className="hsk-app">
      <Header onDisconnect={disconnect} />

      <main className="hsk-main">
        {activeTab === 'home' && (
          <>
            <BalanceCard />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MintCard />
              <DepositWithdraw />
            </div>
          </>
        )}
        {activeTab === 'send' && <P2P />}
        {activeTab === 'mint' && <MintCard />}
        {activeTab === 'vault' && <DepositWithdraw />}
      </main>

      <nav className="hsk-nav">
        <div className="hsk-nav-pill">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`hsk-nav-tab ${activeTab === id ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span className="hsk-nav-label">{label}</span>
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
