import React, { useState, useEffect } from 'react';
import {
  Plus, Wallet, Trash2, CheckCircle2, Copy, AlertCircle,
  Eye, EyeOff, X, ChevronRight, Loader2, KeyRound, Shield,
  Star, Link2, Unlink, RefreshCw
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import {
  generateRealStellarKeypair,
  importStellarAccount,
} from '../services/stellarCrypto';

function truncateKey(key, chars = 8) {
  if (!key) return '';
  return key.length > chars * 2 ? `${key.slice(0, chars)}...${key.slice(-chars)}` : key;
}

/**
 * WalletRegistry
 *
 * Displays and manages the user's linked Stellar wallets.
 * Reads from / writes to WalletContext (linkedWallets).
 *
 * Props:
 *  onClose: () => void | null (null = embedded mode)
 *  embedded: boolean — if true, renders without the bottom sheet chrome
 */
export default function WalletRegistry({ onClose = null, embedded = false }) {
  const {
    linkedWallets,
    activeWallet,
    activeWalletId,
    linkWallet,
    unlinkWallet,
    selectActiveWallet,
    refreshOnlineBalance,
    isRefreshingBalance,
    isMainnet,
  } = useWallet();

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'import'
  const [showSecret, setShowSecret] = useState({});
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loadingBalance, setLoadingBalance] = useState({});

  // ─── Create wallet ──────────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [createdWallet, setCreatedWallet] = useState(null);

  const handleCreateWallet = () => {
    if (!newName.trim()) {
      setFeedback({ type: 'error', message: 'Dale un nombre a tu billetera' });
      return;
    }
    const kp = generateRealStellarKeypair();
    setCreatedWallet({
      publicKey: kp.publicKey,
      secretKey: kp.secretKey,
      name: newName.trim(),
    });
    setFeedback({ type: '', message: '' });
  };

  const handleConfirmCreatedWallet = () => {
    linkWallet({
      publicKey: createdWallet.publicKey,
      secretKey: createdWallet.secretKey,
      name: createdWallet.name,
    });
    setCreatedWallet(null);
    setNewName('');
    setActiveTab('list');
    setFeedback({ type: 'success', message: `Billetera "${createdWallet.name}" creada y vinculada` });
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
    linkWallet({
      publicKey: result.publicKey,
      secretKey: result.secretKey || null,
      name: importName.trim(),
      isReadOnly: result.isReadOnly,
    });
    setImportInput('');
    setImportName('');
    setActiveTab('list');
    setFeedback({ type: 'success', message: `Billetera "${importName}" vinculada` });
    setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
  };

  // ─── Unlink wallet ──────────────────────────────────────────────────
  const handleUnlink = (walletId, name) => {
    if (!window.confirm(`¿Desvincular "${name}"? Esto no elimina la cuenta Stellar.`)) return;
    unlinkWallet(walletId);
    setFeedback({ type: 'success', message: `"${name}" desvinculada` });
    setTimeout(() => setFeedback({ type: '', message: '' }), 2000);
  };

  // ─── Copy key ──────────────────────────────────────────────────────
  const copyKey = (key) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setFeedback({ type: 'success', message: 'Clave copiada al portapapeles' });
    setTimeout(() => setFeedback({ type: '', message: '' }), 2000);
  };

  // ─── Toggle secret visibility ──────────────────────────────────────
  const toggleSecret = (id) => {
    setShowSecret(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── Refresh balance ───────────────────────────────────────────────
  const handleRefreshBalance = async (publicKey, walletId) => {
    setLoadingBalance(prev => ({ ...prev, [walletId]: true }));
    await refreshOnlineBalance(publicKey);
    setLoadingBalance(prev => ({ ...prev, [walletId]: false }));
  };

  const wrapperStyle = embedded
    ? { width: '100%' }
    : {
        background: '#FFFFFF',
        borderRadius: '24px 24px 0 0',
        padding: '20px 20px 24px 20px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      };

  return (
    <div style={wrapperStyle}>
      {/* Header (only in modal mode) */}
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>Mis Billeteras</h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{linkedWallets.length} billetera{linkedWallets.length !== 1 ? 's' : ''} vinculada{linkedWallets.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="pollar-icon-btn"><X size={18} /></button>
          )}
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{ display: 'flex', background: '#EBF0F7', padding: 4, borderRadius: 14, gap: 4 }}>
        {[
          { id: 'list', label: 'Vinculadas', icon: Link2 },
          { id: 'create', label: 'Nueva', icon: Plus },
          { id: 'import', label: 'Importar', icon: KeyRound },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setFeedback({ type: '', message: '' }); setCreatedWallet(null); }}
            style={{
              flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: activeTab === id ? '#FFFFFF' : 'transparent',
              color: activeTab === id ? 'var(--pollar-blue)' : 'var(--text-muted)',
              boxShadow: activeTab === id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback.message && (
        <div style={{
          padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
          background: feedback.type === 'error' ? 'var(--color-rose-bg)' : 'var(--color-emerald-bg)',
          color: feedback.type === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)',
        }}>
          {feedback.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {feedback.message}
        </div>
      )}

      {/* ─── LIST TAB ─── */}
      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {linkedWallets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={28} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>No tienes billeteras vinculadas</p>
              <button
                onClick={() => setActiveTab('create')}
                className="pollar-btn-primary"
                style={{ minWidth: 180 }}
              >
                <Plus size={16} /> Crear primera billetera
              </button>
            </div>
          ) : (
            linkedWallets.map(w => {
              const isActive = w.id === activeWalletId;
              const bal = w.mainBalance ?? 0;
              return (
                <div
                  key={w.id}
                  style={{
                    padding: 16, borderRadius: 20,
                    border: isActive
                      ? '2px solid var(--pollar-blue)'
                      : '1.5px solid var(--border-subtle)',
                    background: isActive ? 'var(--pollar-blue-light)' : '#FAFAFA',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Active badge */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: -1, right: 12,
                      background: 'var(--pollar-blue)', color: '#fff',
                      fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: '0 0 8px 8px',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Star size={10} fill="white" /> ACTIVA
                    </div>
                  )}

                  {/* Wallet Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 14,
                        background: isActive ? 'var(--pollar-blue)' : '#E8EDF5',
                        color: isActive ? '#fff' : 'var(--pollar-blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 900,
                      }}>
                        {w.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>{w.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-light)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {w.isPollar && <span style={{ color: 'var(--pollar-blue)', fontWeight: 800 }}>Pollar</span>}
                          {!w.isPollar && w.isReadOnly && <span style={{ color: 'var(--color-amber)', fontWeight: 800 }}>Solo lectura</span>}
                          {!w.isPollar && !w.isReadOnly && <span style={{ color: 'var(--color-emerald)', fontWeight: 800 }}>Firmante</span>}
                        </p>
                      </div>
                    </div>

                    {/* Balance */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: isActive ? 'var(--pollar-blue)' : 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        {bal.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{w.asset || 'XLM'}</div>
                    </div>
                  </div>

                  {/* Public Key */}
                  <div
                    onClick={() => copyKey(w.publicKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: '#FFFFFF', borderRadius: 12, border: '1px solid var(--border-subtle)',
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                    }}
                  >
                    <Copy size={13} style={{ flexShrink: 0, color: 'var(--pollar-blue)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.publicKey}
                    </span>
                  </div>

                  {/* Secret Key (if has one) */}
                  {w.secretKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FFF7ED', borderRadius: 12, border: '1px solid rgba(245,158,11,0.3)' }}>
                      <Shield size={13} style={{ flexShrink: 0, color: 'var(--color-amber)' }} />
                      <span style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {showSecret[w.id] ? w.secretKey : '•'.repeat(32)}
                      </span>
                      <button onClick={() => toggleSecret(w.id)} style={{ background: 'none', color: 'var(--color-amber)', flexShrink: 0, display: 'flex' }}>
                        {showSecret[w.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isActive && (
                      <button
                        onClick={() => selectActiveWallet(w.id)}
                        className="pollar-btn-primary"
                        style={{ flex: 1, padding: '10px 12px', fontSize: 12 }}
                      >
                        <Star size={14} /> Activar
                      </button>
                    )}
                    <button
                      onClick={() => handleRefreshBalance(w.publicKey, w.id)}
                      disabled={loadingBalance[w.id]}
                      style={{
                        padding: '10px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: '#F1F5F9', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <RefreshCw size={14} className={loadingBalance[w.id] ? 'animate-spin' : ''} />
                      {isActive ? 'Actualizar' : ''}
                    </button>
                    <button
                      onClick={() => handleUnlink(w.id, w.name)}
                      style={{
                        padding: '10px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: 'var(--color-rose-bg)', border: '1px solid rgba(244,63,94,0.2)',
                        color: 'var(--color-rose)', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Unlink size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── CREATE TAB ─── */}
      {activeTab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!createdWallet ? (
            <>
              <div style={{ padding: 16, borderRadius: 18, background: 'var(--pollar-blue-light)', border: '1px solid rgba(0,98,255,0.2)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--pollar-blue)' }}>
                  Se generará un par de claves Ed25519 nuevo en Stellar {isMainnet ? 'Mainnet' : 'Testnet'}.
                </p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Nombre de la billetera
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="ej: Mi billetera principal"
                  className="pollar-input"
                  autoFocus
                />
              </div>
              <button onClick={handleCreateWallet} className="pollar-btn-primary">
                <Plus size={16} /> Generar Billetera
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 16, borderRadius: 18, background: 'var(--color-emerald-bg)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={20} color="var(--color-emerald)" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-emerald)' }}>¡Claves generadas!</p>
                  <p style={{ fontSize: 11, color: '#065F46' }}>Guarda tu clave privada en un lugar seguro.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Clave Pública (G...)</p>
                  <div
                    onClick={() => copyKey(createdWallet.publicKey)}
                    style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Copy size={12} color="var(--pollar-blue)" />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {createdWallet.publicKey}
                    </span>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-amber)', marginBottom: 4 }}>⚠️ Clave Privada (S...) — Guárdala</p>
                  <div
                    onClick={() => copyKey(createdWallet.secretKey)}
                    style={{ padding: '10px 12px', borderRadius: 12, background: '#FFF7ED', border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Copy size={12} color="var(--color-amber)" />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#B45309', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {createdWallet.secretKey}
                    </span>
                  </div>
                </div>
              </div>

              <button onClick={handleConfirmCreatedWallet} className="pollar-btn-primary">
                <CheckCircle2 size={16} /> Guardé mi clave — Vincular billetera
              </button>
              <button onClick={() => setCreatedWallet(null)} className="pollar-btn-secondary">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── IMPORT TAB ─── */}
      {activeTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 14, borderRadius: 18, background: 'var(--pollar-blue-light)', border: '1px solid rgba(0,98,255,0.2)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--pollar-blue)' }}>
              Puedes importar con la <strong>clave secreta (S...)</strong> para firmar transacciones, 
              o solo la <strong>clave pública (G...)</strong> para monitoreo (solo lectura).
            </p>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Nombre de la billetera
            </label>
            <input
              type="text"
              value={importName}
              onChange={e => setImportName(e.target.value)}
              placeholder="ej: Mi wallet Stellar"
              className="pollar-input"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Clave Stellar (G... o S...)
            </label>
            <textarea
              value={importInput}
              onChange={e => setImportInput(e.target.value)}
              placeholder="Pega tu clave pública (G...) o secreta (S...)"
              className="pollar-input"
              style={{ resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, height: 80 }}
            />
          </div>

          <button onClick={handleImport} className="pollar-btn-primary">
            <Link2 size={16} /> Vincular Billetera
          </button>
        </div>
      )}
    </div>
  );
}
