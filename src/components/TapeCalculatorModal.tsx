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
  Edit2,
  Download,
  Eye,
  EyeOff,
  Tag,
  Clock,
} from 'lucide-react';
import { evaluateExpression } from '../utils/mathEvaluator';
import { formatNumber } from '../utils/currency';
import { useVirtualKeyboard } from '../utils/useVirtualKeyboard';
import { useLongPress } from '../utils/useLongPress';
import { encodeCalcAccountShare, CalcSharePayload } from '../utils/shareImporter';
import { ImportSharedModal } from './ImportSharedModal';
import { FunctionInfoModal, FunctionHelpInfo } from './FunctionInfoModal';
import { ShareTapeAccountModal } from './ShareTapeAccountModal';
import { BasicVariablesModal, BasicVariable } from './BasicVariablesModal';

interface TapeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertResult?: (result: string) => void;
  isInline?: boolean;
}

export interface TapeRow {
  id: string;
  description: string;
  expression: string;
}

export interface CalculatorAccount {
  id: string;
  name: string;
  rows: TapeRow[];
  createdAt: number;
}

const STORAGE_KEY_ACCOUNTS = 'tape_calculator_accounts';
const STORAGE_KEY_ACTIVE_ACCOUNT = 'tape_calculator_active_account_id';

const computeRowsTotal = (rowsList: TapeRow[]): number => {
  let runningAns = 0;
  for (let idx = 0; idx < rowsList.length; idx++) {
    const r = rowsList[idx];
    const trimmed = r.expression.trim();
    if (!trimmed) continue;
    let processed = trimmed;
    if (/^[+\-*/^%]/.test(trimmed)) {
      processed = `ans ${trimmed}`;
    }
    const res = evaluateExpression(processed, { ans: runningAns, Ans: runningAns, ANS: runningAns });
    if (res.isValid) {
      if (/^[+\-]/.test(trimmed)) {
        runningAns = res.value;
      } else if (/^[*/^%]/.test(trimmed) || trimmed.toLowerCase().includes('ans')) {
        runningAns = res.value;
      } else {
        runningAns = idx === 0 ? res.value : runningAns + res.value;
      }
    }
  }
  return runningAns;
};

const getInitialAccounts = (): CalculatorAccount[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading accounts from storage', e);
  }
  return [
    {
      id: 'acc_1',
      name: 'Cuenta 1',
      rows: [{ id: 'row_1', description: '', expression: '' }],
      createdAt: Date.now(),
    },
  ];
};

const getInitialActiveAccountId = (accs: CalculatorAccount[]): string => {
  try {
    const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ACCOUNT);
    if (savedId && accs.some((a) => a.id === savedId)) {
      return savedId;
    }
  } catch (e) {
    // fallback
  }
  return accs[0]?.id || 'acc_1';
};

interface TapeKeyButtonProps {
  label: React.ReactNode;
  onClick: () => void;
  onLongPress?: () => void;
  assignedVariable?: string;
  className?: string;
  title?: string;
}

const TapeKeyButton: React.FC<TapeKeyButtonProps> = ({
  label,
  onClick,
  onLongPress,
  assignedVariable,
  className = '',
  title,
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
          navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      onLongPress();
    }, 400);
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
    onClick();
  };

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
      className={`relative h-12 sm:h-14 min-h-[48px] sm:min-h-[56px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono active:scale-95 flex items-center justify-center select-none touch-manipulation overflow-visible ${className}`}
      title={title}
    >
      {/* Visual floating badge while holding */}
      {isPressing && assignedVariable && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 bg-indigo-900 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap animate-bounce pointer-events-none border border-indigo-400 flex items-center gap-1">
          <span>{assignedVariable}</span>
        </div>
      )}

      {/* Persistent corner badge showing which variable is assigned */}
      {assignedVariable && (
        <span className="absolute top-0.5 right-1 px-1 py-0.2 rounded bg-indigo-100 text-indigo-900 font-mono font-black text-[8px] sm:text-[9px] border border-indigo-200 pointer-events-none leading-none tracking-tight">
          {assignedVariable}
        </span>
      )}

      {/* Visual progress pulse while holding */}
      {isPressing && (
        <span className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-b-lg animate-[pulse_0.35s_ease-in-out_infinite]" />
      )}
      {label}
    </button>
  );
};

export const TapeCalculatorModal: React.FC<TapeCalculatorModalProps> = ({
  isOpen,
  onClose,
  onInsertResult,
  isInline = false,
}) => {
  const [accounts, setAccounts] = useState<CalculatorAccount[]>(getInitialAccounts);
  const [activeAccountId, setActiveAccountId] = useState<string>(() => getInitialActiveAccountId(accounts));
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState<string>('');
  const [accountToDelete, setAccountToDelete] = useState<CalculatorAccount | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const activeAccount = useMemo(() => {
    return (
      accounts.find((a) => a.id === activeAccountId) ||
      accounts[0] || {
        id: 'acc_1',
        name: 'Cuenta 1',
        rows: [{ id: 'row_1', description: '', expression: '' }],
        createdAt: Date.now(),
      }
    );
  }, [accounts, activeAccountId]);

  const rows = activeAccount.rows;

  // Persist accounts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {
      console.error('Error saving accounts to localStorage', e);
    }
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ACCOUNT, activeAccountId);
    } catch (e) {
      // ignore
    }
  }, [activeAccountId]);

  // Helper to update active account rows
  const setRows = (newRowsOrFn: TapeRow[] | ((prev: TapeRow[]) => TapeRow[])) => {
    setAccounts((prevAccounts) => {
      const currentAcc = prevAccounts.find((a) => a.id === activeAccount.id) || prevAccounts[0];
      const newRows =
        typeof newRowsOrFn === 'function' ? newRowsOrFn(currentAcc.rows) : newRowsOrFn;
      return prevAccounts.map((a) => (a.id === currentAcc.id ? { ...a, rows: newRows } : a));
    });
  };

  // Totals calculated for each account tab
  const accountTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    accounts.forEach((acc) => {
      totals[acc.id] = computeRowsTotal(acc.rows);
    });
    return totals;
  }, [accounts]);

  const [copiedTape, setCopiedTape] = useState(false);

  // Show / Hide Description Column State
  const [showDescriptionColumn, setShowDescriptionColumn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tape_show_description');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleShowDescription = () => {
    setShowDescriptionColumn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tape_show_description', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Basic Variables State & Modal
  const [basicVariables, setBasicVariables] = useState<BasicVariable[]>(() => {
    try {
      const saved = localStorage.getItem('tape_basic_variables');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { id: 'var_iva', name: 'IVA', valueExpression: '1.16', keyShortcut: '%', description: 'IVA 16%' },
    ];
  });

  const handleSaveBasicVariables = (vars: BasicVariable[]) => {
    setBasicVariables(vars);
    try {
      localStorage.setItem('tape_basic_variables', JSON.stringify(vars));
    } catch {
      // ignore
    }
  };

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isVariablesModalOpen, setIsVariablesModalOpen] = useState(false);

  // Variables map for expression evaluation
  const basicVarsMap = useMemo(() => {
    const map: Record<string, number> = {};
    basicVariables.forEach((v) => {
      let valStr = v.valueExpression.trim();
      if (valStr.endsWith('%')) {
        const num = parseFloat(valStr.slice(0, -1));
        map[v.name] = isNaN(num) ? 0 : num / 100;
        map[v.name.toLowerCase()] = isNaN(num) ? 0 : num / 100;
      } else {
        const num = parseFloat(valStr);
        map[v.name] = isNaN(num) ? 0 : num;
        map[v.name.toLowerCase()] = isNaN(num) ? 0 : num;
      }
    });
    return map;
  }, [basicVariables]);

  // Active focused row in basic mode
  const [activeRowId, setActiveRowId] = useState<string>(rows[0]?.id || '1');
  const isNativeKeyboardOpen = useVirtualKeyboard();

  // Input refs for automatic focus
  const exprInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [rowToDelete, setRowToDelete] = useState<{
    id: string;
    lineNum: number;
    description: string;
    expression: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && rows.length > 0) {
      const lastId = rows[rows.length - 1].id;
      setActiveRowId(lastId);
      setTimeout(() => {
        exprInputRefs.current[lastId]?.focus();
      }, 50);
    }
  }, [isOpen, activeAccountId]);

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

      const res = evaluateExpression(processed, {
        ...basicVarsMap,
        ans: runningAns,
        Ans: runningAns,
        ANS: runningAns,
      });
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
  }, [rows, basicVarsMap]);

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

  // Account Management Handlers
  const handleCreateAccount = () => {
    const newNum = accounts.length + 1;
    const newId = 'acc_' + Date.now();
    const newRowId = 'row_' + Date.now();
    const newAcc: CalculatorAccount = {
      id: newId,
      name: `Cuenta ${newNum}`,
      rows: [{ id: newRowId, description: '', expression: '' }],
      createdAt: Date.now(),
    };
    setAccounts((prev) => [...prev, newAcc]);
    setActiveAccountId(newId);
    setActiveRowId(newRowId);
    setTimeout(() => {
      exprInputRefs.current[newRowId]?.focus();
    }, 50);
  };

  const handleStartRenameAccount = (account: CalculatorAccount, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingAccountId(account.id);
    setEditingAccountName(account.name);
  };

  const handleSaveRenameAccount = (id: string) => {
    const trimmed = editingAccountName.trim();
    if (trimmed) {
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, name: trimmed } : acc))
      );
    }
    setEditingAccountId(null);
  };

  const handleRequestDeleteAccount = (account: CalculatorAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const hasData = account.rows.some((r) => r.expression.trim() || r.description.trim());
    if (hasData) {
      setAccountToDelete(account);
    } else {
      executeDeleteAccount(account.id);
    }
  };

  const executeDeleteAccount = (idToDelete: string) => {
    if (accounts.length <= 1) {
      const freshRowId = 'row_' + Date.now();
      const freshAcc: CalculatorAccount = {
        id: 'acc_' + Date.now(),
        name: 'Cuenta 1',
        rows: [{ id: freshRowId, description: '', expression: '' }],
        createdAt: Date.now(),
      };
      setAccounts([freshAcc]);
      setActiveAccountId(freshAcc.id);
      setActiveRowId(freshRowId);
      setAccountToDelete(null);
      return;
    }

    const remaining = accounts.filter((a) => a.id !== idToDelete);
    setAccounts(remaining);
    if (activeAccountId === idToDelete) {
      const nextActive = remaining[0];
      setActiveAccountId(nextActive.id);
      setActiveRowId(nextActive.rows[0]?.id || '');
    }
    setAccountToDelete(null);
  };

  // Import shared account handler
  const handleImportCalcAccount = (data: CalcSharePayload, mode: 'new' | 'replace') => {
    const importedRows: TapeRow[] = data.rows.map((r, i) => ({
      id: 'row_' + Date.now() + '_' + i,
      description: r.description || '',
      expression: r.expression || '',
    }));

    const rowsToSet =
      importedRows.length > 0
        ? importedRows
        : [{ id: 'row_' + Date.now(), description: '', expression: '' }];

    if (mode === 'replace') {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === activeAccount.id
            ? {
                ...acc,
                name: data.name || acc.name,
                rows: rowsToSet,
              }
            : acc
        )
      );
      const targetId = rowsToSet[rowsToSet.length - 1].id;
      setActiveRowId(targetId);
      setTimeout(() => {
        exprInputRefs.current[targetId]?.focus();
      }, 50);
    } else {
      const newAcc: CalculatorAccount = {
        id: 'acc_' + Date.now(),
        name: data.name || `Cuenta ${accounts.length + 1}`,
        rows: rowsToSet,
        createdAt: Date.now(),
      };
      setAccounts((prev) => [...prev, newAcc]);
      setActiveAccountId(newAcc.id);
      const targetId = rowsToSet[rowsToSet.length - 1].id;
      setActiveRowId(targetId);
      setTimeout(() => {
        exprInputRefs.current[targetId]?.focus();
      }, 50);
    }
  };

  // Smart Enter navigation:
  // If next row exists (even if empty/free), moves focus to the row below without creating an unnecessary row at the end!
  // Only appends a new row when pressing Enter on the last row.
  const handleTapeEnter = (fromIndex?: number) => {
    const currentIndex =
      fromIndex !== undefined ? fromIndex : rows.findIndex((r) => r.id === activeRowId);
    const validIndex = currentIndex >= 0 ? currentIndex : rows.length - 1;

    // If there is a row below, focus it
    if (validIndex < rows.length - 1) {
      const nextRow = rows[validIndex + 1];
      setActiveRowId(nextRow.id);
      setTimeout(() => {
        exprInputRefs.current[nextRow.id]?.focus();
      }, 30);
      return;
    }

    // On the last row: append a new row
    handleAddRow(validIndex);
  };

  // Keyboard navigation for basic mode
  const handleTapeKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter forces inserting a row right below
        handleAddRow(index);
      } else {
        handleTapeEnter(index);
      }
    } else if (e.key === 'ArrowDown') {
      if (index < rows.length - 1) {
        e.preventDefault();
        const nextId = rows[index + 1].id;
        setActiveRowId(nextId);
        exprInputRefs.current[nextId]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      if (index > 0) {
        e.preventDefault();
        const prevId = rows[index - 1].id;
        setActiveRowId(prevId);
        exprInputRefs.current[prevId]?.focus();
      }
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
  const formattedShareText = useMemo(() => {
    const code = encodeCalcAccountShare(activeAccount.name, activeAccount.rows);
    return code;
  }, [activeAccount]);

  const [helpInfo, setHelpInfo] = useState<FunctionHelpInfo | null>(null);

  const shareLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Compartir cuenta',
        badge: 'Calcu Básica',
        icon: <Share2 className="w-5 h-5 text-indigo-600" />,
        description:
          'Abre el panel para compartir la cuenta actual como imagen o texto formateado. Permite copiar la imagen del comprobante al portapapeles o enviarla por WhatsApp.',
        tips: [
          'Opción de Comprobante en Imagen con totales',
          'Opción de Texto con código de importación',
        ],
      });
    },
    onClick: () => setIsShareModalOpen(true),
  });

  const importLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Importar cuenta',
        badge: 'Calcu Básica',
        icon: <Download className="w-5 h-5 text-indigo-600" />,
        description:
          'Abre la ventana para cargar una cuenta compartida. Puedes pegar el texto completo recibido por mensajería o el código de cuenta, y se restaurarán todas las filas y operaciones.',
        tips: [
          'Detecta automáticamente códigos en el portapapeles',
          'Permite crear una nueva cuenta o sobrescribir la actual',
        ],
      });
    },
    onClick: () => setIsImportModalOpen(true),
  });

  const mostrarLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Mostrar / Ocultar Descripción',
        badge: 'Visualización',
        icon: <Eye className="w-5 h-5 text-blue-600" />,
        description:
          'Muestra u oculta la columna opcional de descripción para darle el máximo ancho posible a los montos y operaciones numéricas en pantalla.',
        tips: [
          'Oculta la descripción en celulares para escribir montos más cómodamente',
          'Pulsa de nuevo para volver a mostrar las descripciones',
        ],
      });
    },
    onClick: toggleShowDescription,
  });

  const varLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Variables (VAR)',
        badge: 'Personalización',
        icon: <Tag className="w-5 h-5 text-indigo-600" />,
        description:
          'Permite crear variables personalizadas (como IVA, DOLAR, PROPINA) y asignarlas a la pulsación larga de teclas del teclado básico.',
        tips: [
          'Mantén presionada la tecla asignada para insertar su valor al instante',
          'Úsalas en fórmulas como 100 * IVA o 50 * DOLAR',
        ],
      });
    },
    onClick: () => setIsVariablesModalOpen(true),
  });

  if (!isOpen) return null;

  return (
    <div
      id="calculator-modal"
      className={
        isInline
          ? 'w-full h-full max-h-full rounded-xl border border-slate-200 shadow-xs flex flex-col min-h-0 overflow-hidden select-none bg-white text-slate-800'
          : 'fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden select-none bg-white text-slate-800'
      }
    >
      {/* Header: Only shown if modal is opened standalone with close button */}
      {!isInline && (
        <div className="flex items-center justify-end px-3 sm:px-6 py-2 border-b border-slate-200 bg-slate-50 text-slate-900 shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-200"
            title="Cerrar calculadora"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* BASIC LINE CALCULATOR (Full screen Excel-like with automatic focus on Monto) */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full max-w-4xl mx-auto h-full">
          {/* CUENTAS TABS BAR */}
          <div className="bg-slate-100/90 border-b border-slate-200 px-2 sm:px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              Cuentas:
            </span>
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccount.id;
              const isEditing = editingAccountId === acc.id;
              const total = accountTotals[acc.id] || 0;

              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    if (!isActive) {
                      setActiveAccountId(acc.id);
                      const targetId = acc.rows[acc.rows.length - 1]?.id || acc.rows[0]?.id;
                      if (targetId) {
                        setActiveRowId(targetId);
                        setTimeout(() => exprInputRefs.current[targetId]?.focus(), 40);
                      }
                    }
                  }}
                  onDoubleClick={(e) => handleStartRenameAccount(acc, e)}
                  className={`group flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border shrink-0 ${
                    isActive
                      ? 'bg-white text-indigo-900 border-indigo-200 shadow-2xs ring-1 ring-indigo-500/20'
                      : 'bg-slate-200/70 hover:bg-slate-200 text-slate-700 border-transparent'
                  }`}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingAccountName}
                      onChange={(e) => setEditingAccountName(e.target.value)}
                      onBlur={() => handleSaveRenameAccount(acc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRenameAccount(acc.id);
                        if (e.key === 'Escape') setEditingAccountId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-24 bg-white border border-indigo-400 rounded px-1 py-0.5 text-xs font-bold text-slate-900 outline-none"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRenameAccount(acc, e);
                        }}
                        className="truncate max-w-[120px] font-bold cursor-pointer hover:underline"
                        title="Haz clic para cambiar el nombre"
                      >
                        {acc.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-indigo-100 text-indigo-800 font-bold'
                            : 'bg-slate-300/70 text-slate-600'
                        }`}
                      >
                        ${formatNumber(total, 2)}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleRequestDeleteAccount(acc, e)}
                    className={`p-0.5 rounded transition-colors cursor-pointer ${
                      isActive
                        ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-300'
                    }`}
                    title="Cerrar cuenta"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Nueva Cuenta Button */}
            <button
              type="button"
              onClick={handleCreateAccount}
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95"
              title="Crear nueva cuenta"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva cuenta</span>
            </button>
          </div>

          {/* Scrollable Rows Table */}
          <div className="p-2 sm:p-3 overflow-y-auto flex-1 min-h-0 bg-slate-50/50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="w-8 py-1.5 px-1 text-center">#</th>
                  {showDescriptionColumn && (
                    <th className="py-1.5 px-2">Descripción (opcional)</th>
                  )}
                  <th className="py-1.5 px-2 flex-1">Monto / Operación</th>
                  <th className="w-28 sm:w-36 py-1.5 px-2 text-right">Subtotal</th>
                  <th className="w-14 sm:w-16 py-1.5 text-center"></th>
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

                      {/* DESCRIPCIÓN (Opcional) */}
                      {showDescriptionColumn && (
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
                      )}

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

                      {/* ACTIONS: INSERT ROW BELOW / DELETE ROW */}
                      <td className="py-1.5 px-1 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddRow(idx);
                            }}
                            className="text-slate-300 hover:text-indigo-600 p-1 rounded transition-colors cursor-pointer"
                            title="Insertar fila debajo (+)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
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
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Basic Calculator Summary Bar (Compartir cuenta, Importar, Mostrar, VAR y Total en la misma línea) */}
          <div className="bg-white px-2 sm:px-3 py-1.5 border-t border-b border-slate-200 flex items-center justify-between gap-1 sm:gap-1.5 shrink-0 flex-nowrap overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                {...shareLongPress.handlers}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                title="Compartir cuenta en Imagen o Texto (Mantén presionado para ver qué hace)"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                <span>Compartir</span>
              </button>

              <button
                type="button"
                {...importLongPress.handlers}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200 shadow-2xs active:scale-95 whitespace-nowrap"
                title="Importar cuenta (Mantén presionado para ver qué hace)"
              >
                <Download className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                <span>Importar</span>
              </button>

              {/* Botón Mostrar u ocultar columna Descripción */}
              <button
                type="button"
                {...mostrarLongPress.handlers}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap border ${
                  showDescriptionColumn
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                }`}
                title="Mostrar u ocultar columna Descripción (Mantén presionado para ver qué hace)"
              >
                {showDescriptionColumn ? (
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Mostrar</span>
              </button>

              {/* Botón VAR para variables */}
              <button
                type="button"
                {...varLongPress.handlers}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200 shadow-2xs active:scale-95 whitespace-nowrap"
                title="Crear y asignar variables a teclas (Mantén presionado para ver qué hace)"
              >
                <Tag className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                <span>VAR</span>
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 sm:px-3 py-1 flex items-center gap-1.5 sm:gap-2 shadow-2xs shrink-0 whitespace-nowrap">
              <span className="text-xs font-bold text-indigo-900">Total:</span>
              <span className="text-sm sm:text-base font-mono font-extrabold text-indigo-900">
                {formatNumber(grandTotal, 2)}
              </span>
            </div>
          </div>

          {/* Basic Keypad with DEL, AC, Clear All and cursor-position insertion */}
          {!isNativeKeyboardOpen && (
            <div className="p-2 sm:p-3 bg-slate-100 border-t border-slate-200 shrink-0 select-none">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2 max-w-2xl mx-auto">
                {/* Row 1: (, ), %, AC, DEL */}
                <TapeKeyButton
                  label="("
                  onClick={() => handleInsertBasicToken('(')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === '(')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === '(')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === '(')!.name)
                      : undefined
                  }
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs"
                  title="Paréntesis abrir ("
                />

                <TapeKeyButton
                  label=")"
                  onClick={() => handleInsertBasicToken(')')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === ')')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === ')')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === ')')!.name)
                      : undefined
                  }
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs"
                  title="Paréntesis cerrar )"
                />

                <TapeKeyButton
                  label="%"
                  onClick={() => handleInsertBasicToken('%')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === '%')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === '%')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === '%')!.name)
                      : undefined
                  }
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs"
                  title="Porcentaje %"
                />

                <TapeKeyButton
                  label="AC"
                  onClick={() => handleInsertBasicToken('AC')}
                  className="bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold"
                  title="Borrar entrada actual (AC)"
                />

                <TapeKeyButton
                  label="DEL"
                  onClick={() => handleInsertBasicToken('DEL')}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold"
                  title="Borrar carácter (DEL)"
                />

                {/* Row 2: 7, 8, 9, ÷, × */}
                {['7', '8', '9', '/', '*'].map((btn) => {
                  const assigned = basicVariables.find((v) => v.keyShortcut === btn);
                  const isOp = btn === '/' || btn === '*';
                  return (
                    <TapeKeyButton
                      key={btn}
                      label={btn === '/' ? '÷' : btn === '*' ? '×' : btn}
                      onClick={() => handleInsertBasicToken(btn)}
                      assignedVariable={assigned?.name}
                      onLongPress={
                        assigned
                          ? () => handleInsertBasicToken(assigned.name)
                          : undefined
                      }
                      className={
                        isOp
                          ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-lg sm:text-xl border border-indigo-200'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs text-base sm:text-lg'
                      }
                      title={assigned ? `Tecla ${btn} (Mantén pulsada para escribir ${assigned.name})` : `Tecla ${btn}`}
                    />
                  );
                })}

                {/* Row 3: 4, 5, 6, -, + */}
                {['4', '5', '6', '-', '+'].map((btn) => {
                  const assigned = basicVariables.find((v) => v.keyShortcut === btn);
                  const isOp = btn === '-' || btn === '+';
                  return (
                    <TapeKeyButton
                      key={btn}
                      label={btn}
                      onClick={() => handleInsertBasicToken(btn)}
                      assignedVariable={assigned?.name}
                      onLongPress={
                        assigned
                          ? () => handleInsertBasicToken(assigned.name)
                          : undefined
                      }
                      className={
                        isOp
                          ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-lg sm:text-xl border border-indigo-200'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs text-base sm:text-lg'
                      }
                      title={assigned ? `Tecla ${btn} (Mantén pulsada para escribir ${assigned.name})` : `Tecla ${btn}`}
                    />
                  );
                })}

                {/* Row 4: 1, 2, 3, Ans, Limpiar Todo */}
                {['1', '2', '3'].map((btn) => {
                  const assigned = basicVariables.find((v) => v.keyShortcut === btn);
                  return (
                    <TapeKeyButton
                      key={btn}
                      label={btn}
                      onClick={() => handleInsertBasicToken(btn)}
                      assignedVariable={assigned?.name}
                      onLongPress={
                        assigned
                          ? () => handleInsertBasicToken(assigned.name)
                          : undefined
                      }
                      className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs text-base sm:text-lg"
                      title={assigned ? `Tecla ${btn} (Mantén pulsada para escribir ${assigned.name})` : `Tecla ${btn}`}
                    />
                  );
                })}

                <TapeKeyButton
                  label="Ans"
                  onClick={() => handleInsertBasicToken('ans')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === 'Ans')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === 'Ans')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === 'Ans')!.name)
                      : undefined
                  }
                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xs sm:text-sm font-bold border border-indigo-200"
                  title="Último resultado Ans"
                />

                <TapeKeyButton
                  label={
                    <div className="flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpiar</span>
                    </div>
                  }
                  onClick={handleClearAllTape}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-sans font-bold shadow-2xs"
                  title="Limpiar todas las filas de la cuenta"
                />

                {/* Row 5: 00, 0, ., +, ↵ Enter */}
                <TapeKeyButton
                  label="00"
                  onClick={() => handleInsertBasicToken('00')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === '00')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === '00')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === '00')!.name)
                      : undefined
                  }
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs"
                  title="Doble cero 00"
                />

                <TapeKeyButton
                  label="0"
                  onClick={() => handleInsertBasicToken('0')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === '0')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === '0')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === '0')!.name)
                      : undefined
                  }
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs text-base sm:text-lg"
                  title="Cero 0"
                />

                <TapeKeyButton
                  label="."
                  onClick={() => handleInsertBasicToken('.')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === '.')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === '.')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === '.')!.name)
                      : undefined
                  }
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs text-base sm:text-lg"
                  title="Punto decimal ."
                />

                <TapeKeyButton
                  label="+"
                  onClick={() => handleInsertBasicToken('+')}
                  assignedVariable={basicVariables.find((v) => v.keyShortcut === '+')?.name}
                  onLongPress={
                    basicVariables.find((v) => v.keyShortcut === '+')
                      ? () => handleInsertBasicToken(basicVariables.find((v) => v.keyShortcut === '+')!.name)
                      : undefined
                  }
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-lg sm:text-xl font-bold border border-indigo-200"
                  title="Suma +"
                />

                <TapeKeyButton
                  label="↵ Enter"
                  onClick={() => handleTapeEnter()}
                  className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs sm:text-sm font-bold shadow-xs"
                  title="Siguiente fila / Nueva fila (Enter)"
                />
              </div>
            </div>
          )}
        </div>

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

      {/* MODAL DE CONFIRMACIÓN PARA CERRAR/ELIMINAR CUENTA */}
      {accountToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 flex flex-col gap-3 animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="p-2 rounded-lg bg-rose-100 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-slate-900">¿Cerrar "{accountToDelete.name}"?</h4>
                <p className="text-[11px] text-slate-500">
                  Total acumulado: ${formatNumber(accountTotals[accountToDelete.id] || 0, 2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Esta cuenta contiene datos. ¿Deseas cerrarla y eliminar sus filas de la memoria?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeDeleteAccount(accountToDelete.id)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Sí, cerrar cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPARTIR CUENTA EN IMAGEN O TEXTO */}
      <ShareTapeAccountModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        accountName={activeAccount.name}
        rows={computedTapeRows}
        grandTotal={grandTotal}
        shareCode={formattedShareText}
      />

      {/* MODAL DE VARIABLES DE LA CALCULADORA BÁSICA */}
      <BasicVariablesModal
        isOpen={isVariablesModalOpen}
        onClose={() => setIsVariablesModalOpen(false)}
        variables={basicVariables}
        onSaveVariables={handleSaveBasicVariables}
        onInsertVariable={(varName) => handleInsertBasicToken(varName)}
      />

      {/* MODAL DE IMPORTAR INFORMACIÓN COMPARTIDA */}
      <ImportSharedModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        context="calculator"
        onImportCalcAccount={handleImportCalcAccount}
      />

      {/* MODAL DE INFORMACIÓN DE FUNCIONES EN PULSACIÓN LARGA */}
      <FunctionInfoModal
        info={helpInfo}
        onClose={() => setHelpInfo(null)}
      />
    </div>
  );
};

