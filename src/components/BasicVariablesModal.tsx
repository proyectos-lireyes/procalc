import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Tag,
  Check,
  HelpCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

export interface BasicVariable {
  id: string;
  name: string;
  valueExpression: string; // e.g., "1.16", "0.16", "54.5"
  keyShortcut?: string; // e.g., "%", "+", "7", "8"
  description?: string;
}

interface BasicVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: BasicVariable[];
  onSaveVariables: (vars: BasicVariable[]) => void;
  onInsertVariable?: (varName: string) => void;
}

const AVAILABLE_KEYS = [
  { key: '%', label: 'Tecla %' },
  { key: '+', label: 'Tecla +' },
  { key: '-', label: 'Tecla -' },
  { key: '*', label: 'Tecla ×' },
  { key: '/', label: 'Tecla ÷' },
  { key: 'Ans', label: 'Tecla Ans' },
  { key: '7', label: 'Tecla 7' },
  { key: '8', label: 'Tecla 8' },
  { key: '9', label: 'Tecla 9' },
  { key: '4', label: 'Tecla 4' },
  { key: '5', label: 'Tecla 5' },
  { key: '6', label: 'Tecla 6' },
  { key: '1', label: 'Tecla 1' },
  { key: '2', label: 'Tecla 2' },
  { key: '3', label: 'Tecla 3' },
  { key: '0', label: 'Tecla 0' },
  { key: '.', label: 'Tecla .' },
];

export const BasicVariablesModal: React.FC<BasicVariablesModalProps> = ({
  isOpen,
  onClose,
  variables,
  onSaveVariables,
  onInsertVariable,
}) => {
  const [items, setItems] = useState<BasicVariable[]>(variables);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [savedStatus, setSavedStatus] = useState(false);

  if (!isOpen) return null;

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanName = newName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanVal = newValue.trim();
    if (!cleanName || !cleanVal) return;

    const newItem: BasicVariable = {
      id: 'var_' + Date.now(),
      name: cleanName,
      valueExpression: cleanVal,
      keyShortcut: newKey || undefined,
      description: newDesc.trim() || undefined,
    };

    const updated = [...items.filter((v) => v.name !== cleanName), newItem];
    setItems(updated);
    onSaveVariables(updated);

    setNewName('');
    setNewValue('');
    setNewKey('');
    setNewDesc('');
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 1500);
  };

  const handleDelete = (id: string) => {
    const updated = items.filter((v) => v.id !== id);
    setItems(updated);
    onSaveVariables(updated);
  };

  const handleClearAll = () => {
    setItems([]);
    onSaveVariables([]);
  };

  const handleQuickAdd = (name: string, val: string, key?: string, desc?: string) => {
    const newItem: BasicVariable = {
      id: 'var_' + Date.now(),
      name,
      valueExpression: val,
      keyShortcut: key,
      description: desc,
    };
    const updated = [...items.filter((v) => v.name !== name), newItem];
    setItems(updated);
    onSaveVariables(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                Variables de la Calculadora Básica
              </h3>
              <p className="text-[11px] text-slate-500">
                Asigna variables a la pulsación larga de teclas
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
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {/* Header Action: Vaciar / Total */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Variables Guardadas ({items.length})
            </span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-bold bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md border border-rose-200 transition-colors cursor-pointer"
                title="Vaciar y borrar todas las variables"
              >
                <RotateCcw className="w-3 h-3" /> Vaciar Todas
              </button>
            )}
          </div>

          {/* Quick Preset Suggestions */}
          {items.length === 0 && (
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs space-y-2">
              <div className="font-bold text-indigo-950 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sugerencias rápidas para agregar:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickAdd('IVA', '1.16', '%', 'IVA 16%')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono font-bold text-xs cursor-pointer shadow-2xs"
                >
                  + IVA (1.16 en %)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd('DESC', '0.90', '-', 'Descuento 10%')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono font-bold text-xs cursor-pointer shadow-2xs"
                >
                  + DESC (0.90 en -)
                </button>
              </div>
            </div>
          )}

          {/* List of active variables */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (onInsertVariable) {
                          onInsertVariable(v.name);
                          onClose();
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 font-mono font-black text-xs cursor-pointer shadow-2xs transition-all active:scale-95"
                      title={`Insertar variable ${v.name} en la cuenta`}
                    >
                      {v.name}
                    </button>
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-slate-900">
                        = {v.valueExpression}
                        {v.keyShortcut && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-sans font-bold">
                            Mantener [{v.keyShortcut}]
                          </span>
                        )}
                      </div>
                      {v.description && (
                        <div className="text-[11px] text-slate-500 truncate">{v.description}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onInsertVariable && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertVariable(v.name);
                          onClose();
                        }}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                        title={`Escribir ${v.name} en la fórmula`}
                      >
                        Insertar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Vaciar / Eliminar variable"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form to Create / Assign New Variable */}
          <form
            onSubmit={handleAdd}
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                Crear o Asignar Nueva Variable
              </span>
              {savedStatus && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> ¡Guardada!
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Nombre (ej. IVA, TASA)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  placeholder="IVA"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Valor (ej. 1.16, 54.5)
                </label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="1.16"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Tecla asignada (Pulsación Larga)
                </label>
                <select
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Ninguna (solo por nombre)</option>
                  {AVAILABLE_KEYS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label} (mantener pulsada)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ej. IVA 16%"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!newName.trim() || !newValue.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar Variable</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Al escribir IVA en la fórmula se evalúa su valor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
