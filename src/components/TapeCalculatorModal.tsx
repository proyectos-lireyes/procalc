import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Share2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Keyboard,
  Smartphone,
} from 'lucide-react';
import { evaluateExpression } from '../utils/mathEvaluator';
import { formatNumber } from '../utils/currency';

interface TapeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertResult?: (result: string) => void;
  isInline?: boolean;
}

interface TapeRow {
  id: string;
  description: string;
  expression: string;
}

const INITIAL_ROWS: TapeRow[] = [
  { id: '1', description: '', expression: '' },
];

type CalcMode = 'basic' | 'fx991es';
type AngleUnit = 'deg' | 'rad';

export const TapeCalculatorModal: React.FC<TapeCalculatorModalProps> = ({
  isOpen,
  onClose,
  onInsertResult,
  isInline = false,
}) => {
  const [calcMode, setCalcMode] = useState<CalcMode>('basic');
  const [rows, setRows] = useState<TapeRow[]>(INITIAL_ROWS);
  const [copiedTape, setCopiedTape] = useState(false);

  // Active focused row in basic mode
  const [activeRowId, setActiveRowId] = useState<string>(INITIAL_ROWS[0].id);

  // Input refs for automatic focus
  const exprInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Scientific Mode State (Casio FX-991ES)
  const [sciExpr, setSciExpr] = useState<string>('');
  const [sciAngleUnit, setSciAngleUnit] = useState<AngleUnit>('deg');
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [isAlphaActive, setIsAlphaActive] = useState<boolean>(false);
  const [showAsFraction, setShowAsFraction] = useState<boolean>(false);
  const [sciHistory, setSciHistory] = useState<string[]>([]);
  const [sciHistoryIdx, setSciHistoryIdx] = useState<number>(-1);
  const [rowToDelete, setRowToDelete] = useState<{
    id: string;
    lineNum: number;
    description: string;
    expression: string;
  } | null>(null);

  const sciInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && calcMode === 'basic' && rows.length > 0) {
      const lastId = rows[rows.length - 1].id;
      setActiveRowId(lastId);
      setTimeout(() => {
        exprInputRefs.current[lastId]?.focus();
      }, 50);
    } else if (isOpen && calcMode === 'fx991es') {
      setTimeout(() => {
        sciInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, calcMode]);

  // BASIC MODE: Sequential evaluation of rows
  const computedTapeRows = useMemo(() => {
    let runningAns = 0;
    return rows.map((r, idx) => {
      const trimmed = r.expression.trim();
      if (!trimmed) {
        return {
          ...r,
          lineNum: idx + 1,
          isValid: true,
          evaluatedValue: 0,
          subtotal: runningAns,
          isMathOp: false,
        };
      }

      let processed = trimmed;
      if (/^[+\-*/^%]/.test(trimmed)) {
        processed = `ans ${trimmed}`;
      }

      const res = evaluateExpression(processed, { ans: runningAns, Ans: runningAns, ANS: runningAns });
      const isValid = res.isValid;
      const evaluatedValue = isValid ? res.value : 0;

      // Determine if this row contains a mathematical operation or value
      const hasMathOperators = /[+\-*/^%()a-zA-Z!]/.test(trimmed);
      const isPlainNumber = /^\s*\d+(\.\d+)?\s*$/.test(trimmed);
      const isMathOp = hasMathOperators || !isPlainNumber;

      if (isValid) {
        if (/^[+\-]/.test(trimmed)) {
          runningAns = evaluatedValue;
        } else if (/^[*/^%]/.test(trimmed) || trimmed.toLowerCase().includes('ans')) {
          runningAns = evaluatedValue;
        } else {
          runningAns = idx === 0 ? evaluatedValue : runningAns + evaluatedValue;
        }
      }

      return {
        ...r,
        lineNum: idx + 1,
        isValid,
        evaluatedValue,
        subtotal: runningAns,
        isMathOp: trimmed.length > 0,
        error: res.error,
      };
    });
  }, [rows]);

  const grandTotal = computedTapeRows.length > 0 ? computedTapeRows[computedTapeRows.length - 1].subtotal : 0;

  // Add new row and automatically focus its MONTO / EXPR field
  const handleAddRow = (insertIndex?: number) => {
    const newId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newRow: TapeRow = { id: newId, description: '', expression: '' };
    const newRows = [...rows];

    const idx = insertIndex !== undefined ? insertIndex + 1 : rows.length;
    newRows.splice(idx, 0, newRow);
    setRows(newRows);
    setActiveRowId(newId);

    setTimeout(() => {
      exprInputRefs.current[newId]?.focus();
    }, 50);
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([{ id: 'row_' + Date.now(), description: '', expression: '' }]);
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  const handleClearAllTape = () => {
    setRows([{ id: 'row_' + Date.now(), description: '', expression: '' }]);
  };

  // Keyboard navigation for basic mode
  const handleTapeKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRow(index);
    }
  };

  // Insert token into active row in basic mode AT CURSOR POSITION
  const handleInsertBasicToken = (token: string) => {
    if (token === '+ Fila') {
      handleAddRow();
      return;
    }

    const targetRow = rows.find((r) => r.id === activeRowId) || rows[rows.length - 1];
    if (!targetRow) return;

    const input = exprInputRefs.current[targetRow.id];
    const currentExpr = targetRow.expression || '';
    const start = input ? input.selectionStart ?? currentExpr.length : currentExpr.length;
    const end = input ? input.selectionEnd ?? currentExpr.length : currentExpr.length;

    let updatedExpr = currentExpr;
    let newCursorPos = start;

    if (token === 'AC') {
      updatedExpr = '';
      newCursorPos = 0;
    } else if (token === 'DEL') {
      if (start === end) {
        if (start > 0) {
          updatedExpr = currentExpr.slice(0, start - 1) + currentExpr.slice(end);
          newCursorPos = start - 1;
        }
      } else {
        updatedExpr = currentExpr.slice(0, start) + currentExpr.slice(end);
        newCursorPos = start;
      }
    } else {
      // Insert token right at cursor position
      updatedExpr = currentExpr.slice(0, start) + token + currentExpr.slice(end);
      newCursorPos = start + token.length;
    }

    setRows(rows.map((r) => (r.id === targetRow.id ? { ...r, expression: updatedExpr } : r)));

    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Copy full account breakdown (basic mode)
  const handleShareFullAccount = () => {
    let text = `📝 *CALCULADORA DE CUENTA*\n`;
    text += `───────────────────────────\n`;
    computedTapeRows.forEach((r, idx) => {
      const desc = r.description.trim() ? ` [${r.description.trim()}]` : '';
      const expr = r.expression.trim() || '0';
      const sub = r.isMathOp ? ` = ${formatNumber(r.evaluatedValue, 2)}` : '';
      text += `${idx + 1}. ${expr}${desc}${sub}\n`;
    });
    text += `───────────────────────────\n`;
    text += `💰 *TOTAL ACUMULADO:* ${formatNumber(grandTotal, 2)}\n`;

    navigator.clipboard.writeText(text);
    setCopiedTape(true);
    setTimeout(() => setCopiedTape(false), 2000);
  };

  // SCIENTIFIC MODE EVALUATION (FX-991ES)
  const sciEvaluation = useMemo(() => {
    if (!sciExpr.trim()) {
      return { isValid: true, value: 0, fraction: '0/1', formatted: '0' };
    }

    let processed = sciExpr;
    if (sciAngleUnit === 'deg') {
      processed = processed
        .replace(/\bsin\(/g, 'sind(')
        .replace(/\bcos\(/g, 'cosd(')
        .replace(/\btan\(/g, 'tand(')
        .replace(/\basin\(/g, 'asind(')
        .replace(/\bacos\(/g, 'acosd(')
        .replace(/\batan\(/g, 'atand(');
    }

    const res = evaluateExpression(processed);
    if (!res.isValid) {
      return { isValid: false, error: res.error, value: 0, fraction: '', formatted: 'Syntax ERROR' };
    }

    const val = res.value;

    // Convert decimal to simplified fraction (e.g. 2.4 -> 12/5)
    const toFraction = (num: number): string => {
      if (Number.isInteger(num)) return `${num}`;
      const tolerance = 1.0e-6;
      let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
      let b = num;
      do {
        const a = Math.floor(b);
        let aux = h1;
        h1 = a * h1 + h2;
        h2 = aux;
        aux = k1;
        k1 = a * k1 + k2;
        k2 = aux;
        b = 1 / (b - a);
      } while (Math.abs(num - h1 / k1) > num * tolerance && k1 < 10000);

      return `${h1}/${k1}`;
    };

    const fractionStr = toFraction(val);

    return {
      isValid: true,
      value: val,
      fraction: fractionStr,
      formatted: formatNumber(val, 6).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, ''),
    };
  }, [sciExpr, sciAngleUnit]);

  // Insert token in Casio FX-991ES at cursor position
  const handleInsertSciToken = (token: string) => {
    const input = sciInputRef.current;
    const start = input?.selectionStart ?? sciExpr.length;
    const end = input?.selectionEnd ?? sciExpr.length;

    let insertText = token;
    let cursorOffset = token.length;

    if (token === 'AC') {
      setSciExpr('');
      return;
    }

    if (token === 'DEL') {
      if (start === end) {
        if (start > 0) {
          const newText = sciExpr.slice(0, start - 1) + sciExpr.slice(end);
          setSciExpr(newText);
          setTimeout(() => {
            if (input) {
              input.selectionStart = input.selectionEnd = start - 1;
              input.focus();
            }
          }, 10);
        }
      } else {
        const newText = sciExpr.slice(0, start) + sciExpr.slice(end);
        setSciExpr(newText);
        setTimeout(() => {
          if (input) {
            input.selectionStart = input.selectionEnd = start;
            input.focus();
          }
        }, 10);
      }
      return;
    }

    if (token === 'FRAC') {
      insertText = '/';
      cursorOffset = 1;
    } else if (token === 'SQRT') {
      insertText = 'sqrt(';
      cursorOffset = 5;
    } else if (token === 'CBRT') {
      insertText = 'cbrt(';
      cursorOffset = 5;
    } else if (token === 'POW') {
      insertText = '^(';
      cursorOffset = 2;
    } else if (token === 'SQR') {
      insertText = '^2';
      cursorOffset = 2;
    } else if (token === 'CUBE') {
      insertText = '^3';
      cursorOffset = 2;
    } else if (token === 'INV') {
      insertText = '^(-1)';
      cursorOffset = 5;
    } else if (token === 'EXP10') {
      insertText = '*10^(';
      cursorOffset = 5;
    } else if (token === 'EXP_E') {
      insertText = 'exp(';
      cursorOffset = 4;
    } else if (token === 'FACT') {
      insertText = '!';
      cursorOffset = 1;
    } else if (token === 'SUM') {
      insertText = 'sumatoria(';
      cursorOffset = 10;
    } else if (token === 'PCT') {
      insertText = '%';
      cursorOffset = 1;
    }

    const newExpr = sciExpr.slice(0, start) + insertText + sciExpr.slice(end);
    setSciExpr(newExpr);

    setTimeout(() => {
      if (input) {
        input.selectionStart = input.selectionEnd = start + cursorOffset;
        input.focus();
      }
    }, 10);

    setIsShiftActive(false);
    setIsAlphaActive(false);
  };

  // Replay D-Pad Navigation in FX-991ES
  const handleDpadMove = (direction: 'left' | 'right' | 'up' | 'down') => {
    const input = sciInputRef.current;
    if (!input) return;

    if (direction === 'left') {
      const pos = Math.max(0, (input.selectionStart ?? 0) - 1);
      input.selectionStart = input.selectionEnd = pos;
      input.focus();
    } else if (direction === 'right') {
      const pos = Math.min(sciExpr.length, (input.selectionEnd ?? 0) + 1);
      input.selectionStart = input.selectionEnd = pos;
      input.focus();
    } else if (direction === 'up') {
      if (sciHistory.length > 0) {
        const nextIdx = Math.min(sciHistory.length - 1, sciHistoryIdx + 1);
        setSciHistoryIdx(nextIdx);
        setSciExpr(sciHistory[sciHistory.length - 1 - nextIdx]);
      }
    } else if (direction === 'down') {
      if (sciHistoryIdx > 0) {
        const nextIdx = sciHistoryIdx - 1;
        setSciHistoryIdx(nextIdx);
        setSciExpr(sciHistory[sciHistory.length - 1 - nextIdx]);
      } else if (sciHistoryIdx === 0) {
        setSciHistoryIdx(-1);
        setSciExpr('');
      }
    }
  };

  // Press EQUAL in Casio mode
  const handleSciEqual = () => {
    if (sciEvaluation.isValid && sciExpr.trim()) {
      setSciHistory((prev) => [...prev.filter((h) => h !== sciExpr), sciExpr]);
      setSciHistoryIdx(-1);
    }
  };

  // Helper to render Casio Natural VPAM stacked fractions in real-time
  const renderNaturalDisplay = (expr: string) => {
    if (!expr) return <span className="opacity-40 font-mono">0</span>;

    // Split by major terms (+ and - outside parentheses) or tokenize fractions like `a/b`
    const tokens = expr.split(/(\s*[+\-*]\s*)/g);

    return (
      <div className="flex items-center flex-wrap gap-1 font-mono text-sm sm:text-base leading-none py-1">
        {tokens.map((token, idx) => {
          if (token.includes('/') && !token.includes('//')) {
            const parts = token.split('/');
            const num = parts[0]?.trim();
            const den = parts.slice(1).join('/')?.trim();
            return (
              <span key={idx} className="inline-flex flex-col items-center justify-center mx-1 align-middle">
                <span className="border-b-2 border-[#1D2B1A] px-1 text-center font-bold text-xs sm:text-sm">
                  {num || '1'}
                </span>
                <span className="px-1 text-center font-bold text-xs sm:text-sm">
                  {den || '1'}
                </span>
              </span>
            );
          }
          return <span key={idx} className="font-bold">{token}</span>;
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      id="calculator-modal"
      className={
        isInline
          ? `w-full h-full max-h-full rounded-xl border shadow-xs flex flex-col min-h-0 overflow-hidden select-none ${
              calcMode === 'fx991es'
                ? 'bg-slate-950 text-slate-100 border-slate-800'
                : 'bg-white text-slate-800 border-slate-200'
            }`
          : `fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden select-none ${
              calcMode === 'fx991es' ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'
            }`
      }
    >
      {/* Clean Header: Title + Mode Switcher */}
      <div
        className={`flex items-center justify-between px-3 sm:px-6 py-2 sm:py-2.5 border-b shrink-0 ${
          calcMode === 'fx991es'
            ? 'border-slate-800 bg-slate-900 text-slate-100'
            : 'border-slate-200 bg-slate-50 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <h3 className="font-bold text-sm sm:text-base">
            Calculadora
          </h3>

          {/* Mode Switcher (Básica / Científica) */}
          <div
            className={`flex items-center p-0.5 rounded-lg text-xs ${
              calcMode === 'fx991es' ? 'bg-slate-800' : 'bg-slate-200/80'
            }`}
          >
            <button
              type="button"
              onClick={() => setCalcMode('basic')}
              className={`py-1 px-3.5 rounded-md font-bold transition-all cursor-pointer ${
                calcMode === 'basic'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : calcMode === 'fx991es'
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Básica
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('fx991es')}
              className={`py-1 px-3.5 rounded-md font-bold transition-all cursor-pointer ${
                calcMode === 'fx991es'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Científica
            </button>
          </div>
        </div>

        {!isInline && (
          <button
            onClick={onClose}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer ${
              calcMode === 'fx991es'
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Cerrar calculadora"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* MODE 1: BASIC LINE CALCULATOR (Full screen Excel-like with automatic focus on Monto) */}
      {calcMode === 'basic' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full max-w-4xl mx-auto h-full">
          {/* Scrollable Rows Table */}
          <div className="p-2 sm:p-3 overflow-y-auto flex-1 min-h-0 bg-slate-50/50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="w-8 py-1.5 px-1 text-center">#</th>
                  <th className="py-1.5 px-2">Descripción (opcional)</th>
                  <th className="w-48 sm:w-64 py-1.5 px-2">Monto / Operación</th>
                  <th className="w-28 sm:w-36 py-1.5 px-2 text-right">Subtotal</th>
                  <th className="w-8 py-1.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computedTapeRows.map((row, idx) => {
                  const isSelected = activeRowId === row.id;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setActiveRowId(row.id)}
                      className={`transition-colors ${
                        isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-100/50'
                      }`}
                    >
                      <td className="py-1.5 px-1 text-center text-xs font-mono font-bold text-slate-400">
                        {row.lineNum}
                      </td>

                      {/* DESCRIPCIÓN */}
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          inputMode="text"
                          value={row.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows(
                              rows.map((r) => (r.id === row.id ? { ...r, description: val } : r))
                            );
                          }}
                          onFocus={() => setActiveRowId(row.id)}
                          onKeyDown={(e) => handleTapeKeyDown(e, idx)}
                          placeholder="Descripción"
                          className="w-full bg-transparent px-2 py-1 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded font-medium"
                        />
                      </td>

                      {/* MONTO / OPERACIÓN */}
                      <td className="py-1.5 px-2">
                        <input
                          ref={(el) => (exprInputRefs.current[row.id] = el)}
                          type="text"
                          inputMode="none"
                          value={row.expression}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows(
                              rows.map((r) => (r.id === row.id ? { ...r, expression: val } : r))
                            );
                          }}
                          onFocus={() => setActiveRowId(row.id)}
                          onKeyDown={(e) => handleTapeKeyDown(e, idx)}
                          placeholder="100, +25, -10, ans*0.16"
                          className={`w-full bg-white px-2 py-1 text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded border ${
                            !row.isValid
                              ? 'border-rose-300 text-rose-600 bg-rose-50'
                              : 'border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* SUBTOTAL: Solo si es una operación matemática */}
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-xs sm:text-sm">
                        {row.isMathOp && row.isValid ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            = {formatNumber(row.evaluatedValue, 2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>

                      {/* DELETE ROW */}
                      <td className="py-1.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRowToDelete({
                              id: row.id,
                              lineNum: row.lineNum,
                              description: row.description,
                              expression: row.expression,
                            });
                          }}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Basic Calculator Summary Bar (Compartir cuenta y Total) */}
          <div className="bg-white px-3 py-2 border-t border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShareFullAccount}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copiar desglose completo"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedTape ? '¡Copiado!' : 'Compartir cuenta'}</span>
            </button>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1 flex items-center gap-2 shadow-2xs">
              <span className="text-xs font-bold text-indigo-900">Total:</span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-indigo-900">
                {formatNumber(grandTotal, 2)}
              </span>
            </div>
          </div>

          {/* Basic Keypad with DEL, AC, Clear All and cursor-position insertion */}
          <div className="p-2 sm:p-3 bg-slate-100 border-t border-slate-200 shrink-0">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 max-w-2xl mx-auto">
              {/* Row 1: (, ), %, DEL, AC */}
              <button
                type="button"
                onClick={() => handleInsertBasicToken('(')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken(')')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                )
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('%')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('DEL')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-rose-100 hover:bg-rose-200 text-rose-800 active:scale-95 flex items-center justify-center"
              >
                DEL
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('AC')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-rose-200 hover:bg-rose-300 text-rose-900 active:scale-95 flex items-center justify-center"
              >
                AC
              </button>

              {/* Row 2: 7, 8, 9, /, * */}
              {['7', '8', '9', '/', '*'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => handleInsertBasicToken(btn)}
                  className={`h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono active:scale-95 flex items-center justify-center ${
                    btn === '/' || btn === '*'
                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-lg sm:text-xl'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {btn === '/' ? '÷' : btn === '*' ? '×' : btn}
                </button>
              ))}

              {/* Row 3: 4, 5, 6, -, + */}
              {['4', '5', '6', '-', '+'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => handleInsertBasicToken(btn)}
                  className={`h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono active:scale-95 flex items-center justify-center ${
                    btn === '-' || btn === '+'
                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-lg sm:text-xl'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {btn}
                </button>
              ))}

              {/* Row 4: 1, 2, 3, Ans, Limpiar Todo */}
              <button
                type="button"
                onClick={() => handleInsertBasicToken('1')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('2')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('3')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('ans')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer font-mono bg-indigo-100 hover:bg-indigo-200 text-indigo-900 active:scale-95 flex items-center justify-center"
              >
                Ans
              </button>
              <button
                type="button"
                onClick={handleClearAllTape}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-xs font-bold transition-all cursor-pointer font-sans bg-rose-100 hover:bg-rose-200 text-rose-800 shadow-2xs flex items-center justify-center gap-1 active:scale-95"
                title="Limpiar todas las filas de la cuenta"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>

              {/* Row 5: 0, 00, ., +, ↵ Enter */}
              <button
                type="button"
                onClick={() => handleInsertBasicToken('0')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('00')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                00
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('.')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleInsertBasicToken('+')}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-lg sm:text-xl font-bold transition-all cursor-pointer font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 active:scale-95 flex items-center justify-center"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => handleAddRow()}
                className="h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer font-mono bg-indigo-700 hover:bg-indigo-600 text-white shadow-xs flex items-center justify-center gap-1 active:scale-95"
                title="Nueva Fila (Enter)"
              >
                ↵ Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CASIO FX-991ES SCIENTIFIC CALCULATOR (Fullscreen Natural V.P.A.M. & No Scroll) */}
      {calcMode === 'fx991es' && (
        <div className="flex flex-col flex-1 min-h-0 p-2 sm:p-3 bg-slate-950 text-slate-100 overflow-hidden items-center justify-between h-full">
          <div className="w-full max-w-lg flex flex-col gap-1.5 sm:gap-2 h-full flex-1 min-h-0 justify-between">
            {/* Casio Natural Display Screen */}
            <div className="bg-[#A4B598] text-[#1D2B1A] border-4 border-slate-800 rounded-lg p-3 font-mono shadow-inner shrink-0">
              {/* Screen Top Status Badges */}
              <div className="flex items-center justify-between text-[10px] font-extrabold tracking-wider border-b border-[#1D2B1A]/20 pb-1 mb-1">
                <div className="flex items-center gap-2">
                  <span className={isShiftActive ? 'bg-[#1D2B1A] text-[#A4B598] px-1 rounded' : 'opacity-30'}>
                    S
                  </span>
                  <span className={isAlphaActive ? 'bg-[#1D2B1A] text-[#A4B598] px-1 rounded' : 'opacity-30'}>
                    A
                  </span>
                  <span className="bg-[#1D2B1A] text-[#A4B598] px-1 rounded">
                    {sciAngleUnit.toUpperCase()}
                  </span>
                  <span className="opacity-40">MATH</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSciAngleUnit((prev) => (prev === 'deg' ? 'rad' : 'deg'))}
                    className="text-[9px] bg-[#1D2B1A]/20 hover:bg-[#1D2B1A]/40 px-1.5 py-0.5 rounded cursor-pointer font-bold"
                  >
                    {sciAngleUnit === 'deg' ? 'DEG➔RAD' : 'RAD➔DEG'}
                  </button>
                </div>
              </div>

              {/* Natural Fraction Visual Screen (Render natural mathematical fractions live while typing) */}
              <div className="min-h-[52px] flex flex-col justify-center">
                {/* Visual live rendering of stacked fractions */}
                <div className="min-h-[28px] flex items-center overflow-x-auto scrollbar-none">
                  {renderNaturalDisplay(sciExpr)}
                </div>

                {/* Raw Input Bar with Cursor */}
                <input
                  ref={sciInputRef}
                  type="text"
                  inputMode="none"
                  value={sciExpr}
                  onChange={(e) => setSciExpr(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-xs font-mono font-semibold text-[#1D2B1A]/80 focus:outline-none tracking-wider border-t border-[#1D2B1A]/10 pt-0.5"
                />
              </div>

              {/* Evaluated Result Line */}
              <div className="flex items-center justify-between pt-1 border-t border-[#1D2B1A]/20">
                <button
                  type="button"
                  onClick={() => setShowAsFraction(!showAsFraction)}
                  className="text-[10px] bg-[#1D2B1A]/20 hover:bg-[#1D2B1A]/40 px-1.5 py-0.5 rounded font-bold cursor-pointer"
                  title="Alternar entre decimal y fracción"
                >
                  S ⇔ D
                </button>

                <div className="text-right">
                  {showAsFraction && sciEvaluation.fraction && sciEvaluation.fraction.includes('/') ? (
                    <div className="inline-flex flex-col items-center justify-center font-bold text-sm">
                      <span className="border-b border-[#1D2B1A] px-1">
                        {sciEvaluation.fraction.split('/')[0]}
                      </span>
                      <span className="px-1">
                        {sciEvaluation.fraction.split('/')[1]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg sm:text-xl font-extrabold text-[#1D2B1A]">
                      {sciEvaluation.isValid ? sciEvaluation.formatted : 'Syntax ERROR'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* D-Pad & Control Section */}
            <div className="grid grid-cols-3 gap-2 items-center px-1 shrink-0">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setIsShiftActive(!isShiftActive)}
                  className={`py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    isShiftActive ? 'bg-amber-400 text-black ring-2 ring-amber-300' : 'bg-amber-600/90 hover:bg-amber-600 text-white'
                  }`}
                >
                  SHIFT
                </button>
                <button
                  type="button"
                  onClick={() => setIsAlphaActive(!isAlphaActive)}
                  className={`py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    isAlphaActive ? 'bg-rose-400 text-black ring-2 ring-rose-300' : 'bg-rose-600/90 hover:bg-rose-600 text-white'
                  }`}
                >
                  ALPHA
                </button>
              </div>

              {/* Replay 4-Way D-Pad */}
              <div className="flex items-center justify-center">
                <div className="relative w-20 h-20 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-[8px] text-slate-400 font-bold tracking-tighter">REPLAY</span>
                  <button
                    type="button"
                    onClick={() => handleDpadMove('up')}
                    className="absolute top-0.5 text-slate-300 hover:text-white p-1 cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDpadMove('down')}
                    className="absolute bottom-0.5 text-slate-300 hover:text-white p-1 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDpadMove('left')}
                    className="absolute left-0.5 text-slate-300 hover:text-white p-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDpadMove('right')}
                    className="absolute right-0.5 text-slate-300 hover:text-white p-1 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('AC')}
                  className="py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  ON / AC
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('DEL')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  DEL
                </button>
              </div>
            </div>

            {/* Casio FX-991ES Function Keys Matrix with Shift Amber Badges */}
            <div className="space-y-1 font-mono text-xs shrink-0">
              {/* Row 1: Fraction (c d/e), Sqrt (cbrt), Pow2 (cube), PowY (root), Log (10^x), Ln (e^x) */}
              <div className="grid grid-cols-6 gap-1">
                {/* Fraction key */}
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('FRAC')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">a/b</span>
                  <span className="text-xs">▰/▱</span>
                </button>

                {/* Sqrt key */}
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'CBRT' : 'SQRT')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">∛</span>
                  <span className="text-xs">{isShiftActive ? '∛' : '√'}</span>
                </button>

                {/* x^2 key */}
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'CUBE' : 'SQR')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">x³</span>
                  <span className="text-xs">{isShiftActive ? 'x³' : 'x²'}</span>
                </button>

                {/* x^y key */}
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('POW')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">ˣ√</span>
                  <span className="text-xs">xʸ</span>
                </button>

                {/* Log key */}
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'EXP10' : 'log(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">10ˣ</span>
                  <span className="text-xs">{isShiftActive ? '10ˣ' : 'log'}</span>
                </button>

                {/* Ln key */}
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'EXP_E' : 'ln(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">eˣ</span>
                  <span className="text-xs">{isShiftActive ? 'eˣ' : 'ln'}</span>
                </button>
              </div>

              {/* Row 2: Trig functions (sin⁻¹, cos⁻¹, tan⁻¹), Fact (!), Sumatoria (Σ), nCr (nPr) */}
              <div className="grid grid-cols-6 gap-1">
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'asin(' : 'sin(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">sin⁻¹</span>
                  <span className="text-xs">{isShiftActive ? 'sin⁻¹' : 'sin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'acos(' : 'cos(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">cos⁻¹</span>
                  <span className="text-xs">{isShiftActive ? 'cos⁻¹' : 'cos'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'atan(' : 'tan(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">tan⁻¹</span>
                  <span className="text-xs">{isShiftActive ? 'tan⁻¹' : 'tan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'FACT' : 'INV')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">x!</span>
                  <span className="text-xs">{isShiftActive ? 'x!' : 'x⁻¹'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'SUM' : '(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">Σ</span>
                  <span className="text-xs">{isShiftActive ? 'Σ' : '('}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'nPr(' : 'nCr(')}
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100 font-bold flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">nPr</span>
                  <span className="text-xs">{isShiftActive ? 'nPr' : 'nCr'}</span>
                </button>
              </div>

              {/* Row 3: Parenthesis, Percent %, and Main Keypad */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('7')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('8')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('9')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('DEL')}
                  className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-xs"
                >
                  DEL
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('AC')}
                  className="py-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold text-xs"
                >
                  AC
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertSciToken('4')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('5')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('6')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('*')}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('/')}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm"
                >
                  ÷
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertSciToken('1')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('2')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('3')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('+')}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('-')}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm"
                >
                  -
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertSciToken('0')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken('.')}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-sm"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'pi' : 'EXP10')}
                  className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">π</span>
                  <span>{isShiftActive ? 'π' : '×10ˣ'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSciToken(isShiftActive ? 'e' : 'ans')}
                  className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs flex flex-col items-center justify-center"
                >
                  <span className="text-[8px] text-amber-400 font-bold leading-none">e</span>
                  <span>{isShiftActive ? 'e' : 'Ans'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSciEqual}
                  className="py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded font-extrabold text-sm shadow-md"
                >
                  =
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR FILA EN CALCULADORA */}
      {rowToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 flex flex-col gap-3 animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="p-2 rounded-lg bg-rose-100 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-slate-900">¿Eliminar fila #{rowToDelete.lineNum}?</h4>
                <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                  {rowToDelete.description ? `"${rowToDelete.description}"` : 'Fila de cálculo'} {rowToDelete.expression ? `(${rowToDelete.expression})` : ''}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              ¿Estás seguro de que deseas eliminar esta fila? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteRow(rowToDelete.id);
                  setRowToDelete(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

