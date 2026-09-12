import React, { useState, useEffect } from 'react';
import {
  Plus, Wallet, Trash2, CheckCircle2, Copy, AlertCircle,
  Eye, EyeOff, X, ChevronRight, Loader2, KeyRound, Shield
} from 'lucide-react';
import { generateRealStellarKeypair, importStellarAccount, fetchRealAccountBalances } from '../services/stellarCrypto';

const WALLETS_KEY = 'pollar_wallets';

function loadWallets() {
  try {
    return JSON.parse(localStorage.getItem(WALLETS_KEY) || '[]');
  } catch { return []; }
}

function saveWallets(wallets) {
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
}

function truncateKey(key, chars = 8) {
  if (!key) return '';
  return key.length > chars * 2 ? `${key.slice(0, chars)}...${key.slice(-chars)}` : key;
}

export default function WalletRegistry({ onClose }) {
  const [wallets, setWallets] = useState(loadWallets);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'import'
  const [showSecret, setShowSecret] = useState({}); // { [id]: boolean }
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [balances, setBalances] = useState({}); // { [publicKey]: balance }
  const [loadingBalances, setLoadingBalances] = useState(false);

  // ─── Create wallet ──────────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [createdWallet, setCreatedWallet] = useState(null);

  const handleCreateWallet = () => {
    if (!newName.trim()) {
      setFeedback({ type: 'error', message: 'Dale un nombre a tu billetera' });
      return;
    }
    const kp = generateRealStellarKeypair();
    const w = {
      id: 'w_' + Math.random().toString(36).slice(2, 9),
      name: newName.trim(),
      publicKey: kp.publicKey,
      secretKey: kp.secretKey,
      createdAt: Date.now(),
    };
    setCreatedWallet(w);
    setFeedback({ type: '', message: '' });
  };

  const handleConfirmCreatedWallet = () => {
    const updated = [createdWallet, ...wallets];
    saveWallets(updated);
    setWallets(updated);
    setCreatedWallet(null);
    setNewName('');
    setActiveTab('list');
    setFeedback({ type: 'success', message: `Billetera "${createdWallet.name}" creada` });
    setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
  };

  // ─── Import wallet ──────────────────────────────────────────────────
  const [importInput, setImportInput] = useState('');
  const [importName, setImportName] = useState('');

  const handleImport = () => {
    if (!importInput.trim()) {
      setFeedback({ type: 'error', message: 'Ingresa una clave Stellar (S... o G...)' });
      return;
    }
    if (!importName.trim()) {
      setFeedback({ type: 'error', message: 'Dale un nombre a tu billetera importada' });
      return;
    }
    let result;
    try {
      result = importStellarAccount(importInput.trim());
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Clave inválida' });
      return;
    }
    const w = {
      id: 'w_' + Math.random().toString(36).slice(2, 9),
      name: importName.trim(),
      publicKey: result.publicKey,
      secretKey: result.secretKey || null,
      createdAt: Date.now(),
    };
    const updated = [w, ...wallets];
    saveWallets(updated);
    setWallets(updated);
    setImportInput('');
    setImportName('');
    setActiveTab('list');
    setFeedback({ type: 'success', message: `Billetera "${w.name}" importada` });
    setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
  };

  // ─── Delete wallet ──────────────────────────────────────────────────
  const handleDelete = (id) => {
    const updated = wallets.filter(w => w.id !== id);
    saveWallets(updated);
    setWallets(updated);
    setFeedback({ type: 'success', message: 'Billetera eliminada' });
    setTimeout(() => setFeedback({ type: '', message: '' }), 2000);
  };

  // ─── Copy public key ────────────────────────────────────────────────
  const copyKey = (key) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setFeedback({ type: 'success', message: 'Clave copiada al portapapeles' });
    setTimeout(() => setFeedback({ type: '', message: '' }), 2000);
  };

  // ─── Load balances ─────────────────────────────────────────────────
  const loadBalances = async () => {
    setLoadingBalances(true);
    const results = {};
    for (const w of wallets) {
      try {
        const r = await fetchRealAccountBalances(w.publicKey);
        results[w.publicKey] = r.primaryBalance || 0;
      } catch {
        results[w.publicKey] = null;
      }
    }
    setBalances(results);
    setLoadingBalances(false);
  };

  useEffect(() => {
    if (activeTab === 'list' && wallets.length > 0) {
      loadBalances();
    }
  }, [activeTab]);

  // ─── Toggle secret visibility ──────────────────────────────────────
  const toggleSecret = (id) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '24px 24px 0 0',
      padding: '20px 20px 24px 20px',
      maxHeight: '85vh',
      overflowY: 'auto'
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={18} style={{ color: '#fff' }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>Billeteras</h2>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', padding: 6, color: 'var(--text-light)' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Feedback toast */}
      {feedback.message && (
        <div style={{
          padding: '10px 14px', borderRadius: 14, fontSize: 12, fontWeight: 700,
          marginBottom: 16,
          background: feedback.type === 'error' ? 'var(--color-rose-bg)' : 'var(--color-emerald-bg)',
          color: feedback.type === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {feedback.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          {feedback.message}
        </div>
      )}

      {/* Tab bar */}
      {activeTab !== 'create' && activeTab !== 'import' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setActiveTab('list')} style={{
            padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800,
            background: activeTab === 'list' ? 'var(--pollar-blue)' : 'var(--bg-card-muted)',
            color: activeTab === 'list' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer'
          }}>
            Mis billeteras ({wallets.length})
          </button>
          <button onClick={() => { setActiveTab('create'); setCreatedWallet(null); setNewName(''); }} style={{
            padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800,
            background: activeTab === 'create' ? 'var(--pollar-blue)' : 'var(--bg-card-muted)',
            color: activeTab === 'create' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer'
          }}>
            <Plus size={14} style={{ display: 'inline', marginRight: 4 }} />
            Nueva
          </button>
          <button onClick={() => { setActiveTab('import'); setImportInput(''); setImportName(''); }} style={{
            padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800,
            background: activeTab === 'import' ? 'var(--pollar-blue)' : 'var(--bg-card-muted)',
            color: activeTab === 'import' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer'
          }}>
            <KeyRound size={14} style={{ display: 'inline', marginRight: 4 }} />
            Importar
          </button>
        </div>
      )}

      {/* ─── LIST VIEW ──────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div>
          {wallets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
              <Wallet size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Sin billeteras registradas</p>
              <p style={{ fontSize: 12 }}>Crea una nueva o importa una existente</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wallets.map(w => (
                <div key={w.id} style={{
                  padding: '14px 16px', borderRadius: 18,
                  background: 'var(--bg-card-muted)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--pollar-blue), #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 14, fontWeight: 900
                      }}>
                        {w.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>{w.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {truncateKey(w.publicKey, 8)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => copyKey(w.publicKey)} style={{
                        padding: 6, background: 'none', color: 'var(--text-light)', border: 'none', cursor: 'pointer'
                      }} title="Copiar clave pública">
                        <Copy size={15} />
                      </button>
                      <button onClick={() => handleDelete(w.id)} style={{
                        padding: 6, background: 'none', color: 'var(--color-rose)', border: 'none', cursor: 'pointer'
                      }} title="Eliminar billetera">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Balance on-chain</span>
                    {loadingBalances ? (
                      <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Loader2 size={11} className="animate-spin" /> consultando...
                      </span>
                    ) : balances[w.publicKey] !== undefined ? (
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--pollar-blue)', fontFamily: 'var(--font-mono)' }}>
                        {balances[w.publicKey] !== null
                          ? `${balances[w.publicKey]} XLM`
                          : <span style={{ color: 'var(--color-rose)', fontSize: 10 }}>no hallada</span>
                        }
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>—</span>
                    )}
                  </div>

                  {/* Secret key (if present, show/hide) */}
                  {w.secretKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-light)' }}>Secreta:</span>
                      <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flex: 1 }}>
                        {showSecret[w.id]
                          ? w.secretKey
                          : truncateKey(w.secretKey, 12)
                        }
                      </code>
                      <button onClick={() => toggleSecret(w.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 2
                      }}>
                        {showSecret[w.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => copyKey(w.secretKey)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 2
                      }} title="Copiar clave secreta">
                        <Copy size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── CREATE VIEW ────────────────────────────────────────────── */}
      {activeTab === 'create' && !createdWallet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 16, borderRadius: 18, background: 'var(--pollar-blue-light)',
            border: '1px solid rgba(0,98,255,0.15)', display: 'flex', gap: 12, alignItems: 'flex-start'
          }}>
            <Shield size={20} style={{ color: 'var(--pollar-blue)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--pollar-blue)', marginBottom: 4 }}>
                Billetera Hierárquica Determinista (HD)
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Genera un par de claves Ed25519 real en Stellar. Tu clave privada se guarda solo en este dispositivo.
              </p>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Nombre de la billetera
            </label>
            <input
              className="pollar-input"
              placeholder="Ej: Billetera principal, Ahorros..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={40}
            />
          </div>

          <button onClick={handleCreateWallet} className="pollar-btn-primary">
            <Plus size={16} style={{ display: 'inline', marginRight: 6 }} />
            Generar nuevo par de claves
          </button>

          <button onClick={() => setActiveTab('list')} style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      )}

      {activeTab === 'create' && createdWallet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 14, borderRadius: 18, background: 'var(--color-emerald-bg)',
            border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center'
          }}>
            <CheckCircle2 size={32} style={{ color: 'var(--color-emerald)', margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-emerald)' }}>Billetera generada</p>
          </div>

          <div style={{ padding: 14, borderRadius: 16, background: 'var(--bg-card-muted)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>NOMBRE</span>
              <p style={{ fontSize: 13, fontWeight: 800 }}>{createdWallet.name}</p>
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>CLAVE PÚBLICA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', wordBreak: 'break-all', flex: 1 }}>{createdWallet.publicKey}</code>
                <button onClick={() => copyKey(createdWallet.publicKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div style={{
              padding: 12, borderRadius: 12, background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.2)'
            }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--color-rose)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <AlertCircle size={12} /> CLAVE SECRETA — NUNCA LA COMPARTAS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', wordBreak: 'break-all', flex: 1 }}>{createdWallet.secretKey}</code>
                <button onClick={() => copyKey(createdWallet.secretKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-rose)' }}>
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleConfirmCreatedWallet} className="pollar-btn-primary">
            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />
            Guardar billetera
          </button>
        </div>
      )}

      {/* ─── IMPORT VIEW ────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Clave Stellar (S... o G...)
            </label>
            <input
              className="pollar-input"
              placeholder="SA... o GA..."
              value={importInput}
              onChange={e => setImportInput(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Nombre para esta billetera
            </label>
            <input
              className="pollar-input"
              placeholder="Ej: Mi billetera fría, Backup..."
              value={importName}
              onChange={e => setImportName(e.target.value)}
              maxLength={40}
            />
          </div>

          <button onClick={handleImport} className="pollar-btn-primary">
            <KeyRound size={16} style={{ display: 'inline', marginRight: 6 }} />
            Importar billetera
          </button>

          <button onClick={() => setActiveTab('list')} style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
