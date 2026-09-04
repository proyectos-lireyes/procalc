import React from 'react';
import { X, History, Trash2, Copy, Check, Clock, FileSpreadsheet } from 'lucide-react';
import { HistoryItem, Currency } from '../types';
import { CURRENCY_CONFIG, formatCurrency } from '../utils/currency';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopySummary = (item: HistoryItem) => {
    const text = `📊 Resumen de Cálculo: ${item.sheetTitle} (${new Date(item.timestamp).toLocaleString('es-VE')})
• $: ${formatCurrency(item.summaryInCurrencies.USD, 'USD')}
• EUR: ${formatCurrency(item.summaryInCurrencies.EUR, 'EUR')}
• USDT: ${formatCurrency(item.summaryInCurrencies.USDT, 'USDT')}
• Bs: ${formatCurrency(item.summaryInCurrencies.VES, 'VES')}`;

    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="history-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-800 max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <History className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Historial de Conversiones & Totales</h3>
              <p className="text-xs text-slate-500">
                Registro cronológico de cálculos y cierres de cuenta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
              <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              No hay conversiones registradas en el historial.
              <p className="mt-1 text-[11px] text-slate-400">
                Al editar la tabla o generar un balance, se registrará aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                        {item.sheetTitle}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        • {item.rowsCount} {item.rowsCount === 1 ? 'registro' : 'registros'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.timestamp).toLocaleString('es-VE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                      <button
                        onClick={() => handleCopySummary(item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                        title="Copiar resumen"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Multi-currency breakdown pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                    {(['USD', 'EUR', 'USDT', 'VES'] as Currency[]).map((curr) => {
                      const cfg = CURRENCY_CONFIG[curr];
                      const val = item.summaryInCurrencies[curr] || 0;
                      return (
                        <div
                          key={curr}
                          className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 flex flex-col shadow-2xs"
                        >
                          <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1 font-semibold">
                            <span>{cfg.flag}</span> <span className="font-mono font-bold text-slate-800">{cfg.name}</span>
                          </span>
                          <span
                            className={`font-bold truncate ${
                              val < 0
                                ? 'text-rose-600'
                                : curr === 'VES'
                                ? 'text-emerald-600'
                                : curr === 'USD'
                                ? 'text-blue-700'
                                : curr === 'EUR'
                                ? 'text-slate-800'
                                : 'text-orange-700'
                            }`}
                          >
                            {formatCurrency(val, curr)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClearHistory}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar Historial
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
