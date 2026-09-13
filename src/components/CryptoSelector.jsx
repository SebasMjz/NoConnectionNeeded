import React, { useState } from 'react';
import { ChevronDown, Check, Coins, Sparkles, ExternalLink, X } from 'lucide-react';
import { isMainnet } from '../services/stellarCrypto';

export const SUPPORTED_ASSETS = [
  {
    code: 'XLM',
    name: 'Stellar Lumens',
    isNative: true,
    color: '#0062FF',
    bgColor: 'rgba(0, 98, 255, 0.1)',
    symbol: 'XLM',
    decimals: 7,
    description: 'Moneda nativa de la red Stellar'
  },
  {
    code: 'USDC',
    name: 'USD Coin',
    isNative: false,
    color: '#2775CA',
    bgColor: 'rgba(39, 117, 202, 0.1)',
    symbol: 'USDC',
    decimals: 7,
    description: 'Dólar digital respaldado 1:1'
  },
  {
    code: 'USDT',
    name: 'Tether USD',
    isNative: false,
    color: '#26A17B',
    bgColor: 'rgba(38, 161, 123, 0.1)',
    symbol: 'USDT',
    decimals: 7,
    description: 'Stablecoin en red Stellar'
  }
];

export default function CryptoSelector({
  selectedAsset = 'XLM',
  onSelectAsset,
  balances = [],
  compact = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Find balance from real balances array
  const getAssetBalance = (code) => {
    if (!balances || balances.length === 0) return 0.0;
    const item = balances.find(b => b.asset === code || (code === 'XLM' && b.isNative));
    return item ? item.balance : 0.0;
  };

  // Merge predefined assets with any custom tokens found on-chain
  const allAssets = [...SUPPORTED_ASSETS];
  if (Array.isArray(balances)) {
    balances.forEach(b => {
      const code = b.isNative ? 'XLM' : b.asset;
      if (!allAssets.some(a => a.code === code)) {
        allAssets.push({
          code: code,
          name: code,
          isNative: b.isNative,
          color: '#7c3aed',
          bgColor: 'rgba(124, 58, 237, 0.1)',
          symbol: code,
          decimals: 7,
          issuer: b.issuer,
          description: `Token emitido (${b.issuer ? b.issuer.slice(0, 4) + '...' + b.issuer.slice(-4) : 'Stellar'})`
        });
      }
    });
  }

  const current = allAssets.find(a => a.code === selectedAsset) || allAssets[0];
  const currentBalance = getAssetBalance(current.code);

  const handleSelect = (assetCode) => {
    if (onSelectAsset) {
      onSelectAsset(assetCode);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="pollar-crypto-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '5px 10px' : '8px 14px',
          borderRadius: 20,
          background: '#ffffff',
          border: '1.5px solid rgba(0, 98, 255, 0.18)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.18s ease',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div
          style={{
            width: compact ? 20 : 24,
            height: compact ? 20 : 24,
            borderRadius: '50%',
            background: current.bgColor,
            color: current.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 10 : 12,
            fontWeight: 900
          }}
        >
          {current.code.slice(0, 1)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
          <span style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: 'var(--text-main)' }}>
            {current.code}
          </span>
          {!compact && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
              {currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
          )}
        </div>

        <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />
      </button>

      {/* Selector Modal / Bottom Sheet */}
      {isOpen && (
        <div
          className="pollar-modal-overlay"
          onClick={() => setIsOpen(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="pollar-modal-sheet"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 440, padding: 24 }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--pollar-blue-light)', color: 'var(--pollar-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coins size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>Seleccionar Criptomoneda</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldos on-chain legítimos en Stellar {isMainnet ? 'Mainnet' : 'Testnet'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Assets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allAssets.map(asset => {
                const bal = getAssetBalance(asset.code);
                const isSelected = asset.code === selectedAsset;

                return (
                  <button
                    key={asset.code}
                    type="button"
                    onClick={() => handleSelect(asset.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: isSelected ? 'rgba(0, 98, 255, 0.06)' : '#ffffff',
                      border: isSelected ? '2px solid var(--pollar-blue)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: asset.bgColor,
                          color: asset.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 900,
                          flexShrink: 0
                        }}
                      >
                        {asset.code.slice(0, 2)}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-main)' }}>
                            {asset.name}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}>
                            {asset.code}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {asset.description}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: bal > 0 ? 'var(--color-emerald)' : 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        {bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                      {isSelected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--pollar-blue)', fontSize: 11, fontWeight: 800 }}>
                          <Check size={12} /> Activo
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-light)' }}>
                          {asset.isNative ? 'On-Chain' : (bal > 0 ? 'Con Trustline' : 'Sin saldo')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Informative Footer */}
            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--bg-card-muted)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              💡 <strong>XLM</strong> es la criptomoneda base de Stellar. Los tokens (USDC, USDT) se reflejan automáticamente cuando tu cuenta los recibe o crea una línea de confianza.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
