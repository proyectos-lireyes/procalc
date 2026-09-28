import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  Clock,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Compass,
} from 'lucide-react';
import {
  MathNode,
  CursorPosition,
  generateId,
  insertNode,
  deleteNode,
  navigateCursor,
  serializeASTToMathString,
  getExactFraction,
} from '../utils/naturalMathAST';
import { CasioNaturalDisplay, ResultDisplayFormat } from './CasioNaturalDisplay';
import { evaluateExpression } from '../utils/mathEvaluator';
import { GeometryAndPhysicsModal, CalculationCategory } from './GeometryAndPhysicsModal';
import { ConstantsModal } from './ConstantsModal';

export type AngleUnit = 'deg' | 'rad' | 'gra';

export interface CasioScientificCalculatorProps {
  onInsertResult?: (result: string) => void;
  isInline?: boolean;
}

interface HistoryItem {
  id: string;
  expressionStr: string;
  resultStr: string;
  ast: MathNode[];
  timestamp: number;
}

interface KeyButtonProps {
  label: React.ReactNode;
  primaryAction: () => void;
  shiftLabel?: string;
  shiftAction?: () => void;
  alphaLabel?: string;
  alphaAction?: () => void;
  longPressLabel?: string;
  className?: string;
  colSpan?: number;
  title?: string;
  onLongPress?: () => void;
  isShiftActive: boolean;
  isAlphaActive: boolean;
  onClearShiftAlpha: () => void;
}

const KeyButton: React.FC<KeyButtonProps> = ({
  label,
  primaryAction,
  shiftLabel,
  shiftAction,
  alphaLabel,
  alphaAction,
  longPressLabel,
  className = '',
  colSpan = 1,
  title,
  onLongPress,
  isShiftActive,
  isAlphaActive,
  onClearShiftAlpha,
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const [isPressing, setIsPressing] = useState<boolean>(false);

  const startPress = () => {
    if (!onLongPress) return;
    isLongPressRef.current = false;
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsPressing(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      onLongPress();
    }, 420);
  };

  const endPress = () => {
    setIsPressing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = () => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (isShiftActive) {
      if (shiftAction) {
        shiftAction();
      } else {
        primaryAction();
      }
      onClearShiftAlpha();
    } else if (isAlphaActive) {
      if (alphaAction) {
        alphaAction();
      } else {
        primaryAction();
      }
      onClearShiftAlpha();
    } else {
      primaryAction();
    }
  };

  // Content & Styling based on Shift / Alpha / Normal mode
  let content: React.ReactNode = null;
  let styling = className || 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200';

  if (isShiftActive) {
    if (shiftLabel) {
      content = (
        <div className="flex flex-col items-center justify-center leading-none w-full h-full py-0.5">
          <span className="text-[7px] font-black text-amber-700 uppercase tracking-tighter mb-0.5">
            SHIFT
          </span>
          <span className="font-black text-amber-950 font-mono text-xs sm:text-sm tracking-tight scale-105">
            {shiftLabel}
          </span>
        </div>
      );
      styling =
        'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400 ring-2 ring-amber-400/60 shadow-xs font-black';
    } else {
      content = <span className="opacity-35 text-xs sm:text-sm font-bold">{label}</span>;
      styling = 'bg-slate-50 text-slate-400 border-slate-200 opacity-40';
    }
  } else if (isAlphaActive) {
    if (alphaLabel) {
      content = (
        <div className="flex flex-col items-center justify-center leading-none w-full h-full py-0.5">
          <span className="text-[7px] font-black text-rose-700 uppercase tracking-tighter mb-0.5">
            ALPHA
          </span>
          <span className="font-black text-rose-950 font-mono text-xs sm:text-sm tracking-tight scale-105">
            {alphaLabel}
          </span>
        </div>
      );
      styling =
        'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-400 ring-2 ring-rose-400/60 shadow-xs font-black';
    } else {
      content = <span className="opacity-35 text-xs sm:text-sm font-bold">{label}</span>;
      styling = 'bg-slate-50 text-slate-400 border-slate-200 opacity-40';
    }
  } else {
    // Normal mode:
    // Clearly shows Shift function in amber (top-left), Alpha variable in rose (top-right),
    // primary label in center, and long-press action hint (bottom)
    const hasTopBadges = Boolean(shiftLabel || alphaLabel);

    content = (
      <div className="flex flex-col justify-between items-center w-full h-full py-0.5 px-0.5 leading-none select-none">
        {/* Top Shift / Alpha indicators */}
        <div className="w-full flex items-center justify-between text-[7.5px] sm:text-[8px] font-black leading-none min-h-[9px]">
          {shiftLabel ? (
            <span
              className="text-amber-700 truncate max-w-[50%] font-mono tracking-tighter"
              title={`Shift: ${shiftLabel}`}
            >
              {shiftLabel}
            </span>
          ) : (
            <span />
          )}
          {alphaLabel ? (
            <span
              className="text-rose-700 truncate max-w-[50%] font-mono tracking-tighter ml-auto"
              title={`Alpha: ${alphaLabel}`}
            >
              {alphaLabel}
            </span>
          ) : (
            <span />
          )}
        </div>

        {/* Center Primary Label */}
        <div className="flex-1 flex items-center justify-center my-auto">
          <span className="font-bold text-xs sm:text-sm font-mono leading-tight">
            {label}
          </span>
        </div>

        {/* Bottom Long-Press Hint Badge */}
        {longPressLabel ? (
          <div className="w-full flex items-center justify-center leading-none min-h-[8px]">
            <span
              className={`text-[7px] sm:text-[7.5px] font-black tracking-tighter flex items-center gap-0.5 ${
                className.includes('bg-indigo-600') ? 'text-indigo-200' : 'text-indigo-700'
              }`}
            >
              ⏱ {longPressLabel}
            </span>
          </div>
        ) : hasTopBadges ? (
          <div className="min-h-[4px]" />
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
      onClick={handleClick}
      style={{ gridColumn: colSpan > 1 ? `span ${colSpan} / span ${colSpan}` : undefined }}
      className={`relative h-full rounded-lg sm:rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs select-none border overflow-hidden ${styling}`}
      title={title}
    >
      {/* Visual pulse/bar while holding for long-press */}
      {isPressing && (
        <span className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-[pulse_0.35s_ease-in-out_infinite]" />
      )}
      {content}
    </button>
  );
};

export const CasioScientificCalculator: React.FC<CasioScientificCalculatorProps> = ({
  onInsertResult,
  isInline = false,
}) => {
  // AST Expression & Cursor
  const [nodes, setNodes] = useState<MathNode[]>([]);
  const [cursor, setCursor] = useState<CursorPosition>({ slotId: 'root', index: 0 });

  // Status flags
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [isAlphaActive, setIsAlphaActive] = useState<boolean>(false);
  const [angleUnit, setAngleUnit] = useState<AngleUnit>('deg');
  const [resultFormat, setResultFormat] = useState<ResultDisplayFormat>('auto');
  const [isStoActive, setIsStoActive] = useState<boolean>(false);

  // Modals state
  const [isConstantsOpen, setIsConstantsOpen] = useState<boolean>(false);
  const [isCalculationsOpen, setIsCalculationsOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [copiedStatus, setCopiedStatus] = useState<boolean>(false);

  // Memory & Variables
  const [memoryM, setMemoryM] = useState<number>(0);
  const [lastAns, setLastAns] = useState<number>(0);
  const [variables, setVariables] = useState<Record<string, number>>({
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    X: 0,
    Y: 0,
  });

  // History
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('casio_natural_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 30);
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Evaluation state
  const [evaluatedValue, setEvaluatedValue] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('casio_natural_history', JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  // Insert generic text token (e.g. '7', '+', 'sin(')
  const handleInsertText = useCallback(
    (text: string) => {
      setNodes((prev) => {
        const charNodes: MathNode[] = text.split('').map((char) => ({
          type: 'char',
          id: generateId(),
          value: char,
        }));
        const res = insertNode(prev, cursor, charNodes);
        setCursor(res.newCursor);
        return res.newRoot;
      });
      if (isShiftActive) setIsShiftActive(false);
      if (isAlphaActive) setIsAlphaActive(false);
      setErrorMessage(undefined);
    },
    [cursor, isShiftActive, isAlphaActive]
  );

  // Insert 2-story fraction template
  const handleInsertFraction = useCallback(() => {
    if (isShiftActive) {
      // Mixed fraction template: Whole + Num / Den
      const id = generateId();
      const fracNode: MathNode = {
        type: 'mixed_fraction',
        id,
        whole: [],
        num: [],
        den: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, fracNode, { slotId: `${id}:whole`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
      setIsShiftActive(false);
    } else {
      // Standard 2-story fraction template: Num / Den
      const id = generateId();
      const fracNode: MathNode = {
        type: 'fraction',
        id,
        num: [],
        den: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, fracNode, { slotId: `${id}:num`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
    }
    setErrorMessage(undefined);
  }, [cursor, isShiftActive]);

  // Insert Square Root or Cube Root
  const handleInsertSqrt = useCallback(() => {
    const id = generateId();
    if (isShiftActive) {
      // Cube root
      const rootNode: MathNode = {
        type: 'nth_root',
        id,
        root: [{ type: 'char', id: generateId(), value: '3' }],
        inner: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, rootNode, { slotId: `${id}:inner`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
      setIsShiftActive(false);
    } else {
      // Square root
      const sqrtNode: MathNode = {
        type: 'sqrt',
        id,
        inner: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, sqrtNode, { slotId: `${id}:inner`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
    }
    setErrorMessage(undefined);
  }, [cursor, isShiftActive]);

  // Insert Power (x² / x³ / x^■)
  const handleInsertPower = useCallback(
    (expVal?: string) => {
      const id = generateId();
      if (expVal) {
        const expNodes: MathNode[] = expVal.split('').map((char) => ({
          type: 'char',
          id: generateId(),
          value: char,
        }));
        const powerNode: MathNode = {
          type: 'power',
          id,
          exp: expNodes,
        };
        setNodes((prev) => {
          const res = insertNode(prev, cursor, powerNode);
          setCursor(res.newCursor);
          return res.newRoot;
        });
      } else {
        const powerNode: MathNode = {
          type: 'power',
          id,
          exp: [],
        };
        setNodes((prev) => {
          const res = insertNode(prev, cursor, powerNode, { slotId: `${id}:exp`, index: 0 });
          setCursor(res.newCursor);
          return res.newRoot;
        });
      }
      if (isShiftActive) setIsShiftActive(false);
      setErrorMessage(undefined);
    },
    [cursor, isShiftActive]
  );

  // Insert Integral (cursor directly into integrand, no division!)
  const handleInsertIntegral = useCallback(() => {
    const id = generateId();
    if (isShiftActive) {
      // Derivative d/dx
      const derivNode: MathNode = {
        type: 'derivative',
        id,
        expr: [],
        at: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, derivNode, { slotId: `${id}:expr`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
      setIsShiftActive(false);
    } else {
      // Integral template: cursor enters integrand directly!
      const intNode: MathNode = {
        type: 'integral',
        id,
        expr: [],
        lower: [],
        upper: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, intNode, { slotId: `${id}:expr`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
    }
    setErrorMessage(undefined);
  }, [cursor, isShiftActive]);

  // Insert Derivative: focused directly on target expression (no division!)
  const handleInsertDerivative = useCallback(() => {
    const id = generateId();
    const derivNode: MathNode = {
      type: 'derivative',
      id,
      expr: [],
      at: [],
    };
    setNodes((prev) => {
      const res = insertNode(prev, cursor, derivNode, { slotId: `${id}:expr`, index: 0 });
      setCursor(res.newCursor);
      return res.newRoot;
    });
    if (isShiftActive) setIsShiftActive(false);
    setErrorMessage(undefined);
  }, [cursor, isShiftActive]);

  // Insert Log base n or Summation
  const handleInsertLogBase = useCallback(() => {
    const id = generateId();
    if (isShiftActive) {
      const sumNode: MathNode = {
        type: 'summation',
        id,
        expr: [],
        start: [],
        end: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, sumNode, { slotId: `${id}:expr`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
      setIsShiftActive(false);
    } else {
      const logNode: MathNode = {
        type: 'log_base',
        id,
        base: [],
        arg: [],
      };
      setNodes((prev) => {
        const res = insertNode(prev, cursor, logNode, { slotId: `${id}:base`, index: 0 });
        setCursor(res.newCursor);
        return res.newRoot;
      });
    }
    setErrorMessage(undefined);
  }, [cursor, isShiftActive]);

  // INS: Insert blank slot at current cursor position
  const handleInsertSlot = useCallback(() => {
    handleInsertText(' ');
  }, [handleInsertText]);

  // Delete / Backspace (DEL)
  const handleDelete = useCallback(() => {
    setNodes((prev) => {
      const res = deleteNode(prev, cursor);
      setCursor(res.newCursor);
      return res.newRoot;
    });
    setErrorMessage(undefined);
  }, [cursor]);

  // All Clear (AC)
  const handleClearAll = useCallback(() => {
    setNodes([]);
    setCursor({ slotId: 'root', index: 0 });
    setIsShiftActive(false);
    setIsAlphaActive(false);
    setEvaluatedValue(null);
    setErrorMessage(undefined);
  }, []);

  // Navigate cursor
  const handleNavigate = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      if (nodes.length === 0 && (direction === 'up' || direction === 'down')) {
        if (history.length > 0) {
          let newIdx = historyIndex;
          if (direction === 'up') {
            newIdx = Math.min(history.length - 1, historyIndex + 1);
          } else {
            newIdx = Math.max(-1, historyIndex - 1);
          }
          setHistoryIndex(newIdx);
          if (newIdx >= 0 && newIdx < history.length) {
            const item = history[newIdx];
            setNodes(item.ast);
            setCursor({ slotId: 'root', index: item.ast.length });
            setEvaluatedValue(parseFloat(item.resultStr));
          }
        }
        return;
      }

      setCursor((prev) => navigateCursor(nodes, prev, direction));
    },
    [nodes, history, historyIndex]
  );

  // Evaluate current expression (=)
  const handleEvaluate = useCallback(() => {
    if (nodes.length === 0) return;

    try {
      const serialized = serializeASTToMathString(nodes);
      if (!serialized.trim()) return;

      const evalVars: Record<string, number> = {
        ...variables,
        ans: lastAns,
        Ans: lastAns,
        ANS: lastAns,
        pi: Math.PI,
        e: Math.E,
      };

      const res = evaluateExpression(serialized, evalVars);

      if (res.isValid && res.value !== undefined && !isNaN(res.value)) {
        setEvaluatedValue(res.value);
        setLastAns(res.value);
        setErrorMessage(undefined);

        // Add to history
        const frac = getExactFraction(res.value);
        const resStr =
          frac && frac.d > 1 ? `${frac.n}/${frac.d} (${res.value})` : res.value.toString();

        const newItem: HistoryItem = {
          id: 'hist_' + Date.now(),
          expressionStr: serialized,
          resultStr: resStr,
          ast: nodes,
          timestamp: Date.now(),
        };

        setHistory((prev) => [newItem, ...prev.slice(0, 29)]);
        setHistoryIndex(-1);
      } else {
        setErrorMessage(res.error || 'Error de Sintaxis');
        setEvaluatedValue(null);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error de Cálculo');
      setEvaluatedValue(null);
    }
  }, [nodes, variables, lastAns]);

  // Toggle S ⇔ D
  const handleToggleSD = () => {
    setResultFormat((prev) => {
      if (prev === 'auto') return 'decimal';
      if (prev === 'decimal') return 'fraction';
      if (prev === 'fraction') return 'mixed';
      return 'auto';
    });
  };

  // Keyboard navigation and typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleInsertText(e.key);
      } else if (['+', '-', '*', '/'].includes(e.key)) {
        e.preventDefault();
        if (e.key === '/') {
          handleInsertFraction();
        } else {
          handleInsertText(e.key);
        }
      } else if (e.key === '(' || e.key === ')') {
        e.preventDefault();
        handleInsertText(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleInsertText('.');
      } else if (e.key === '^') {
        e.preventDefault();
        handleInsertPower();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEvaluate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigate('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigate('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNavigate('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleInsertText,
    handleInsertFraction,
    handleInsertPower,
    handleEvaluate,
    handleDelete,
    handleClearAll,
    handleNavigate,
  ]);

  const clearShiftAlpha = useCallback(() => {
    setIsShiftActive(false);
    setIsAlphaActive(false);
  }, []);

  const handleCopyResult = useCallback(() => {
    let textToCopy = '';
    if (evaluatedValue !== null && !isNaN(evaluatedValue)) {
      textToCopy = evaluatedValue.toString();
    } else if (lastAns !== 0) {
      textToCopy = lastAns.toString();
    } else {
      const expr = serializeASTToMathString(nodes);
      if (expr) textToCopy = expr;
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 2000);
    }
  }, [evaluatedValue, lastAns, nodes]);

  /**
   * Helper to render unified keypad keys with SHIFT & ALPHA secondary actions
   */
  const renderKey = (
    label: React.ReactNode,
    primaryAction: () => void,
    options?: {
      shiftLabel?: string;
      shiftAction?: () => void;
      alphaLabel?: string;
      alphaAction?: () => void;
      longPressLabel?: string;
      className?: string;
      colSpan?: number;
      title?: string;
      onLongPress?: () => void;
    }
  ) => {
    return (
      <KeyButton
        label={label}
        primaryAction={primaryAction}
        shiftLabel={options?.shiftLabel}
        shiftAction={options?.shiftAction}
        alphaLabel={options?.alphaLabel}
        alphaAction={options?.alphaAction}
        longPressLabel={options?.longPressLabel}
        className={options?.className}
        colSpan={options?.colSpan}
        title={options?.title}
        onLongPress={options?.onLongPress}
        isShiftActive={isShiftActive}
        isAlphaActive={isAlphaActive}
        onClearShiftAlpha={clearShiftAlpha}
      />
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-1 sm:p-2 overflow-hidden select-none bg-slate-50/50">
      {/* RESULT COPIED TOAST */}
      {copiedStatus && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold">Resultado copiado al portapapeles</span>
        </div>
      )}

      {/* HISTORY OVERLAY (IF OPEN) */}
      {isHistoryOpen && (
        <div className="absolute top-2 left-2 right-2 max-w-xl mx-auto p-3 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 max-h-56 overflow-y-auto text-xs animate-fade-in z-30">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" /> Historial de cálculos
            </span>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Borrar
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {history.length === 0 ? (
            <p className="text-slate-400 py-3 text-center">No hay cálculos recientes</p>
          ) : (
            <div className="space-y-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setNodes(item.ast);
                    setCursor({ slotId: 'root', index: item.ast.length });
                    setEvaluatedValue(parseFloat(item.resultStr));
                    setIsHistoryOpen(false);
                  }}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group border border-transparent hover:border-slate-200"
                >
                  <span className="font-mono text-slate-600 truncate max-w-[65%] group-hover:text-indigo-600">
                    {item.expressionStr}
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-right">
                    = {item.resultStr}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAIN CONTAINER: PURE 0 SCROLL, 35% SCREEN & 65% KEYPAD ARCHITECTURE */}
      <div className="w-full max-w-xl h-full flex flex-col gap-1.5 min-h-0 overflow-hidden">
        {/* CASIO NATURAL DISPLAY: EXACT 35% SCREEN HEIGHT */}
        <div
          className="h-[35%] min-h-0 overflow-hidden flex flex-col"
          style={{ flex: '35 1 0%' }}
        >
          <CasioNaturalDisplay
            nodes={nodes}
            cursor={cursor}
            onSlotClick={(slotId, index) => setCursor({ slotId, index })}
            isShiftActive={isShiftActive}
            isAlphaActive={isAlphaActive}
            isMemoryActive={memoryM !== 0}
            isStoActive={isStoActive}
            angleUnit={angleUnit}
            hasHistory={history.length > 0}
            onToggleAngleUnit={() =>
              setAngleUnit((prev) => (prev === 'deg' ? 'rad' : prev === 'rad' ? 'gra' : 'deg'))
            }
            onOpenHistory={() => setIsHistoryOpen(true)}
            evaluatedValue={evaluatedValue}
            errorMessage={errorMessage}
            resultFormat={resultFormat}
          />
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* UNIFIED KEYPAD (EXACT 65% KEYPAD HEIGHT, ERGONOMIC, 0 SCROLL)      */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div
          className="h-[65%] min-h-0 flex flex-col gap-1 p-1 sm:p-1.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs"
          style={{ flex: '65 1 0%' }}
        >
          {/* ROW 1: SHIFT, ALPHA, ARROWS (←, ↑, ↓, →) */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {/* SHIFT */}
            <button
              type="button"
              onClick={() => {
                setIsShiftActive(!isShiftActive);
                if (isAlphaActive) setIsAlphaActive(false);
              }}
              className={`h-full rounded-lg sm:rounded-xl font-black text-[10.5px] sm:text-xs transition-all cursor-pointer flex flex-col items-center justify-center leading-none border shadow-2xs active:scale-95 ${
                isShiftActive
                  ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/70 shadow-sm animate-pulse'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
              title="SHIFT (Activa funciones doradas de las teclas)"
            >
              <span>SHIFT</span>
              <span className={`text-[7px] font-mono tracking-tighter ${isShiftActive ? 'text-amber-100' : 'text-amber-700'}`}>
                {isShiftActive ? 'ACTIVO' : 'DORADO'}
              </span>
            </button>

            {/* ALPHA */}
            <button
              type="button"
              onClick={() => {
                setIsAlphaActive(!isAlphaActive);
                if (isShiftActive) setIsShiftActive(false);
              }}
              className={`h-full rounded-lg sm:rounded-xl font-black text-[10.5px] sm:text-xs transition-all cursor-pointer flex flex-col items-center justify-center leading-none border shadow-2xs active:scale-95 ${
                isAlphaActive
                  ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-400/70 shadow-sm animate-pulse'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
              }`}
              title="ALPHA (Activa variables rojas de las teclas)"
            >
              <span>ALPHA</span>
              <span className={`text-[7px] font-mono tracking-tighter ${isAlphaActive ? 'text-rose-100' : 'text-rose-700'}`}>
                {isAlphaActive ? 'ACTIVO' : 'ROJO'}
              </span>
            </button>

            {/* Arrow Left ← */}
            <button
              type="button"
              onClick={() => handleNavigate('left')}
              className="h-full rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
              title="Izquierda (←)"
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Arrow Up ↑ */}
            <button
              type="button"
              onClick={() => handleNavigate('up')}
              className="h-full rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
              title="Arriba / Numerador (↑)"
            >
              <ChevronUp className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Arrow Down ↓ */}
            <button
              type="button"
              onClick={() => handleNavigate('down')}
              className="h-full rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
              title="Abajo / Denominador (↓)"
            >
              <ChevronDown className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Arrow Right → */}
            <button
              type="button"
              onClick={() => handleNavigate('right')}
              className="h-full rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
              title="Derecha (→)"
            >
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* ROW 2: TEMPLATES (■/□, √■, x², x^■, log, ln) */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {renderKey(
              <div className="flex flex-col items-center text-[10px] leading-tight font-mono">
                <span>■</span>
                <span className="w-3 h-px bg-slate-800 -my-0.5 block" />
                <span>□</span>
              </div>,
              handleInsertFraction,
              {
                shiftLabel: '■ □/□',
                shiftAction: handleInsertFraction,
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Fracción (Shift: Fracción mixta)',
              }
            )}

            {renderKey(
              '√■',
              handleInsertSqrt,
              {
                shiftLabel: '∛■',
                shiftAction: handleInsertSqrt,
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Raíz cuadrada (Shift: Raíz cúbica)',
              }
            )}

            {renderKey(
              'x²',
              () => handleInsertPower('2'),
              {
                shiftLabel: 'x³',
                shiftAction: () => handleInsertPower('3'),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Cuadrado x² (Shift: Cubo x³)',
              }
            )}

            {renderKey(
              'x^■',
              () => handleInsertPower(),
              {
                shiftLabel: 'ˣ√■',
                shiftAction: () => {
                  const id = generateId();
                  const nthNode: MathNode = {
                    type: 'nth_root',
                    id,
                    root: [],
                    inner: [],
                  };
                  setNodes((prev) => {
                    const res = insertNode(prev, cursor, nthNode, { slotId: `${id}:root`, index: 0 });
                    setCursor(res.newCursor);
                    return res.newRoot;
                  });
                },
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Potencia x^■ (Shift: Raíz n-ésima)',
              }
            )}

            {renderKey(
              'log',
              () => handleInsertText('log('),
              {
                shiftLabel: '10^■',
                shiftAction: () => handleInsertText('10^('),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Logaritmo log (Shift: 10^x)',
              }
            )}

            {renderKey(
              'ln',
              () => handleInsertText('ln('),
              {
                shiftLabel: 'e^■',
                shiftAction: () => handleInsertText('exp('),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Logaritmo natural ln (Shift: e^x)',
              }
            )}
          </div>

          {/* ROW 3: CÁLCULO, TRIGONOMETRÍA & PARÉNTESIS (∫dx, sin, cos, tan, (, )) */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {renderKey(
              '∫dx',
              handleInsertIntegral,
              {
                shiftLabel: 'd/dx',
                shiftAction: handleInsertDerivative,
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200 font-serif',
                title: 'Integral ∫ (Shift: Derivada d/dx)',
              }
            )}

            {renderKey(
              'sin',
              () => handleInsertText('sin('),
              {
                shiftLabel: 'sin⁻¹',
                shiftAction: () => handleInsertText('asin('),
                alphaLabel: 'D',
                alphaAction: () => handleInsertText('D'),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Seno (Shift: asin, Alpha: D)',
              }
            )}

            {renderKey(
              'cos',
              () => handleInsertText('cos('),
              {
                shiftLabel: 'cos⁻¹',
                shiftAction: () => handleInsertText('acos('),
                alphaLabel: 'E',
                alphaAction: () => handleInsertText('E'),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Coseno (Shift: acos, Alpha: E)',
              }
            )}

            {renderKey(
              'tan',
              () => handleInsertText('tan('),
              {
                shiftLabel: 'tan⁻¹',
                shiftAction: () => handleInsertText('atan('),
                alphaLabel: 'F',
                alphaAction: () => handleInsertText('F'),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200',
                title: 'Tangente (Shift: atan, Alpha: F)',
              }
            )}

            {renderKey(
              '(',
              () => handleInsertText('('),
              {
                shiftLabel: 'hyp',
                shiftAction: () => handleInsertText('sinh('),
                alphaLabel: 'X',
                alphaAction: () => handleInsertText('X'),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200 font-mono',
                title: 'Paréntesis ( (Shift: hyp, Alpha: X)',
              }
            )}

            {renderKey(
              ')',
              () => handleInsertText(')'),
              {
                shiftLabel: 'Σ',
                shiftAction: handleInsertLogBase,
                alphaLabel: 'Y',
                alphaAction: () => handleInsertText('Y'),
                className: 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200 font-mono',
                title: 'Paréntesis ) (Shift: Sumatoria, Alpha: Y)',
              }
            )}
          </div>

          {/* ROW 4: [7] [8] [9]   [%] [DEL] [AC] */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {renderKey(
              '7',
              () => handleInsertText('7'),
              {
                shiftLabel: 'CONST',
                shiftAction: () => setIsConstantsOpen(true),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '7 (Shift: Constantes científicas CONST)',
              }
            )}

            {renderKey(
              '8',
              () => handleInsertText('8'),
              {
                shiftLabel: 'CONV',
                shiftAction: () => setIsCalculationsOpen(true),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '8 (Shift: Conversión y cálculos)',
              }
            )}

            {renderKey(
              '9',
              () => handleInsertText('9'),
              {
                shiftLabel: 'CLR',
                shiftAction: handleClearAll,
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '9 (Shift: Limpiar pantalla)',
              }
            )}

            {/* % */}
            {renderKey(
              '%',
              () => handleInsertText('%'),
              {
                shiftLabel: 'abs',
                shiftAction: () => handleInsertText('abs('),
                className: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 font-bold',
                title: 'Porcentaje (Shift: Valor absoluto abs)',
              }
            )}

            {/* DEL */}
            {renderKey(
              'DEL',
              handleDelete,
              {
                shiftLabel: 'INS',
                shiftAction: handleInsertSlot,
                className: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 font-bold',
                title: 'Borrar (Shift: Insertar espacio/casilla INS)',
              }
            )}

            {/* AC */}
            {renderKey(
              'AC',
              handleClearAll,
              {
                shiftLabel: 'RESET',
                shiftAction: () => {
                  handleClearAll();
                  setMemoryM(0);
                  setLastAns(0);
                },
                className: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300 font-bold',
                title: 'Limpiar todo (AC) (Shift: Reiniciar memoria)',
              }
            )}
          </div>

          {/* ROW 5: [4] [5] [6]   [+] [-] [S<->D] */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {renderKey(
              '4',
              () => handleInsertText('4'),
              {
                alphaLabel: 'A',
                alphaAction: () => handleInsertText('A'),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '4 (Alpha: Variable A)',
              }
            )}

            {renderKey(
              '5',
              () => handleInsertText('5'),
              {
                alphaLabel: 'B',
                alphaAction: () => handleInsertText('B'),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '5 (Alpha: Variable B)',
              }
            )}

            {renderKey(
              '6',
              () => handleInsertText('6'),
              {
                alphaLabel: 'C',
                alphaAction: () => handleInsertText('C'),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '6 (Alpha: Variable C)',
              }
            )}

            {/* + */}
            {renderKey(
              '+',
              () => handleInsertText('+'),
              {
                shiftLabel: 'Pol',
                shiftAction: () => handleInsertText('pol('),
                className: 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 border-indigo-200 font-bold text-base',
                title: 'Suma (Shift: Conversión rectangular a polar Pol)',
              }
            )}

            {/* - */}
            {renderKey(
              '-',
              () => handleInsertText('-'),
              {
                shiftLabel: 'Rec',
                shiftAction: () => handleInsertText('rec('),
                className: 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 border-indigo-200 font-bold text-base',
                title: 'Resta (Shift: Conversión polar a rectangular Rec)',
              }
            )}

            {/* S ⇔ D */}
            {renderKey(
              'S ⇔ D',
              handleToggleSD,
              {
                shiftLabel: 'a b/c',
                shiftAction: () => setResultFormat((prev) => (prev === 'mixed' ? 'fraction' : 'mixed')),
                className: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 font-bold text-xs',
                title: 'Alternar Fracción ⇔ Decimal ⇔ Mixto (Shift: Formato mixto)',
              }
            )}
          </div>

          {/* ROW 6: [1] [2] [3]   [x] [/] [%] */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {renderKey(
              '1',
              () => handleInsertText('1'),
              {
                shiftLabel: '° \' "',
                shiftAction: () => handleInsertText('°'),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '1 (Shift: Grados/Min/Seg)',
              }
            )}

            {renderKey(
              '2',
              () => handleInsertText('2'),
              {
                shiftLabel: 'Rnd',
                shiftAction: () => handleInsertText('rnd('),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '2 (Shift: Redondeo Rnd)',
              }
            )}

            {renderKey(
              '3',
              () => handleInsertText('3'),
              {
                shiftLabel: 'x!',
                shiftAction: () => handleInsertText('!'),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '3 (Shift: Factorial x!)',
              }
            )}

            {/* × */}
            {renderKey(
              '×',
              () => handleInsertText('*'),
              {
                shiftLabel: 'nPr',
                shiftAction: () => handleInsertText(' nPr '),
                className: 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 border-indigo-200 font-bold text-base',
                title: 'Multiplicación (Shift: Permutaciones nPr)',
              }
            )}

            {/* ÷ */}
            {renderKey(
              '÷',
              () => handleInsertText('/'),
              {
                shiftLabel: 'nCr',
                shiftAction: () => handleInsertText(' nCr '),
                className: 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 border-indigo-200 font-bold text-base',
                title: 'División (Shift: Combinaciones nCr)',
              }
            )}

            {/* % */}
            {renderKey(
              '%',
              () => handleInsertText('%'),
              {
                shiftLabel: 'abs',
                shiftAction: () => handleInsertText('abs('),
                className: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 font-bold',
                title: 'Porcentaje (Shift: Valor absoluto)',
              }
            )}
          </div>

          {/* ROW 7: [0] [.] [×10ˣ]   [ANS] [=] [CONVERSOR] */}
          <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
            {renderKey(
              '0',
              () => handleInsertText('0'),
              {
                shiftLabel: 'Ran#',
                shiftAction: () => {
                  const rnd = (Math.round(Math.random() * 1000) / 1000).toString();
                  handleInsertText(rnd);
                },
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-base',
                title: '0 (Shift: Número aleatorio Ran#)',
              }
            )}

            {renderKey(
              '.',
              () => handleInsertText('.'),
              {
                shiftLabel: 'RanInt',
                shiftAction: () => handleInsertText('ranint('),
                className: 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-mono text-xl leading-none',
                title: 'Punto decimal (Shift: Entero aleatorio)',
              }
            )}

            {renderKey(
              '×10ˣ',
              () => handleInsertText('*10^('),
              {
                shiftLabel: 'π',
                shiftAction: () => handleInsertText('pi'),
                alphaLabel: 'e',
                alphaAction: () => handleInsertText('e'),
                className: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 font-bold text-xs',
                title: 'Exponente ×10ˣ (Shift: π, Alpha: e)',
              }
            )}

            {/* Ans */}
            {renderKey(
              'Ans',
              () => handleInsertText('Ans'),
              {
                shiftLabel: 'PreAns',
                shiftAction: () => handleInsertText('Ans'),
                longPressLabel: 'Copiar',
                onLongPress: handleCopyResult,
                className: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 font-bold text-xs',
                title: 'Ans (Clic: insertar Ans | Mantén presionado: Copiar resultado)',
              }
            )}

            {/* = */}
            {renderKey(
              '=',
              handleEvaluate,
              {
                shiftLabel: 'Historial',
                shiftAction: () => setIsHistoryOpen(true),
                longPressLabel: 'Historial',
                onLongPress: () => setIsHistoryOpen(true),
                className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-black text-2xl border border-indigo-600 shadow-xs',
                title: '= (Clic: Calcular | Mantén presionado: Abrir Historial)',
              }
            )}

            {/* CONVERSOR */}
            {renderKey(
              <div className="flex flex-col items-center leading-none text-center">
                <Compass className="w-3.5 h-3.5 mb-0.5 text-indigo-700" />
                <span className="text-[9.5px] font-extrabold uppercase tracking-tight">Conv</span>
              </div>,
              () => setIsCalculationsOpen(true),
              {
                shiftLabel: 'FÓRMULAS',
                shiftAction: () => setIsCalculationsOpen(true),
                className: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200 font-bold',
                title: 'Conversor y cálculos de Geometría y Física',
              }
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Constants Modal (CONST) */}
      <ConstantsModal
        isOpen={isConstantsOpen}
        onClose={() => setIsConstantsOpen(false)}
        onSelectConstant={(valStr) => handleInsertText(valStr)}
      />

      {/* 2. Geometric & Physical Calculations Modal (ÁREAS, PERÍMETROS, VOLÚMENES, TEMPERATURA) */}
      <GeometryAndPhysicsModal
        isOpen={isCalculationsOpen}
        onClose={() => setIsCalculationsOpen(false)}
        onInsertToCalc={(valStr) => handleInsertText(valStr)}
        onInsertToSheet={(concept, valStr) => {
          if (onInsertResult) {
            onInsertResult(valStr);
          }
        }}
      />
    </div>
  );
};
