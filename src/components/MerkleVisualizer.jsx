import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { pollarEngine } from '../services/pollarEngine';
import { 
  GitBranch, 
  Binary, 
  ShieldCheck, 
  Copy, 
  Check, 
  Search, 
  Sparkles, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Cpu 
} from 'lucide-react';

export default function MerkleVisualizer() {
  const { merkleTree, transactions } = useWallet();
  const [selectedTxIndex, setSelectedTxIndex] = useState(0);
  const [auditProof, setAuditProof] = useState(null);
  const [isProofValid, setIsProofValid] = useState(null);
  const [copiedRoot, setCopiedRoot] = useState(false);

  const handleInspectProof = async (index) => {
    setSelectedTxIndex(index);
    if (transactions.length > 0 && index < transactions.length) {
      try {
        const proof = await pollarEngine.generateMerkleProof(transactions, index);
        const valid = await pollarEngine.verifyMerkleProof(proof);
        setAuditProof(proof);
        setIsProofValid(valid);
      } catch (err) {
        console.error('Error generating proof:', err);
      }
    }
  };

  const copyRootHash = () => {
    navigator.clipboard.writeText(merkleTree.rootHash);
    setCopiedRoot(true);
    setTimeout(() => setCopiedRoot(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Root Hash & Merkle Anchor Card */}
      <div className="glass-panel-glow p-6 bg-gradient-to-r from-[rgba(16,21,34,0.95)] to-[rgba(10,14,24,0.98)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#a855f7] flex items-center gap-1.5">
                <GitBranch className="w-4 h-4" /> Árbol de Merkle Criptográfico
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(168,85,247,0.15)] text-[#a855f7] font-semibold border border-[rgba(168,85,247,0.3)]">
                Prevención de Colisión de Secuencia
              </span>
            </div>
            <h2 className="text-xl font-black text-white">Ancla de Integridad de Transacciones Offline</h2>
            <p className="text-xs text-[#94a3b8] max-w-2xl">
              Cada pago fuera de línea se añade como una hoja (leaf). El árbol recalcula la raíz de forma determinista para garantizar que ninguna transacción sea duplicada, omitida o alterada al conectarse a Stellar.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.08)] flex flex-col justify-center space-y-1.5 min-w-[280px]">
            <span className="text-[11px] font-mono font-semibold text-[#94a3b8] uppercase">Merkle Root Hash (SHA-256):</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-[#00f2fe] font-bold truncate">
                {merkleTree.rootHash}
              </span>
              <button
                onClick={copyRootHash}
                className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-[#94a3b8] hover:text-white transition-all shrink-0"
                title="Copiar Hash Raíz"
              >
                {copiedRoot ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Merkle Visual Graph & Proof Explorer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Visual Tree Graph (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Binary className="w-4 h-4 text-[#00f2fe]" /> Estructura del Árbol en Tiempo Real ({transactions.length} transacciones)
            </h3>
            <span className="text-xs text-[#94a3b8]">Niveles: {merkleTree.levels.length}</span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-10 rounded-xl bg-[rgba(10,14,24,0.5)] border border-dashed border-[rgba(255,255,255,0.1)] text-center space-y-2">
              <GitBranch className="w-8 h-8 text-[#64748b] mx-auto opacity-50" />
              <p className="text-xs font-semibold text-white">El Árbol de Merkle está esperando transacciones</p>
              <p className="text-[11px] text-[#94a3b8]">
                Realiza un pago offline en la pestaña "Terminal P2P" para ver cómo se generan las hojas y se calcula la raíz.
              </p>
            </div>
          ) : (
            <div className="space-y-6 overflow-x-auto py-2">
              
              {/* Level 0: Root Node */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono uppercase text-[#a855f7] font-bold mb-1">Nivel Raíz (Merkle Root)</span>
                <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[rgba(168,85,247,0.2)] to-[rgba(0,242,254,0.2)] border border-[rgba(168,85,247,0.5)] shadow-[0_0_15px_rgba(168,85,247,0.3)] text-center">
                  <div className="text-xs font-mono font-bold text-white truncate max-w-xs">
                    {merkleTree.rootHash.substring(0, 20)}...
                  </div>
                  <div className="text-[9px] text-[#00f2fe] font-semibold">Ancla Stellar Memo</div>
                </div>
              </div>

              {/* Intermediate Levels if any */}
              {merkleTree.levels.length > 2 && (
                <div className="flex justify-around gap-4">
                  {merkleTree.levels[merkleTree.levels.length - 2].map((node, i) => (
                    <div key={i} className="p-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-center min-w-[120px]">
                      <span className="text-[9px] font-mono text-[#94a3b8] block">Rama #{i}</span>
                      <span className="text-[10px] font-mono text-white font-semibold truncate block">
                        {node.hash.substring(0, 10)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Leaves Level */}
              <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-[10px] font-mono uppercase text-[#10b981] font-bold block">
                  Hojas Criptográficas (Merkle Leaves - Transacciones):
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {transactions.map((tx, idx) => (
                    <button
                      key={tx.txHash || idx}
                      onClick={() => handleInspectProof(idx)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedTxIndex === idx
                          ? 'bg-[rgba(0,242,254,0.12)] border-[rgba(0,242,254,0.5)] shadow-[0_0_12px_rgba(0,242,254,0.2)]'
                          : 'bg-[rgba(10,14,24,0.8)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.2)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-bold text-white">Hoja #{idx} (Nonce {tx.payload.nonce})</span>
                        <span className="font-mono text-xs font-bold text-[#00f2fe]">{tx.payload.amount.toFixed(2)} {tx.payload.asset}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#94a3b8] truncate">
                        Leaf: {tx.merkleLeafHash ? tx.merkleLeafHash.substring(0, 16) : tx.txHash.substring(0, 16)}...
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-[rgba(255,255,255,0.04)] text-[9px] text-[#64748b]">
                        <span>{tx.payload.memo || 'Sin concepto'}</span>
                        <span className="text-[#10b981] font-semibold">Doble Firma ✓</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Proof Inspector & Cryptographic Verification (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10b981]" /> Auditoría de Prueba de Inclusión (Audit Proof)
              </h3>
              {isProofValid !== null && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isProofValid 
                    ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981] border border-[rgba(16,185,129,0.4)]' 
                    : 'bg-[rgba(244,63,94,0.2)] text-[#f43f5e] border border-[rgba(244,63,94,0.4)]'
                }`}>
                  {isProofValid ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {isProofValid ? 'Prueba Válida' : 'Prueba Inválida'}
                </span>
              )}
            </div>

            {transactions.length > 0 && auditProof ? (
              <div className="mt-4 space-y-3.5">
                <div className="p-3 rounded-xl bg-[rgba(10,14,24,0.8)] border border-[rgba(255,255,255,0.08)] space-y-1">
                  <span className="text-[10px] font-mono text-[#94a3b8] uppercase block">Transacción Auditada:</span>
                  <div className="text-xs font-mono font-bold text-white">Hoja #{auditProof.targetIndex} - TxHash:</div>
                  <div className="text-[11px] font-mono text-[#00f2fe] truncate">{auditProof.txHash}</div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#94a3b8] uppercase block">Pasos de Prueba Criptográfica (Sibling Hashes):</span>
                  {auditProof.steps.map((step, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(0,242,254,0.15)] text-[#00f2fe] text-[9px] font-mono font-bold">
                          {step.position.toUpperCase()}
                        </span>
                        <span className="font-mono text-[11px] text-[#94a3b8] truncate max-w-[160px]">
                          {step.hash.substring(0, 16)}...
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748b]" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 p-6 rounded-xl bg-[rgba(10,14,24,0.6)] border border-dashed border-[rgba(255,255,255,0.08)] text-center text-xs text-[#94a3b8]">
                Selecciona una transacción en el panel izquierdo para calcular y verificar su prueba de inclusión matemática.
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[rgba(121,40,202,0.1)] border border-[rgba(121,40,202,0.25)] text-xs text-[#94a3b8] flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-[#a855f7] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Motor Go Wasm:</strong> El Árbol de Merkle permite que el dispositivo suba un lote entero de transacciones empaquetadas o una sola prueba sin riesgo de desfase en el <code className="text-[#00f2fe]">sequenceNumber</code> de la cuenta Stellar.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
