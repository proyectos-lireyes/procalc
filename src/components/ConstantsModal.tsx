import React, { useState, useMemo } from 'react';
import { X, Search, Check, Copy, CornerDownLeft, Sparkles, Atom } from 'lucide-react';

interface ConstantItem {
  id: string;
  name: string;
  symbol: string;
  value: number;
  valueStr: string;
  unit: string;
  category: 'universal' | 'electromagnetic' | 'atomic' | 'physicochemical';
}

export const SCIENTIFIC_CONSTANTS: ConstantItem[] = [
  // Universal
  {
    id: 'c',
    name: 'Velocidad de la luz en el vacío',
    symbol: 'c',
    value: 299792458,
    valueStr: '299792458',
    unit: 'm/s',
    category: 'universal',
  },
  {
    id: 'h',
    name: 'Constante de Planck',
    symbol: 'h',
    value: 6.62607015e-34,
    valueStr: '6.62607015e-34',
    unit: 'J·s',
    category: 'universal',
  },
  {
    id: 'hbar',
    name: 'Constante reducida de Planck (ħ)',
    symbol: 'ħ',
    value: 1.054571817e-34,
    valueStr: '1.054571817e-34',
    unit: 'J·s',
    category: 'universal',
  },
  {
    id: 'G',
    name: 'Constante de gravitación universal',
    symbol: 'G',
    value: 6.6743e-11,
    valueStr: '6.6743e-11',
    unit: 'N·m²/kg²',
    category: 'universal',
  },
  {
    id: 'g',
    name: 'Aceleración de gravedad estándar',
    symbol: 'g',
    value: 9.80665,
    valueStr: '9.80665',
    unit: 'm/s²',
    category: 'universal',
  },

  // Electromagnética
  {
    id: 'e',
    name: 'Carga elemental del electrón',
    symbol: 'e',
    value: 1.602176634e-19,
    valueStr: '1.602176634e-19',
    unit: 'C',
    category: 'electromagnetic',
  },
  {
    id: 'eps0',
    name: 'Permitividad eléctrica del vacío (ε₀)',
    symbol: 'ε₀',
    value: 8.8541878128e-12,
    valueStr: '8.8541878128e-12',
    unit: 'F/m',
    category: 'electromagnetic',
  },
  {
    id: 'mu0',
    name: 'Permeabilidad magnética del vacío (μ₀)',
    symbol: 'μ₀',
    value: 1.25663706212e-6,
    valueStr: '1.25663706212e-6',
    unit: 'N/A²',
    category: 'electromagnetic',
  },

  // Atómica y Nuclear
  {
    id: 'me',
    name: 'Masa del electrón en reposo',
    symbol: 'mₑ',
    value: 9.1093837015e-31,
    valueStr: '9.1093837015e-31',
    unit: 'kg',
    category: 'atomic',
  },
  {
    id: 'mp',
    name: 'Masa del protón en reposo',
    symbol: 'mₚ',
    value: 1.672621898e-27,
    valueStr: '1.672621898e-27',
    unit: 'kg',
    category: 'atomic',
  },
  {
    id: 'mn',
    name: 'Masa del neutrón en reposo',
    symbol: 'mₙ',
    value: 1.674927471e-27,
    valueStr: '1.674927471e-27',
    unit: 'kg',
    category: 'atomic',
  },

  // Fisicoquímica
  {
    id: 'na',
    name: 'Número de Avogadro',
    symbol: 'N_A',
    value: 6.02214076e23,
    valueStr: '6.02214076e23',
    unit: 'mol⁻¹',
    category: 'physicochemical',
  },
  {
    id: 'kb',
    name: 'Constante de Boltzmann',
    symbol: 'k_B',
    value: 1.380649e-23,
    valueStr: '1.380649e-23',
    unit: 'J/K',
    category: 'physicochemical',
  },
  {
    id: 'R',
    name: 'Constante universal de los gases ideales',
    symbol: 'R',
    value: 8.314462618,
    valueStr: '8.314462618',
    unit: 'J/(mol·K)',
    category: 'physicochemical',
  },
  {
    id: 'atm',
    name: 'Presión atmosférica estándar',
    symbol: 'atm',
    value: 101325,
    valueStr: '101325',
    unit: 'Pa',
    category: 'physicochemical',
  },
];

interface ConstantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConstant: (valueStr: string) => void;
}

export const ConstantsModal: React.FC<ConstantsModalProps> = ({
  isOpen,
  onClose,
  onSelectConstant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return SCIENTIFIC_CONSTANTS.filter((c) => {
      const matchCat = activeCategory === 'all' || c.category === activeCategory;
      const matchText =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchText;
    });
  }, [searchTerm, activeCategory]);

  if (!isOpen) return null;

  const handleCopy = (c: ConstantItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(c.valueStr);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden text-slate-800 animate-scale-up">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
              <Atom className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-sm text-slate-900">
              Constantes Científicas (CONST)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="p-3 border-b border-slate-100 bg-white flex flex-col gap-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre o símbolo (ej. c, Planck, Avogadro)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px] font-bold">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'universal', label: 'Universales' },
              { id: 'electromagnetic', label: 'Electromagnéticas' },
              { id: 'atomic', label: 'Atómicas' },
              { id: 'physicochemical', label: 'Fisicoquímica' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg shrink-0 cursor-pointer transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-amber-100 text-amber-900 font-extrabold border border-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 bg-slate-50/50">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No se encontraron constantes</p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectConstant(item.valueStr);
                  onClose();
                }}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-indigo-900 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-slate-200">
                    {item.symbol}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 truncate">
                      {item.valueStr} [{item.unit}]
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={(e) => handleCopy(item, e)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Copiar valor"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    Insertar
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
