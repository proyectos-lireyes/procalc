import React from 'react';
import {
  X,
  RotateCcw,
  Trash2,
  FolderArchive,
  FileSpreadsheet,
  Calendar,
  Check,
} from 'lucide-react';
import { Sheet, AppSettings, Currency } from '../types';
import { CURRENCY_CONFIG, formatNumber } from '../utils/currency';

interface ClosedSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  closedSheets: Sheet[];
  onReopenSheet: (sheetId: string) => void;
  onPermanentDeleteSheet: (sheetId: string) => void;
  onClearAllClosed: () => void;
  settings: AppSettings;
}

export const ClosedSheetsModal: React.FC<ClosedSheetsModalProps> = ({
  isOpen,
  onClose,
  closedSheets,
  onReopenSheet,
  onPermanentDeleteSheet,
  onClearAllClosed,
  settings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        id="closed-sheets-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col my-auto text-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <FolderArchive className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Cuentas Cerradas</h3>
              <p className="text-[11px] text-slate-500">
                Historial de cuentas archivadas que puedes reabrir en cualquier momento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {closedSheets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <FolderArchive className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-slate-600">No hay cuentas cerradas.</p>
              <p className="text-slate-400 text-[11px] mt-1">
                Cuando cierres una cuenta desde la hoja de cálculo, se guardará aquí para que puedas reabrirla cuando quieras.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>{closedSheets.length} {closedSheets.length === 1 ? 'cuenta cerrada' : 'cuentas cerradas'}</span>
                <button
                  onClick={onClearAllClosed}
                  className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer text-[11px]"
                >
                  Vaciar todas
                </button>
              </div>

              {closedSheets.map((s) => (
                <div
                  key={s.id}
                  className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded bg-white border border-slate-200 text-blue-600 shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {s.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{s.rows.length} {s.rows.length === 1 ? 'fila' : 'filas'}</span>
                        <span>•</span>
                        <span>
                          {new Date(s.updatedAt || s.createdAt).toLocaleDateString()} {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onReopenSheet(s.id);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title="Reabrir cuenta"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reabrir</span>
                    </button>

                    <button
                      onClick={() => onPermanentDeleteSheet(s.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
