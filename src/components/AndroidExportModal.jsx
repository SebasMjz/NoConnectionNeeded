import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Copy,
  Check,
  Cpu,
  Layers,
  Terminal,
  FolderDown
} from 'lucide-react';

export default function AndroidExportModal({ isOpen, onClose }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!isOpen) return null;

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      icon: Cpu,
      title: 'Compilar Core Go → Android (.aar)',
      code: `cd core-go\ngomobile bind -target=android -o ../android/pollarcore/pollarcore.aar ./pkg/pollarcore`
    },
    {
      icon: Layers,
      title: 'Build Web (Vite + WASM)',
      code: `npm run build`
    },
    {
      icon: FolderDown,
      title: 'Sincronizar con Capacitor',
      code: `npx cap sync android`
    },
    {
      icon: Terminal,
      title: 'Abrir Android Studio',
      code: `npx cap open android`
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg max-h-[85vh] bg-[#0a0e18] border border-[rgba(0,242,254,0.2)] rounded-t-2xl sm:rounded-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0e18] border-b border-[rgba(255,255,255,0.06)] px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[rgba(0,242,254,0.12)] text-[#00f2fe]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Exportar a Android</h2>
              <p className="text-[10px] text-[#94a3b8]">GoMobile + Capacitor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[#94a3b8] hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-3">
          {steps.map((step, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-[rgba(16,21,34,0.8)] border border-[rgba(255,255,255,0.06)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[rgba(0,242,254,0.15)] flex items-center justify-center text-[10px] font-black text-[#00f2fe]">
                    {idx + 1}
                  </div>
                  <span className="text-xs font-bold text-white">{step.title}</span>
                </div>
                <button
                  onClick={() => copyCode(step.code, idx)}
                  className="flex items-center gap-1 text-[10px] text-[#00f2fe] hover:underline"
                >
                  {copiedIndex === idx ? (
                    <><Check className="w-3 h-3 text-[#10b981]" /> Listo</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copiar</>
                  )}
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-[rgba(0,0,0,0.5)] text-[#00f2fe] font-mono text-[10px] overflow-x-auto border border-[rgba(255,255,255,0.04)] whitespace-pre-wrap">
                {step.code}
              </pre>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0a0e18] border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
          <button
            onClick={onClose}
            className="w-full btn-primary py-2.5 text-xs font-bold"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
