import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  Users,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Share2,
  Tag,
} from 'lucide-react';
import {
  Sheet,
  SheetRow,
  ComputedRow,
  ComputedSheetTotals,
  Currency,
  RatesState,
  AppSettings,
} from '../types';
import {
  ALL_CURRENCIES,
  CURRENCY_CONFIG,
  formatCurrency,
  formatNumber,
} from '../utils/currency';
import { parseVariableDeclaration } from '../utils/variableParser';

interface SpreadsheetTableProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSelectSheet: (id: string) => void;
  onCreateSheet: () => void;
  onRenameSheet: (id: string, newTitle: string) => void;
  onDeleteSheet: (id: string) => void;
  onDuplicateSheet: (id: string) => void;
  sheet: Sheet;
  computedRows: ComputedRow[];
  totals: ComputedSheetTotals;
  rates: RatesState;
  settings: AppSettings;
  onUpdateRow: (rowId: string, updates: Partial<SheetRow>) => void;
  onAddRow: (row?: Partial<SheetRow>, afterRowId?: string) => string | void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onClearRows: () => void;
  onOpenScientificKeypad?: (rowId?: string) => void;
  activeRowId: string | null;
  setActiveRowId: (id: string | null) => void;
  onOpenExportReport?: () => void;
  onOpenTapeCalculator?: () => void;
  onOpenQuickConverter?: () => void;
  onInsertExpression?: (text: string) => void;
  onUpdateSheetMembers?: (members: string[]) => void;
  onToggleSheetTricount?: (isActive: boolean) => void;
  onOpenClosedSheets?: () => void;
  closedSheetsCount?: number;
}

export const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  sheets,
  activeSheetId,
  onSelectSheet,
  onCreateSheet,
  onRenameSheet,
  onDeleteSheet,
  sheet,
  computedRows,
  totals,
  rates,
  settings,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
  onClearRows,
  activeRowId,
  setActiveRowId,
  onOpenExportReport,
  onUpdateSheetMembers,
  onToggleSheetTricount,
  onOpenClosedSheets,
  closedSheetsCount = 0,
}) => {
  const [editingSheetTitle, setEditingSheetTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(sheet.title);

  // In-app confirmation and modal states
  const [confirmDeleteSheetId, setConfirmDeleteSheetId] = useState<string | null>(null);
  const [confirmClearRows, setConfirmClearRows] = useState(false);
  const [confirmCloseActiveSheet, setConfirmCloseActiveSheet] = useState(false);
  const [isTricountModalOpen, setIsTricountModalOpen] = useState(false);
  const [selectingPayerRowId, setSelectingPayerRowId] = useState<string | null>(null);
  const [selectingCurrencyRowId, setSelectingCurrencyRowId] = useState<string | null>(null);
  const [rowToDelete, setRowToDelete] = useState<{
    id: string;
    index: number;
    concept: string;
    expression: string;
    currency: Currency;
  } | null>(null);

  // Column visibility states
  const [showDisplayColumn, setShowDisplayColumn] = useState(true);
  const [showPaymentColumn, setShowPaymentColumn] = useState(true);

  // Inline Tricount quick member add
  const [newMemberName, setNewMemberName] = useState('');
  const [quickPayerName, setQuickPayerName] = useState('');
  const [copiedTricount, setCopiedTricount] = useState(false);

  // Helper to add row below and auto-focus its amount input
  const handleEnterAddRow = (currentRowId: string) => {
    const newId = onAddRow(undefined, currentRowId);
    if (newId && typeof newId === 'string') {
      setTimeout(() => {
        const el = document.getElementById(`amount-input-${newId}`) as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
        }
      }, 40);
    }
  };

  // Local or sheet-persisted tricount toggle state
  const isTricountActive = sheet.isTricountActive ?? (sheet.members && sheet.members.length > 0);

  React.useEffect(() => {
    setTempTitle(sheet.title);
    setEditingSheetTitle(false);
    setConfirmCloseActiveSheet(false);
    setConfirmClearRows(false);
    setConfirmDeleteSheetId(null);
  }, [sheet.id, sheet.title]);

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onRenameSheet(sheet.id, tempTitle.trim());
    } else {
      setTempTitle(sheet.title);
    }
    setEditingSheetTitle(false);
  };

  const displayConfig = CURRENCY_CONFIG[settings.displayCurrency];
  const paymentConfig = CURRENCY_CONFIG[settings.paymentCurrency];
  const members = sheet.members || [];

  // Handle adding member to active sheet
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMemberName.trim();
    if (!name) return;
    if (members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      setNewMemberName('');
      return;
    }
    const updated = [...members, name];
    if (onUpdateSheetMembers) {
      onUpdateSheetMembers(updated);
    }
    setNewMemberName('');
  };

  const handleRemoveMember = (name: string) => {
    const updated = members.filter((m) => m !== name);
    if (onUpdateSheetMembers) {
      onUpdateSheetMembers(updated);
    }
  };

  const handleToggleTricount = () => {
    const nextState = !isTricountActive;
    if (onToggleSheetTricount) {
      onToggleSheetTricount(nextState);
    } else if (onUpdateSheetMembers && nextState && members.length === 0) {
      onUpdateSheetMembers(['Yo', 'Amigo 1']);
    }
  };

  // Compute Active Sheet Tricount Settlement
  const settleCurrency = settings.displayCurrency;
  const tricountStats = useMemo(() => {
    if (members.length === 0) {
      return {
        totalSharedExpense: 0,
        fairShare: 0,
        paidByPerson: {} as Record<string, number>,
        balances: {} as Record<string, number>,
        transfers: [] as Array<{
          from: string;
          to: string;
          amount: number;
          amountsInAllCurrencies: Record<Currency, number>;
        }>,
      };
    }

    const paidByPerson: Record<string, number> = {};
    members.forEach((m) => {
      paidByPerson[m] = 0;
    });

    let totalSharedExpense = 0;

    computedRows.forEach((row) => {
      if (!row.isValid) return;
      const rowAmtInSettle = row.equivalents[settleCurrency];
      if (rowAmtInSettle <= 0) return; // Only expenses/purchases count for splitting

      const payer = row.payer && members.includes(row.payer) ? row.payer : members[0];
      paidByPerson[payer] = (paidByPerson[payer] || 0) + rowAmtInSettle;
      totalSharedExpense += rowAmtInSettle;
    });

    const fairShare = members.length > 0 ? totalSharedExpense / members.length : 0;
    const balances: Record<string, number> = {};
    members.forEach((m) => {
      balances[m] = (paidByPerson[m] || 0) - fairShare;
    });

    const debtors: Array<{ name: string; balance: number }> = [];
    const creditors: Array<{ name: string; balance: number }> = [];

    members.forEach((m) => {
      const bal = balances[m] || 0;
      if (bal < -0.001) {
        debtors.push({ name: m, balance: Math.abs(bal) });
      } else if (bal > 0.001) {
        creditors.push({ name: m, balance: bal });
      }
    });

    const transfers: Array<{
      from: string;
      to: string;
      amount: number;
      amountsInAllCurrencies: Record<Currency, number>;
    }> = [];

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const transferAmt = Math.min(debtor.balance, creditor.balance);

      if (transferAmt > 0.001) {
        const amtInVES =
          settleCurrency === 'VES'
            ? transferAmt
            : transferAmt * (rates[settleCurrency]?.rateToVES || 1);

        transfers.push({
          from: debtor.name,
          to: creditor.name,
          amount: transferAmt,
          amountsInAllCurrencies: {
            USD: amtInVES / (rates.USD?.rateToVES || 1),
            VES: amtInVES,
            EUR: amtInVES / (rates.EUR?.rateToVES || 1),
            USDT: amtInVES / (rates.USDT?.rateToVES || 1),
          },
        });
      }

      debtor.balance -= transferAmt;
      creditor.balance -= transferAmt;

      if (debtor.balance <= 0.001) dIdx++;
      if (creditor.balance <= 0.001) cIdx++;
    }

    return {
      totalSharedExpense,
      fairShare,
      paidByPerson,
      balances,
      transfers,
    };
  }, [members, computedRows, settleCurrency, rates]);

  const handleCopyTricountReport = () => {
    let text = `👥 *TRICOUNT / GASTOS COMPARTIDOS*\n`;
    text += `📂 *Cuenta:* ${sheet.title}\n`;
    text += `💰 *Gasto Total:* ${formatCurrency(tricountStats.totalSharedExpense, settleCurrency, settings.decimals)}\n`;
    text += `🤝 *Cuota por persona:* ${formatCurrency(tricountStats.fairShare, settleCurrency, settings.decimals)}\n`;
    text += `───────────────────────────\n`;
    text += `📊 *PAGOS REALIZADOS:*\n`;
    members.forEach((m) => {
      const paid = tricountStats.paidByPerson[m] || 0;
      const bal = tricountStats.balances[m] || 0;
      const status =
        bal > 0.01
          ? `(recibe +${formatCurrency(bal, settleCurrency, settings.decimals)})`
          : bal < -0.01
          ? `(debe ${formatCurrency(Math.abs(bal), settleCurrency, settings.decimals)})`
          : `(al día)`;
      text += `• *${m}*: pagó ${formatCurrency(paid, settleCurrency, settings.decimals)} ${status}\n`;
    });

    text += `───────────────────────────\n`;
    text += `💸 *LIQUIDACIÓN: ¿QUIÉN LE DEBE A QUIÉN?*\n`;
    if (tricountStats.transfers.length === 0) {
      text += `✅ Todos están al día, no hay transferencias pendientes.\n`;
    } else {
      tricountStats.transfers.forEach((t, i) => {
        text += `${i + 1}. *${t.from}* le debe pagar a *${t.to}*:\n`;
        text += `   • $ ${formatNumber(t.amountsInAllCurrencies.USD, 2)}\n`;
        text += `   • Bs ${formatNumber(t.amountsInAllCurrencies.VES, 2)}\n`;
        text += `   • USDT ${formatNumber(t.amountsInAllCurrencies.USDT, 2)}\n`;
        text += `   • € ${formatNumber(t.amountsInAllCurrencies.EUR, 2)}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedTricount(true);
    setTimeout(() => setCopiedTricount(false), 2000);
  };

  // 2 Secondary currencies for Row 2 of Column 2 conversion display
  const secondaryCurrencies = useMemo(() => {
    const primary = [settings.displayCurrency, settings.paymentCurrency];
    const uniquePrimary = Array.from(new Set(primary));
    const remaining = ALL_CURRENCIES.filter((c) => !uniquePrimary.includes(c));
    if (uniquePrimary.length === 1) {
      return [remaining[0] || 'VES', remaining[1] || 'EUR'];
    }
    return [remaining[0] || 'USDT', remaining[1] || 'EUR'];
  }, [settings.displayCurrency, settings.paymentCurrency]);

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm w-full overflow-hidden">
      {/* 1. Spreadsheet Header: Sheet Tabs like Google Sheets */}
      <div className="bg-slate-100 border-b border-slate-200 px-2 sm:px-3 pt-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-0">
          {sheets.map((s) => {
            const isCurrent = s.id === activeSheetId;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSheet(s.id)}
                className={`group px-3 py-1.5 rounded-t-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-t border-x transition-all select-none ${
                  isCurrent
                    ? 'bg-white border-slate-200 text-blue-700 shadow-2xs font-bold'
                    : 'bg-slate-200/70 border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-[140px]">{s.title}</span>

                {/* Close Tab Button */}
                {sheets.length > 1 && isCurrent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteSheetId(s.id);
                    }}
                    className="opacity-60 hover:opacity-100 hover:text-rose-600 p-0.5 rounded transition-opacity cursor-pointer"
                    title="Cerrar esta hoja"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            id="add-sheet-tab-btn"
            onClick={onCreateSheet}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors ml-1 cursor-pointer"
            title="Añadir nueva cuenta u hoja"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons on tab right side: Cuentas Cerradas */}
        <div className="flex items-center gap-1 pb-1.5 shrink-0">
          {onOpenClosedSheets && (
            <button
              onClick={onOpenClosedSheets}
              className="text-[11px] font-semibold text-slate-600 hover:text-amber-700 px-2 py-0.5 rounded hover:bg-slate-200/70 transition-colors cursor-pointer flex items-center gap-1"
              title="Ver y reabrir cuentas cerradas"
            >
              <span>Cerradas ({closedSheetsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialogs in-app */}
      {confirmDeleteSheetId && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>¿Estás seguro de cerrar/eliminar esta hoja?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onDeleteSheet(confirmDeleteSheetId);
                setConfirmDeleteSheetId(null);
              }}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded cursor-pointer"
            >
              Sí, cerrar
            </button>
            <button
              onClick={() => setConfirmDeleteSheetId(null)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 2. Sheet Title & Direct Account Controls Bar (With Tricount right beside Cerrar cuenta) */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {editingSheetTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') {
                    setTempTitle(sheet.title);
                    setEditingSheetTitle(false);
                  }
                }}
                autoFocus
                className="w-full bg-slate-50 border border-blue-500 rounded px-2 py-0.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setTempTitle(sheet.title);
                  setEditingSheetTitle(false);
                }}
                className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                {sheet.title}
              </span>
              <button
                onClick={() => setEditingSheetTitle(true)}
                className="text-slate-400 hover:text-blue-600 p-0.5 transition-colors cursor-pointer"
                title="Renombrar hoja"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls: Tricount Button + Cerrar Cuenta Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* TRICOUNT BUTTON INSIDE ACCOUNT */}
          <button
            id="tricount-account-btn"
            onClick={() => setIsTricountModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              isTricountActive
                ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-500'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Abrir opciones de Tricount y liquidación"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isTricountActive ? `Tricount (${members.length})` : '+ Tricount'}</span>
          </button>

          {/* TOGGLES PARA MOSTRAR / OCULTAR COLUMNAS MOSTRAR Y PAGAR */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 sm:pl-2">
            <button
              type="button"
              onClick={() => {
                if (showDisplayColumn && !showPaymentColumn) return;
                setShowDisplayColumn((prev) => !prev);
              }}
              className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer border ${
                showDisplayColumn
                  ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70'
              }`}
              title="Mostrar u ocultar columna Mostrar"
            >
              Col. Mostrar
            </button>
            <button
              type="button"
              onClick={() => {
                if (showPaymentColumn && !showDisplayColumn) return;
                setShowPaymentColumn((prev) => !prev);
              }}
              className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer border ${
                showPaymentColumn
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70'
              }`}
              title="Mostrar u ocultar columna Pagar"
            >
              Col. Pagar
            </button>
          </div>

          {/* CERRAR CUENTA BUTTON */}
          {confirmCloseActiveSheet ? (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded px-2 py-0.5 text-[11px]">
              <span className="text-rose-800 font-medium">¿Cerrar cuenta?</span>
              <button
                onClick={() => {
                  onDeleteSheet(sheet.id);
                  setConfirmCloseActiveSheet(false);
                }}
                className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded hover:bg-rose-700 cursor-pointer"
              >
                Sí
              </button>
              <button
                onClick={() => setConfirmCloseActiveSheet(false)}
                className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              id="close-account-btn"
              onClick={() => setConfirmCloseActiveSheet(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Cerrar esta cuenta"
            >
              <X className="w-3 h-3 text-rose-500" />
              <span className="hidden sm:inline">Cerrar cuenta</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. EXCEL-STYLE 1-ROW SPREADSHEET TABLE */}
      <div className="w-full overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-300px)]">
        {computedRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 border-b border-slate-200">
            <span>No hay operaciones en esta cuenta.</span>
            <button
              onClick={() => onAddRow()}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar la primera fila</span>
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse border border-slate-300 text-xs table-fixed">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col
                style={{
                  width:
                    showDisplayColumn && showPaymentColumn
                      ? isTricountActive ? '45%' : '51%'
                      : showDisplayColumn || showPaymentColumn
                      ? isTricountActive ? '62%' : '70%'
                      : isTricountActive ? '85%' : '95%',
                }}
              />
              {showDisplayColumn && (
                <col
                  style={{
                    width:
                      showPaymentColumn
                        ? isTricountActive ? '20%' : '22%'
                        : isTricountActive ? '23%' : '25%',
                  }}
                />
              )}
              {showPaymentColumn && (
                <col
                  style={{
                    width:
                      showDisplayColumn
                        ? isTricountActive ? '20%' : '22%'
                        : isTricountActive ? '23%' : '25%',
                  }}
                />
              )}
              {isTricountActive && <col style={{ width: '10%' }} />}
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sm:text-[11px] select-none">
                <th className="border border-slate-300 px-0.5 py-1.5 text-center">
                  #
                </th>
                <th className="border border-slate-300 px-1.5 sm:px-2 py-1.5 text-left truncate">
                  Descripción y Monto
                </th>
                {showDisplayColumn && (
                  <th className="border border-slate-300 px-1 py-1.5 text-right truncate">
                    Mostrar ({settings.displayCurrency})
                  </th>
                )}
                {showPaymentColumn && (
                  <th className="border border-slate-300 px-1 py-1.5 text-right truncate">
                    Pagar ({settings.paymentCurrency})
                  </th>
                )}
                {isTricountActive && (
                  <th className="border border-slate-300 px-0.5 py-1.5 text-center text-emerald-800 text-[10px] sm:text-[11px] truncate" title="Tricount">
                    Tricount
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {computedRows.map((row, index) => {
                const isSelected = activeRowId === row.id;
                const isExpense = row.evaluatedValue < 0;

                // Check if concept has variable declaration like `@tasa = "120"`
                const varDecl = parseVariableDeclaration(row.concept);
                // Check if concept references variables like `@iva` or `@tasa`
                const varRefs = row.concept.match(/@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/gi);

                return (
                  <tr
                    key={row.id}
                    onClick={() => setActiveRowId(row.id)}
                    className={`border-b border-slate-300 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/40'
                        : index % 2 === 0
                        ? 'bg-white hover:bg-slate-50/50'
                        : 'bg-slate-50/30 hover:bg-slate-50/80'
                    }`}
                  >
                    {/* COLUMNA 1 (5%): ID (#) Y BOTÓN BORRAR ULTRA COMPACTO */}
                    <td className="border border-slate-300 p-0.5 text-center font-mono font-bold text-slate-500 bg-slate-100/60 align-middle">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-600">#{index + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRowToDelete({
                              id: row.id,
                              index: index + 1,
                              concept: row.concept,
                              expression: row.expression,
                              currency: row.currency,
                            });
                          }}
                          className="p-0.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Borrar fila"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* COLUMNA 2: DESCRIPCIÓN Y MONTO EN 1 FILA COMPACTA */}
                    <td className="border border-slate-300 p-1 align-middle">
                      <div className="flex items-center gap-1 w-full min-w-0">
                        {/* Campo Descripción */}
                        <div className="flex-1 flex items-center gap-1 min-w-0">
                          <input
                            type="text"
                            value={row.concept}
                            onChange={(e) => onUpdateRow(row.id, { concept: e.target.value })}
                            onFocus={() => setActiveRowId(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleEnterAddRow(row.id);
                              }
                            }}
                            placeholder="Descripción"
                            className="w-full bg-transparent px-1.5 py-0.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded font-medium border border-transparent focus:border-blue-300"
                          />

                          {/* Variable Badge */}
                          {varDecl && (
                            <span className="inline-flex items-center gap-0.5 bg-teal-50 border border-teal-200 text-teal-800 px-1 py-0.5 rounded text-[9px] font-mono font-bold shrink-0">
                              <Tag className="w-2 h-2 text-teal-600" />
                              <span>@{varDecl.name}={varDecl.evaluatedValue}</span>
                            </span>
                          )}

                          {!varDecl && varRefs && varRefs.length > 0 && (
                            <span className="hidden md:inline-flex bg-indigo-50 border border-indigo-200 text-indigo-700 px-1 py-0.5 rounded text-[9px] font-mono font-bold shrink-0">
                              {varRefs[0]}
                            </span>
                          )}
                        </div>

                        {/* Campo Monto + Botón Modal de Divisa (Solo Símbolos) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            id={`amount-input-${row.id}`}
                            type="text"
                            value={row.expression}
                            onChange={(e) => onUpdateRow(row.id, { expression: e.target.value })}
                            onFocus={() => setActiveRowId(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleEnterAddRow(row.id);
                              }
                            }}
                            placeholder="0"
                            className={`w-14 sm:w-20 bg-white px-1.5 py-0.5 text-xs sm:text-sm font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-blue-500 rounded border transition-all ${
                              !row.isValid
                                ? 'border-rose-400 text-rose-600 bg-rose-50'
                                : 'border-slate-300 text-slate-900'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => setSelectingCurrencyRowId(row.id)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-800 cursor-pointer focus:outline-none shrink-0 text-center w-8 sm:w-10 transition-colors shadow-2xs"
                            title={`Moneda actual: ${row.currency}. Clic para cambiar con modal.`}
                          >
                            {CURRENCY_CONFIG[row.currency].symbol}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* COLUMNA 3: MONEDA A MOSTRAR (Sin símbolo repetido) */}
                    {showDisplayColumn && (
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-blue-900 bg-blue-50/20 text-xs sm:text-sm align-middle truncate">
                        {formatNumber(
                          row.equivalents[settings.displayCurrency],
                          settings.decimals
                        )}
                      </td>
                    )}

                    {/* COLUMNA 4: MONEDA A PAGAR (Sin símbolo repetido) */}
                    {showPaymentColumn && (
                      <td className={`border border-slate-300 px-2 py-1 text-right font-mono font-bold text-xs sm:text-sm align-middle truncate ${
                        isExpense
                          ? 'bg-rose-50/40 text-rose-800'
                          : 'bg-emerald-50/30 text-emerald-900'
                      }`}>
                        {formatNumber(
                          row.equivalents[settings.paymentCurrency],
                          settings.decimals
                        )}
                      </td>
                    )}

                    {/* COLUMNA 5: TRICOUNT / BOTÓN NOMBRE MODAL */}
                    {isTricountActive && (
                      <td className="border border-slate-300 p-0.5 text-center bg-emerald-50/30 align-middle">
                        {(() => {
                          const fullPayer = row.payer || members[0] || 'Asignar';
                          const displayPayer = fullPayer.length > 5 ? `${fullPayer.slice(0, 4)}…` : fullPayer;
                          return (
                            <button
                              type="button"
                              onClick={() => setSelectingPayerRowId(row.id)}
                              className="w-full max-w-[55px] sm:max-w-[70px] mx-auto px-0.5 py-0.5 rounded bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-[10px] sm:text-[11px] truncate block text-center cursor-pointer transition-colors shadow-2xs leading-tight"
                              title={`Pagado por: ${fullPayer}. Clic para cambiar.`}
                            >
                              {displayPayer}
                            </button>
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Spreadsheet Footer Toolbar */}
      <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
        <button
          onClick={() => onAddRow()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Agregar Fila</span>
        </button>

        {computedRows.length > 0 && (
          <div>
            {confirmClearRows ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded px-2 py-1 text-xs">
                <span className="text-rose-800 font-medium">¿Vaciar todas las filas?</span>
                <button
                  onClick={() => {
                    onClearRows();
                    setConfirmClearRows(false);
                  }}
                  className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded hover:bg-rose-700 cursor-pointer"
                >
                  Sí, vaciar
                </button>
                <button
                  onClick={() => setConfirmClearRows(false)}
                  className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearRows(true)}
                className="text-slate-400 hover:text-rose-600 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Vaciar cuenta
              </button>
            )}
          </div>
        )}
      </div>

      {/* 6. Grand Totals Fixed Summary Grid (Anclado/Fijo en la parte inferior) */}
      <footer className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs text-slate-800 p-2.5 sm:p-3 flex flex-col gap-2 border-t border-slate-200 shadow-md">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5">
          {/* Total Bs */}
          <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-2xs flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              Total en Bs
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-emerald-800 truncate">
              {formatNumber(totals.netByCurrency.VES, settings.decimals)} <span className="text-xs">Bs</span>
            </span>
          </div>

          {/* Total $ */}
          <div className="bg-white p-2 rounded-lg border border-blue-200 shadow-2xs flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">
              Total en $
            </span>
            <span className="text-sm sm:text-base font-mono text-blue-800 font-bold truncate">
              $ {formatNumber(totals.netByCurrency.USD, settings.decimals)}
            </span>
          </div>

          {/* Total USDT */}
          <div className="bg-white p-2 rounded-lg border border-amber-200 shadow-2xs flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
              Total en USDT
            </span>
            <span className="text-sm sm:text-base font-mono text-amber-800 font-bold truncate">
              {formatNumber(totals.netByCurrency.USDT, settings.decimals)} <span className="text-xs">USDT</span>
            </span>
          </div>

          {/* Total EUR */}
          <div className="bg-white p-2 rounded-lg border border-teal-200 shadow-2xs flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
              Total en EUR
            </span>
            <span className="text-sm sm:text-base font-mono text-teal-800 font-bold truncate">
              {formatNumber(totals.netByCurrency.EUR, settings.decimals)} <span className="text-xs">EUR</span>
            </span>
          </div>
        </div>

        {/* Footer Bottom Bar: Count & Export */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
          <span className="text-slate-500 text-[11px]">
            {computedRows.length} {computedRows.length === 1 ? 'fila' : 'filas'} en esta cuenta
          </span>

          {onOpenExportReport && (
            <button
              onClick={onOpenExportReport}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar Reporte</span>
            </button>
          )}
        </div>
      </footer>

      {/* 7. MODAL DE OPCIONES Y LIQUIDACIÓN TRICOUNT (No ocupa espacio permanente en la pantalla) */}
      {isTricountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-slate-800 overflow-hidden my-auto animate-fade-in">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-emerald-50/70 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                  <Users className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-emerald-950">Tricount & Gastos Compartidos</h3>
                  <p className="text-[11px] text-emerald-800 font-medium">Cuenta: {sheet.title}</p>
                </div>
              </div>
              <button
                onClick={() => setIsTricountModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Toggle Tricount Active */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Modo Gastos Compartidos</span>
                  <span className="text-[11px] text-slate-500">Activa participantes y división de pagos</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleTricount}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isTricountActive
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isTricountActive ? 'Activo' : 'Desactivado'}
                </button>
              </div>

              {/* Participants Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Participantes del Grupo:</span>
                  <span className="text-[11px] text-slate-500">{members.length} personas</span>
                </div>

                {/* Member Pills */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {members.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No hay participantes añadidos aún.</span>
                  ) : (
                    members.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs"
                      >
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                          title="Eliminar participante"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add Member Form */}
                <form onSubmit={handleAddMember} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nombre de la persona (ej: Carlos, María)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </form>
              </div>

              {/* Settlement / Balances Section */}
              {isTricountActive && members.length >= 2 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Liquidación y Balances:</span>
                    <button
                      type="button"
                      onClick={handleCopyTricountReport}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>{copiedTricount ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
                    </button>
                  </div>

                  {/* Metrics Summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Gasto Total</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {formatCurrency(tricountStats.totalSharedExpense, settleCurrency, 2)}
                      </span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">Cuota por Persona</span>
                      <span className="text-sm font-mono font-bold text-emerald-900">
                        {formatCurrency(tricountStats.fairShare, settleCurrency, 2)}
                      </span>
                    </div>
                  </div>

                  {/* Debts Transfers list */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600">¿Quién le paga a quién?</span>
                    {tricountStats.transfers.length === 0 ? (
                      <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-lg flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>¡Todos están al día! No hay pagos pendientes.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tricountStats.transfers.map((t, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex flex-col gap-1 text-xs"
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-rose-700">{t.from}</span>
                              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                                <span>le paga a</span>
                                <ArrowRight className="w-3 h-3 text-slate-600" />
                              </div>
                              <span className="text-emerald-700">{t.to}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center font-bold">
                              <div className="bg-white p-1 rounded border border-blue-200 text-blue-800">
                                $ {formatNumber(t.amountsInAllCurrencies.USD, 2)}
                              </div>
                              <div className="bg-white p-1 rounded border border-emerald-200 text-emerald-800">
                                Bs {formatNumber(t.amountsInAllCurrencies.VES, 2)}
                              </div>
                              <div className="bg-white p-1 rounded border border-amber-200 text-amber-800">
                                {formatNumber(t.amountsInAllCurrencies.USDT, 2)}
                              </div>
                              <div className="bg-white p-1 rounded border border-teal-200 text-teal-800">
                                € {formatNumber(t.amountsInAllCurrencies.EUR, 2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsTricountModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL RÁPIDO PARA SELECCIONAR PARTICIPANTE QUE PAGÓ */}
      {selectingPayerRowId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-emerald-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-emerald-600 text-white shadow-2xs">
                  <Users className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">¿Quién pagó este gasto?</h3>
                  <p className="text-[11px] text-slate-500">Selecciona o añade una persona</p>
                </div>
              </div>
              <button
                onClick={() => setSelectingPayerRowId(null)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {/* Grid of members */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Participantes:</span>
                {members.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 text-center">
                    No hay participantes en la lista. Escribe uno abajo.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {members.map((m) => {
                      const currentRow = computedRows.find((r) => r.id === selectingPayerRowId);
                      const isCurrentPayer = (currentRow?.payer || members[0]) === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            onUpdateRow(selectingPayerRowId, { payer: m });
                            setSelectingPayerRowId(null);
                          }}
                          className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer border ${
                            isCurrentPayer
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-slate-50 hover:bg-emerald-50 text-slate-800 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <span className="truncate">{m}</span>
                          {isCurrentPayer && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Add participant */}
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600">+ Nuevo participante:</span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = quickPayerName.trim();
                    if (!name) return;
                    if (!members.includes(name) && onUpdateSheetMembers) {
                      onUpdateSheetMembers([...members, name]);
                    }
                    onUpdateRow(selectingPayerRowId, { payer: name });
                    setQuickPayerName('');
                    setSelectingPayerRowId(null);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={quickPayerName}
                    onChange={(e) => setQuickPayerName(e.target.value)}
                    placeholder="Nombre (ej: Daniel)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Asignar
                  </button>
                </form>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectingPayerRowId(null)}
                className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL PARA SELECCIONAR MONEDA DE LA FILA */}
      {selectingCurrencyRowId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xs w-full overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-blue-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-blue-600 text-white shadow-2xs">
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Seleccionar Moneda</h3>
                  <p className="text-[11px] text-slate-500">Para el monto de esta fila</p>
                </div>
              </div>
              <button
                onClick={() => setSelectingCurrencyRowId(null)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 grid grid-cols-2 gap-2">
              {ALL_CURRENCIES.map((c) => {
                const currentRow = computedRows.find((r) => r.id === selectingCurrencyRowId);
                const isCurrent = currentRow?.currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onUpdateRow(selectingCurrencyRowId, { currency: c });
                      setSelectingCurrencyRowId(null);
                    }}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-0.5 border text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-800 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-base font-extrabold">{CURRENCY_CONFIG[c].symbol}</span>
                    <span className="text-[11px] font-mono">{c}</span>
                    <span className="text-[9px] opacity-75 font-normal">{CURRENCY_CONFIG[c].name}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectingCurrencyRowId(null)}
                className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL PARA CONFIRMAR ELIMINACIÓN DE FILA EN LA CUENTA */}
      {rowToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 flex flex-col gap-3 animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="p-2 rounded-lg bg-rose-100 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-slate-900">¿Eliminar fila #{rowToDelete.index}?</h4>
                <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                  {rowToDelete.concept ? `"${rowToDelete.concept}"` : 'Sin descripción'}{' '}
                  {rowToDelete.expression ? `(${rowToDelete.expression} ${rowToDelete.currency})` : ''}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              ¿Estás seguro de que deseas eliminar esta fila de la cuenta? Esta acción no se puede deshacer.
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
                  onDeleteRow(rowToDelete.id);
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
