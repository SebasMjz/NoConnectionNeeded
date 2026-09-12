import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { Sparkles, UserCheck, Store, Zap, X, Check, ChevronUp, RotateCcw } from 'lucide-react';

export default function FloatingDemoHelper({ onFillEmail, onSelectWallet }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedNote, setCopiedNote] = useState('');
  const { deviceA, loginAsPreset, requestFriendbotFunding, resetDemoData } = useWallet();

  const handleQuickPreset = (type) => {
    loginAsPreset(type);
    setCopiedNote(`${type === 'pagador' ? 'Pagador (A)' : 'Comercio (B)'} conectado`);
    setTimeout(() => { setCopiedNote(''); setIsOpen(false); }, 1500);
  };

  return (
    <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      {copiedNote && (
        <div className="mb-2 px-3.5 py-2 rounded-2xl text-xs font-bold shadow-lg animate-bounce flex items-center gap-1.5 bg-[#0062FF] text-white">
          <Check className="w-4 h-4" /> {copiedNote}
        </div>
      )}

      {isOpen && (
        <div className="mb-3 w-76 rounded-3xl p-4 shadow-2xl space-y-3 bg-white border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-50 text-[#0062FF]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Acceso Rápido Demo</span>
                <span className="text-[10px] text-slate-400">Autocompletar sesión</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <button 
              onClick={() => handleQuickPreset('pagador')} 
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-50 border border-blue-100 transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#0062FF] text-white flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Pagador A</span>
                  <span className="text-[10px] text-slate-500 font-mono">pagador@pollar.io</span>
                </div>
              </div>
              <span className="text-xs font-bold text-[#0062FF]">Entrar</span>
            </button>

            <button 
              onClick={() => handleQuickPreset('comercio')} 
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  B
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Comercio POS B</span>
                  <span className="text-[10px] text-slate-500 font-mono">pos.tienda@pollar.io</span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600">Entrar</span>
            </button>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => requestFriendbotFunding(deviceA.publicKey)}
              className="flex-1 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold flex items-center justify-center gap-1 transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" /> +10k XLM
            </button>
            <button
              onClick={() => resetDemoData()}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 transition-all"
              title="Reiniciar Demo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-[#0052EE] to-[#0070F3] text-white font-bold text-xs shadow-[0_8px_25px_rgba(0,98,255,0.4)] hover:shadow-[0_10px_30px_rgba(0,98,255,0.55)] active:scale-95 transition-all"
      >
        <Sparkles className="w-4 h-4 text-white" />
        <span>Demo 1-Click</span>
        <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
