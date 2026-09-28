import React from 'react';
import { X, Info, Check } from 'lucide-react';

export interface FunctionHelpInfo {
  title: string;
  badge?: string;
  icon: React.ReactNode;
  description: string;
  tips?: string[];
}

interface FunctionInfoModalProps {
  info: FunctionHelpInfo | null;
  onClose: () => void;
}

export const FunctionInfoModal: React.FC<FunctionInfoModalProps> = ({ info, onClose }) => {
  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-4 sm:p-5 flex flex-col gap-3.5 transform transition-all select-none"
      >
        {/* Header with Icon, Title and Close */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs shrink-0">
              {info.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight">
                  {info.title}
                </h3>
                {info.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {info.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-400">Guía de función</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description Body */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs sm:text-[13px] text-slate-600 leading-relaxed">
          {info.description}
        </div>

        {/* Optional tips or details */}
        {info.tips && info.tips.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Detalles clave:
            </span>
            <ul className="space-y-1">
              {info.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer with Entendido button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>Entendido</span>
        </button>
      </div>
    </div>
  );
};
