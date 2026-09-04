import React, { useState } from 'react';
import { X, Delete, ArrowDownToLine, CornerDownLeft, Sparkles, HelpCircle } from 'lucide-react';
import { evaluateExpression } from '../utils/mathEvaluator';
import { VariableItem } from '../types';

interface ScientificKeypadProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToActiveRow?: (text: string) => void;
  variables?: VariableItem[];
}

export const ScientificKeypad: React.FC<ScientificKeypadProps> = ({
  isOpen,
  onClose,
  onInsertToActiveRow,
  variables = [],
}) => {
  const [calcInput, setCalcInput] = useState<string>('');
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [historyList, setHistoryList] = useState<{ expr: string; res: number }[]>([]);

  if (!isOpen) return null;

  const varsMap = variables.reduce((acc, v) => {
    acc[v.name] = v.value;
    return acc;
  }, {} as Record<string, number>);

  const handleAppend = (val: string) => {
    setCalcInput((prev) => prev + val);
  };

  const handleClear = () => {
    setCalcInput('');
    setLastResult(null);
  };

  const handleBackspace = () => {
    setCalcInput((prev) => prev.slice(0, -1));
  };

  const handleEvaluate = () => {
    if (!calcInput.trim()) return;
    const res = evaluateExpression(calcInput, varsMap);
    if (res.isValid) {
      setLastResult(res.value);
      setHistoryList((prev) => [{ expr: calcInput, res: res.value }, ...prev.slice(0, 5)]);
    } else {
      setLastResult(NaN);
    }
  };

  const handleInsert = (valueToInsert: string) => {
    if (onInsertToActiveRow) {
      onInsertToActiveRow(valueToInsert);
    }
  };

  const scientificButtons = [
    { label: 'sin', val: 'sin(' },
    { label: 'cos', val: 'cos(' },
    { label: 'tan', val: 'tan(' },
    { label: '√', val: 'sqrt(' },
    { label: 'xʸ', val: '^' },

    { label: 'asin', val: 'asin(' },
    { label: 'acos', val: 'acos(' },
    { label: 'atan', val: 'atan(' },
    { label: '∛', val: 'cbrt(' },
    { label: '%', val: '%' },

    { label: 'ln', val: 'ln(' },
    { label: 'log₁₀', val: 'log(' },
    { label: 'abs', val: 'abs(' },
    { label: 'round', val: 'round(' },
    { label: 'exp', val: 'exp(' },

    { label: 'π', val: 'pi' },
    { label: 'e', val: 'e' },
    { label: '(', val: '(' },
    { label: ')', val: ')' },
    { label: '÷', val: '/' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="scientific-calculator-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col text-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-slate-900">Calculadora Científica & Fórmulas</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display */}
        <div className="p-4 bg-slate-50 flex flex-col gap-1 border-b border-slate-200">
          <div className="text-right text-xs text-slate-400 font-mono h-4 overflow-hidden">
            {historyList[0] ? `${historyList[0].expr} = ${historyList[0].res}` : 'Expresión matemática'}
          </div>
          <input
            id="scientific-calc-display-input"
            type="text"
            value={calcInput}
            onChange={(e) => setCalcInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEvaluate()}
            placeholder="ej. sqrt(100) + 15 * 1.16"
            className="w-full bg-transparent text-right font-mono text-xl font-bold text-slate-900 focus:outline-none placeholder-slate-400"
          />
          <div className="flex items-center justify-between pt-2 text-sm border-t border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Resultado calculado:</span>
            <span
              className={`font-mono font-bold text-lg ${
                lastResult === null
                  ? 'text-slate-400'
                  : isNaN(lastResult)
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }`}
            >
              {lastResult === null
                ? '0'
                : isNaN(lastResult)
                ? 'Error'
                : lastResult.toLocaleString('es-VE', { maximumFractionDigits: 6 })}
            </span>
          </div>
        </div>

        {/* Quick Variables helper bar */}
        {variables.length > 0 && (
          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-slate-500 text-[11px] font-medium shrink-0">Variables:</span>
            {variables.map((v) => (
              <button
                key={v.id}
                onClick={() => handleAppend(v.name)}
                className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors shrink-0 font-mono text-xs font-semibold shadow-2xs"
                title={`${v.name} = ${v.value}`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        {/* Keypad Grid */}
        <div className="p-4 flex flex-col gap-3 bg-white">
          {/* Scientific grid */}
          <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
            {scientificButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleAppend(btn.val)}
                className="py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-semibold active:scale-95"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Standard numbers & operators grid */}
          <div className="grid grid-cols-4 gap-1.5 font-mono text-sm">
            <button
              onClick={handleClear}
              className="py-2.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors font-bold"
            >
              C
            </button>
            <button
              onClick={handleBackspace}
              className="py-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center border border-slate-200"
            >
              <Delete className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleAppend('%')}
              className="py-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 font-bold"
            >
              %
            </button>
            <button
              onClick={() => handleAppend('*')}
              className="py-2.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors font-bold text-base"
            >
              ×
            </button>

            <button
              onClick={() => handleAppend('7')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              7
            </button>
            <button
              onClick={() => handleAppend('8')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              8
            </button>
            <button
              onClick={() => handleAppend('9')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              9
            </button>
            <button
              onClick={() => handleAppend('-')}
              className="py-2.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors font-bold text-base"
            >
              -
            </button>

            <button
              onClick={() => handleAppend('4')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              4
            </button>
            <button
              onClick={() => handleAppend('5')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              5
            </button>
            <button
              onClick={() => handleAppend('6')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              6
            </button>
            <button
              onClick={() => handleAppend('+')}
              className="py-2.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors font-bold text-base"
            >
              +
            </button>

            <button
              onClick={() => handleAppend('1')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              1
            </button>
            <button
              onClick={() => handleAppend('2')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              2
            </button>
            <button
              onClick={() => handleAppend('3')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              3
            </button>
            <button
              onClick={handleEvaluate}
              className="row-span-2 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg flex items-center justify-center transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              =
            </button>

            <button
              onClick={() => handleAppend('0')}
              className="col-span-2 py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              0
            </button>
            <button
              onClick={() => handleAppend('.')}
              className="py-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold shadow-2xs"
            >
              .
            </button>
          </div>

          {/* Action buttons to insert into sheet */}
          <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
            <button
              id="insert-calc-formula-btn"
              onClick={() => {
                if (calcInput.trim()) {
                  handleInsert(calcInput);
                  onClose();
                }
              }}
              disabled={!calcInput.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Insertar fórmula en fila activa
            </button>

            {lastResult !== null && !isNaN(lastResult) && (
              <button
                id="insert-calc-result-btn"
                onClick={() => {
                  handleInsert(String(lastResult));
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Insertar valor ({lastResult})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
