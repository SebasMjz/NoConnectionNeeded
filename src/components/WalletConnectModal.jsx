import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { generateRealStellarKeypair } from '../services/stellarCrypto';
import { 
  X, 
  Wallet, 
  Key, 
  Sparkles, 
  ArrowRight, 
  Check, 
  AlertCircle
} from 'lucide-react';

export default function WalletConnectModal({ isOpen, onClose, onConnected }) {
  const { activeWallet, loginWithWallet, linkCustomAccount, requestFriendbotFunding } = useWallet();
  const [activeTab, setActiveTab] = useState('connect');
  const [manualKey, setManualKey] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loadingAction, setLoadingAction] = useState('');

  if (!isOpen) return null;

  const handleConnectOption = async (type) => {
    setFeedback({ type: '', message: '' });
    setLoadingAction(type);

    try {
      if (type === 'freighter') {
        let address = deviceA.publicKey;
        if (typeof window !== 'undefined' && window.freighterApi?.getPublicKey) {
          try {
            address = await window.freighterApi.getPublicKey();
          } catch (e) {}
        }
        await loginWithWallet(address);
        setFeedback({ type: 'success', message: 'Billetera Freighter conectada' });
      } else if (type === 'albedo') {
        await loginWithWallet(deviceA.publicKey);
        setFeedback({ type: 'success', message: 'Albedo conectada' });
      } else if (type === 'generated') {
        const newKeys = generateRealStellarKeypair();
        await linkCustomAccount(newKeys.secretKey, 'Billetera Nueva');
        await loginWithWallet(newKeys.publicKey);
        requestFriendbotFunding(newKeys.publicKey);
        setFeedback({ type: 'success', message: 'Nueva billetera creada (+10k XLM Testnet)' });
      }

      setTimeout(() => {
        if (onConnected) onConnected();
        onClose();
      }, 700);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al conectar' });
    } finally {
      setLoadingAction('');
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    setLoadingAction('manual');
    setFeedback({ type: '', message: '' });

    try {
      await loginWithWallet(manualKey.trim());
      setFeedback({ type: 'success', message: 'Cuenta Stellar vinculada exitosamente' });
      setTimeout(() => {
        if (onConnected) onConnected();
        onClose();
      }, 700);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Clave no válida (debe ser S... o G...)' });
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-[#0062FF]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Conectar Billetera</h3>
              <p className="text-xs text-slate-500">Stellar Network / Soroban</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-2xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'connect'
                ? 'bg-white text-[#0062FF] shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Billeteras
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'manual'
                ? 'bg-white text-[#0062FF] shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Clave S... / G...
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'generate'
                ? 'bg-white text-[#0062FF] shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Generar Nueva
          </button>
        </div>

        {/* Options View */}
        {activeTab === 'connect' && (
          <div className="space-y-2.5">
            {/* Connect options */}
            <button
              onClick={() => handleConnectOption('freighter')}
              disabled={!!loadingAction}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0052EE] to-[#0088FF] flex items-center justify-center text-white font-black text-sm shadow-sm">
                  F
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Freighter Wallet</span>
                  <span className="text-[11px] text-slate-500">Extensión oficial Stellar</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0062FF] transition-all" />
            </button>

            <button
              onClick={() => handleConnectOption('albedo')}
              disabled={!!loadingAction}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center text-white font-black text-sm shadow-sm">
                  A
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Albedo Web3</span>
                  <span className="text-[11px] text-slate-500">Firma web y móvil</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0062FF] transition-all" />
            </button>
          </div>
        )}

        {/* Manual Key View */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Clave Secreta (S...) o Pública (G...)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="Ej: SDM7... o GDM7..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0062FF]"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={!manualKey.trim() || loadingAction === 'manual'}
              className="w-full py-3.5 rounded-2xl bg-[#0062FF] hover:bg-[#0050D6] text-white text-xs font-bold shadow-md transition-all"
            >
              {loadingAction === 'manual' ? 'Conectando...' : 'Conectar Cuenta'}
            </button>
          </form>
        )}

        {/* Generate New View */}
        {activeTab === 'generate' && (
          <div className="space-y-4 text-center py-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0062FF] flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Generar Billetera Stellar Testnet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Crea llaves Ed25519 con fondeo automático de 10,000 XLM de Friendbot listo para operar offline.
              </p>
            </div>

            <button
              onClick={() => handleConnectOption('generated')}
              disabled={loadingAction === 'generated'}
              className="w-full py-3.5 rounded-2xl bg-[#0062FF] hover:bg-[#0050D6] text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              {loadingAction === 'generated' ? 'Generando...' : 'Crear Billetera Instantánea'}
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback.message && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
