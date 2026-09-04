import React, { useState } from 'react';
import { X, Plus, Trash2, Edit3, Variable, Check, Sparkles, ArrowRight } from 'lucide-react';
import { VariableItem } from '../types';
import { evaluateExpression } from '../utils/mathEvaluator';

interface VariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: VariableItem[];
  onSaveVariables: (vars: VariableItem[]) => void;
  onInsertToActiveRow?: (varName: string) => void;
}

export const VariablesModal: React.FC<VariablesModalProps> = ({
  isOpen,
  onClose,
  variables,
  onSaveVariables,
  onInsertToActiveRow,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [exprInput, setExprInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Build map of existing variables for evaluation
  const varsMap = variables.reduce((acc, v) => {
    if (v.id !== editId) {
      acc[v.name] = v.value;
    }
    return acc;
  }, {} as Record<string, number>);

  const handleSaveVariable = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = nameInput.trim().toLowerCase();
    if (!cleanName) {
      setErrorMsg('Ingresa un nombre para la variable');
      return;
    }

    if (!/^[a-z_][a-z0-9_]*$/i.test(cleanName)) {
      setErrorMsg('El nombre solo debe contener letras, números y guión bajo (sin espacios ni símbolos)');
      return;
    }

    // Check if name conflicts with reserved math functions
    const reserved = ['sin', 'cos', 'tan', 'sqrt', 'log', 'ln', 'abs', 'round', 'pi', 'e', 'min', 'max'];
    if (reserved.includes(cleanName)) {
      setErrorMsg(`"${cleanName}" es una función o constante reservada.`);
      return;
    }

    // Check duplicate name
    const isDuplicate = variables.some((v) => v.name.toLowerCase() === cleanName && v.id !== editId);
    if (isDuplicate) {
      setErrorMsg(`Ya existe una variable llamada "${cleanName}".`);
      return;
    }

    if (!exprInput.trim()) {
      setErrorMsg('Ingresa un valor o fórmula para la variable');
      return;
    }

    const evalResult = evaluateExpression(exprInput, varsMap);
    if (!evalResult.isValid) {
      setErrorMsg(`Error en la fórmula: ${evalResult.error || 'Expresión inválida'}`);
      return;
    }

    if (editId) {
      const updated = variables.map((v) =>
        v.id === editId
          ? {
              ...v,
              name: cleanName,
              expression: exprInput.trim(),
              value: evalResult.value,
              description: descInput.trim(),
            }
          : v
      );
      onSaveVariables(updated);
      setEditId(null);
    } else {
      const newItem: VariableItem = {
        id: 'var_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        expression: exprInput.trim(),
        value: evalResult.value,
        description: descInput.trim(),
      };
      onSaveVariables([...variables, newItem]);
    }

    setNameInput('');
    setExprInput('');
    setDescInput('');
  };

  const handleStartEdit = (item: VariableItem) => {
    setEditId(item.id);
    setNameInput(item.name);
    setExprInput(item.expression);
    setDescInput(item.description);
    setErrorMsg(null);
  };

  const handleDelete = (id: string) => {
    onSaveVariables(variables.filter((v) => v.id !== id));
    if (editId === id) {
      setEditId(null);
      setNameInput('');
      setExprInput('');
      setDescInput('');
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNameInput('');
    setExprInput('');
    setDescInput('');
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="variables-manager-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-slate-800 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Variable className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Variables & Constantes de la Hoja</h3>
              <p className="text-xs text-slate-500">
                Define valores y fórmulas reutilizables (ej. <code>iva = 0.16</code>)
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

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Add / Edit Form */}
          <form
            onSubmit={handleSaveVariable}
            className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3"
          >
            <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>{editId ? 'Modificar Variable' : 'Nueva Variable'}</span>
              {editId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-slate-500 hover:text-slate-800 text-[11px] font-medium"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Nombre (sin espacios)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">@</span>
                  <input
                    id="var-name-input"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="ej. iva, envio, tasa"
                    className="w-full bg-white border border-slate-300 rounded-md pl-6 pr-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Valor o Fórmula
                </label>
                <input
                  id="var-expr-input"
                  type="text"
                  value={exprInput}
                  onChange={(e) => setExprInput(e.target.value)}
                  placeholder="ej. 0.16 o 50 * 2"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Descripción (opcional)
              </label>
              <input
                id="var-desc-input"
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="ej. Impuesto al valor agregado 16%"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {errorMsg && (
              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                id="save-var-submit-btn"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                {editId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editId ? 'Guardar Cambios' : 'Crear Variable'}</span>
              </button>
            </div>
          </form>

          {/* List of variables */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Variables Definidas ({variables.length})
            </h4>

            {variables.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                No hay variables creadas aún en esta hoja.
                <p className="mt-1 text-[11px] text-slate-400">
                  Prueba agregando <code>iva = 0.16</code> o <code>envio = 15</code>.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                {variables.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 text-xs bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {v.name}
                        </span>
                        <span className="text-slate-400 text-xs">=</span>
                        <span className="font-mono text-xs text-slate-800 font-bold">
                          {v.value.toLocaleString('es-VE', { maximumFractionDigits: 4 })}
                        </span>
                        {v.expression !== String(v.value) && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({v.expression})
                          </span>
                        )}
                      </div>
                      {v.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {v.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onInsertToActiveRow && (
                        <button
                          onClick={() => {
                            onInsertToActiveRow(v.name);
                            onClose();
                          }}
                          title={`Insertar "${v.name}" en la fila activa`}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs flex items-center gap-1 font-semibold transition-colors border border-blue-200"
                        >
                          <span>Insertar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleStartEdit(v)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Editar variable"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar variable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
