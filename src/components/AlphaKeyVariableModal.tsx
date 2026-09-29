import React, { useState, useEffect } from 'react';
import { X, Check, CornerDownLeft, Ban, Lock, RotateCcw } from 'lucide-react';

interface AlphaKeyVariableModalProps {
  isOpen: boolean;
  onClose: () => void;
  keySlot: string; // The slot id e.g. "PAREN_L", "PAREN_R", "1", "4", "SIN"
  keyDisplayLabel: string; // Human readable key name e.g. "(", ")", "1", "■/□"
  initialName: string; // Empty string if key is empty
  initialValue: number | string;
  isReserved?: boolean; // If true, X, Y, Z are locked system calculation variables
  onSave: (keySlot: string, newName: string, newValue: number) => void;
  onDelete: (keySlot: string, varName: string) => void;
  onInsert: (varName: string) => void;
}

export const AlphaKeyVariableModal: React.FC<AlphaKeyVariableModalProps> = ({
  isOpen,
  onClose,
  keySlot,
  keyDisplayLabel,
  initialName,
  initialValue,
  isReserved = false,
  onSave,
  onDelete,
  onInsert,
}) => {
  const isExistingVariable = Boolean(initialName && initialName.trim() !== '');
  const [varName, setVarName] = useState(initialName || '');
  const [varValueStr, setVarValueStr] = useState(
    initialValue !== undefined && initialValue !== null && initialValue !== 0
      ? String(initialValue)
      : ''
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVarName(initialName || '');
      setVarValueStr(
        initialValue !== undefined && initialValue !== null && initialValue !== 0
          ? String(initialValue)
          : ''
      );
      setError(null);
    }
  }, [isOpen, initialName, initialValue]);

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanName = isReserved ? initialName : varName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!cleanName) {
      setError('Por favor indica un nombre para la variable');
      return;
    }
    const valText = varValueStr.trim();
    const parsedNum = valText === '' ? 0 : parseFloat(valText);
    if (isNaN(parsedNum)) {
      setError('Por favor ingresa un valor numérico válido');
      return;
    }

    onSave(keySlot, cleanName, parsedNum);
    onClose();
  };

  const handleDeleteEmpty = () => {
    onDelete(keySlot, (initialName || varName).trim().toUpperCase());
    onClose();
  };

  const handleResetToZero = () => {
    onSave(keySlot, initialName, 0);
    onClose();
  };

  const handleInsertDirectly = () => {
    const cleanName = (isReserved ? initialName : (varName.trim().toUpperCase() || initialName.trim().toUpperCase()));
    if (cleanName) {
      onInsert(cleanName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-emerald-50/80">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-black text-xs flex items-center gap-1">
              {isReserved && <Lock className="w-3.5 h-3.5 text-emerald-700" />}
              {isReserved
                ? `RESERVADA [${initialName}]`
                : isExistingVariable
                ? `VAR [${initialName}]`
                : `TECLA [${keyDisplayLabel}]`}
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                {isReserved
                  ? `Variable Reservada ${initialName}`
                  : isExistingVariable
                  ? 'Editar Variable'
                  : 'Asignar Variable a Tecla'}
              </h3>
              <p className="text-[10.5px] text-slate-500">
                {isReserved
                  ? `Fija para cálculo diferencial (d/dx), integrales (∫dx) y álgebra`
                  : isExistingVariable
                  ? `Tecla [${keyDisplayLabel}]`
                  : `Tecla vacía [${keyDisplayLabel}]`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Nombre de la Variable */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span>Nombre de la Variable:</span>
              {isReserved && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Fija del sistema
                </span>
              )}
            </label>
            <input
              type="text"
              value={isReserved ? initialName : varName}
              readOnly={isReserved}
              disabled={isReserved}
              onChange={(e) => {
                if (!isReserved) {
                  setVarName(e.target.value);
                  setError(null);
                }
              }}
              placeholder=""
              className={`w-full px-3 py-2 border rounded-xl font-mono font-bold text-sm uppercase tracking-wider ${
                isReserved
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 cursor-not-allowed'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500'
              }`}
              autoFocus={!isReserved}
            />
          </div>

          {/* Valor de la Variable */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span>Valor Numérico:</span>
              {isReserved && (
                <span className="text-[10px] text-slate-400 font-normal">
                  (Opcional, en ∫dx se evalúa automáticamente)
                </span>
              )}
            </label>
            <input
              type="number"
              step="any"
              value={varValueStr}
              onChange={(e) => {
                setVarValueStr(e.target.value);
                setError(null);
              }}
              placeholder="0"
              autoFocus={isReserved}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{isReserved ? 'Guardar Valor' : isExistingVariable ? 'Guardar Cambios' : 'Crear Variable'}</span>
              </button>

              <button
                type="button"
                onClick={handleInsertDirectly}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <CornerDownLeft className="w-4 h-4" />
                <span>Insertar ({isReserved ? initialName : varName || initialName})</span>
              </button>
            </div>

            {/* Bottom button depending on reserved status */}
            {isReserved ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleResetToZero}
                  className="flex items-center justify-center gap-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  title="Restablece el valor de la variable a 0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Restablecer a 0</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>Cerrar</span>
                </button>
              </div>
            ) : isExistingVariable ? (
              <button
                type="button"
                onClick={handleDeleteEmpty}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                title="Borra la variable y deja esta tecla completamente vacía"
              >
                <Ban className="w-4 h-4 text-rose-600" />
                <span>Dejar Tecla Vacía</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <span>Cerrar (Mantener Vacía)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
