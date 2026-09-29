import React, { useState } from 'react';
import { X, Check, RotateCcw, HelpCircle, Trash2, Tag, Plus, Sparkles, Ban } from 'lucide-react';

interface ScientificVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: Record<string, number>;
  onSaveVariables: (vars: Record<string, number>) => void;
  lastAns: number;
  onInsertVariable?: (varName: string) => void;
  onClearAllKeyAlpha?: () => void;
}

export const SCIENTIFIC_DEFAULT_VARS = [
  'A', 'B', 'C', 'D', 'E', 'F',
  'M', 'X', 'Y', 'Z', 'IVA', 'TASA',
];

export const ScientificVariablesModal: React.FC<ScientificVariablesModalProps> = ({
  isOpen,
  onClose,
  variables,
  onSaveVariables,
  lastAns,
  onInsertVariable,
  onClearAllKeyAlpha,
}) => {
  const [localVars, setLocalVars] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    SCIENTIFIC_DEFAULT_VARS.forEach((k) => {
      initial[k] = (variables[k] ?? 0).toString();
    });
    Object.keys(variables).forEach((k) => {
      if (initial[k] === undefined) {
        initial[k] = (variables[k] ?? 0).toString();
      }
    });
    return initial;
  });

  const [customVarName, setCustomVarName] = useState('');
  const [customVarVal, setCustomVarVal] = useState('');
  const [savedStatus, setSavedStatus] = useState(false);

  if (!isOpen) return null;

  const handleChange = (key: string, val: string) => {
    setLocalVars((prev) => ({ ...prev, [key]: val }));
  };

  const handleClearSingle = (key: string) => {
    setLocalVars((prev) => ({ ...prev, [key]: '0' }));
    const parsed: Record<string, number> = {};
    Object.keys(localVars).forEach((k) => {
      if (k === key) {
        parsed[k] = 0;
      } else {
        const num = parseFloat(localVars[k] || '0');
        parsed[k] = isNaN(num) ? 0 : num;
      }
    });
    onSaveVariables(parsed);
  };

  const handleDeleteCustom = (key: string) => {
    setLocalVars((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    const parsed: Record<string, number> = {};
    Object.keys(localVars).forEach((k) => {
      if (k !== key) {
        const num = parseFloat(localVars[k] || '0');
        parsed[k] = isNaN(num) ? 0 : num;
      }
    });
    onSaveVariables(parsed);
  };

  const handleSetToAns = (key: string) => {
    setLocalVars((prev) => ({ ...prev, [key]: lastAns.toString() }));
  };

  const handleSave = () => {
    const parsed: Record<string, number> = {};
    Object.keys(localVars).forEach((k) => {
      const num = parseFloat(localVars[k] || '0');
      parsed[k] = isNaN(num) ? 0 : num;
    });
    onSaveVariables(parsed);
    setSavedStatus(true);
    setTimeout(() => {
      setSavedStatus(false);
      onClose();
    }, 350);
  };

  const handleResetAll = () => {
    const reset: Record<string, string> = {};
    Object.keys(localVars).forEach((k) => {
      reset[k] = '0';
    });
    setLocalVars(reset);
    const parsed: Record<string, number> = {};
    Object.keys(localVars).forEach((k) => {
      parsed[k] = 0;
    });
    onSaveVariables(parsed);
  };

  const handleClearAllKeysWipe = () => {
    handleResetAll();
    if (onClearAllKeyAlpha) {
      onClearAllKeyAlpha();
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = customVarName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanVal = customVarVal.trim();
    if (!cleanName || !cleanVal) return;

    setLocalVars((prev) => ({ ...prev, [cleanName]: cleanVal }));
    const parsed: Record<string, number> = {};
    Object.keys(localVars).forEach((k) => {
      const num = parseFloat(localVars[k] || '0');
      parsed[k] = isNaN(num) ? 0 : num;
    });
    const customNum = parseFloat(cleanVal);
    parsed[cleanName] = isNaN(customNum) ? 0 : customNum;
    onSaveVariables(parsed);

    setCustomVarName('');
    setCustomVarVal('');
  };

  const allKeys = Array.from(new Set([...SCIENTIFIC_DEFAULT_VARS, ...Object.keys(localVars)]));
  const activeKeys = allKeys.filter((k) => parseFloat(localVars[k] || '0') !== 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header - Blue/Indigo theme */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                Variables Científicas & Personalizadas
              </h3>
              <p className="text-[11px] text-slate-500">
                Define el nombre y valor de tus variables (ej. X, IVA, TASA)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3.5">
          {/* Form to create / assign ANY custom variable (Nombre + Valor) */}
          <form
            onSubmit={handleAddCustom}
            className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Crear / Asignar Variable (Nombre y Valor)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-36 min-w-[100px]">
                <input
                  type="text"
                  value={customVarName}
                  onChange={(e) => setCustomVarName(e.target.value.toUpperCase())}
                  placeholder="Nombre (ej. IVA, TASA, R)"
                  className="w-full bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
              <span className="text-sm font-black text-blue-700">=</span>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={customVarVal}
                  onChange={(e) => setCustomVarVal(e.target.value)}
                  placeholder="Valor (ej. 1.16, 54.5)"
                  className="w-full bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
              <button
                type="submit"
                disabled={!customVarName.trim() || !customVarVal.trim()}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1 shrink-0 shadow-2xs active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Asignar
              </button>
            </div>
          </form>

          {/* Header Action: Vaciar Teclas / Total */}
          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">
              Variables Registradas ({allKeys.length}) — Activas: {activeKeys.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetAll}
                className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200 transition-colors"
                title="Pone todas las variables a 0"
              >
                <RotateCcw className="w-3 h-3" /> Poner en 0
              </button>
              {onClearAllKeyAlpha && (
                <button
                  type="button"
                  onClick={handleClearAllKeysWipe}
                  className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer font-bold bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-md border border-rose-300 transition-colors shadow-2xs"
                  title="Elimina las letras de todas las teclas y deja el teclado completamente vacío"
                >
                  <Ban className="w-3 h-3" /> Vaciar Teclas
                </button>
              )}
            </div>
          </div>

          {/* Grid of Variables */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allKeys.map((k) => {
              const val = localVars[k] || '0';
              const isNonZero = parseFloat(val) !== 0;
              const isDefault = SCIENTIFIC_DEFAULT_VARS.includes(k);

              return (
                <div
                  key={k}
                  className={`flex items-center gap-1.5 p-1.5 rounded-xl border transition-all ${
                    isNonZero
                      ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onInsertVariable) {
                        onInsertVariable(k);
                        onClose();
                      }
                    }}
                    className="h-6 px-1.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-300 font-mono font-black text-xs flex items-center justify-center shrink-0 cursor-pointer shadow-2xs active:scale-95"
                    title={`Escribir variable ${k} en la fórmula`}
                  >
                    {k}
                  </button>
                  <span className="text-xs font-bold text-slate-400">=</span>
                  <input
                    type="text"
                    value={localVars[k] === '0' ? '' : localVars[k]}
                    onChange={(e) => handleChange(k, e.target.value)}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono font-bold text-xs text-slate-900 outline-none"
                  />
                  {isNonZero ? (
                    <button
                      type="button"
                      onClick={() => (isDefault ? handleClearSingle(k) : handleDeleteCustom(k))}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                      title={`Vaciar o eliminar variable ${k}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : lastAns !== 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSetToAns(k)}
                      className="px-1 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[9px] shrink-0 cursor-pointer border border-emerald-200"
                      title={`Asignar Ans (${lastAns}) a ${k}`}
                    >
                      Ans
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-start gap-1.5">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              En las fórmulas se escribe el nombre de la variable (ej. <strong className="font-mono text-blue-900">X</strong> o <strong className="font-mono text-blue-900">IVA</strong>). Al pulsar <strong className="font-bold text-slate-900">=</strong>, la calculadora sustituye su valor asignado y evalúa el cálculo en tiempo real.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Poner en 0
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {savedStatus ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{savedStatus ? '¡Guardado!' : 'Guardar Variables'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
