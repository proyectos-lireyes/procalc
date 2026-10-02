import React, { useState, useMemo, useRef } from 'react';
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
  Eye,
  CreditCard,
  Download,
  Plane,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  Pencil,
  Search,
  AlertCircle,
  Target,
} from 'lucide-react';
import {
  Sheet,
  SheetRow,
  ComputedRow,
  ComputedSheetTotals,
  Currency,
  RatesState,
  AppSettings,
  TricountMode,
  TricountPrepaidConfig,
  TricountContribution,
  TricountGroup,
} from '../types';
import { SheetSharePayload } from '../utils/shareImporter';
import { ImportSharedModal } from './ImportSharedModal';
import { FunctionInfoModal, FunctionHelpInfo } from './FunctionInfoModal';
import { TricountModal } from './TricountModal';
import { useLongPress } from '../utils/useLongPress';
import {
  calculatePrepaidTripStats,
  createDefaultPrepaidConfig,
  resolveMemberForContribution,
  getSheetPlanners,
  getActivePlanner,
} from '../utils/tricountPrepaid';
import {
  ALL_CURRENCIES,
  CURRENCY_CONFIG,
  formatCurrency,
  formatNumber,
  convertCurrency,
} from '../utils/currency';
import { parseVariableDeclaration } from '../utils/variableParser';
import { useVirtualKeyboard } from '../utils/useVirtualKeyboard';

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
  onUpdateSheetTricountMode?: (mode: TricountMode) => void;
  onUpdatePrepaidConfig?: (config: TricountPrepaidConfig) => void;
  onCreatePlanner?: (name: string, targetAmount?: number, currency?: Currency) => void;
  onSelectPlanner?: (plannerId: string) => void;
  onRenamePlanner?: (plannerId: string, newName: string) => void;
  onDeletePlanner?: (plannerId: string) => void;
  onUpdateSettledTransfers?: (settledTransfers: Record<string, boolean>) => void;
  onUpdateSettledDebtors?: (settledDebtors: Record<string, boolean>) => void;
  onUpdatePartialSettlements?: (partialSettlements: Record<string, number>) => void;
  tricountGroups?: TricountGroup[];
  onOpenTricountGroups?: () => void;
  onAssociateTricountGroup?: (groupId: string) => void;
  onCreateTricountGroup?: (name: string, members: string[], description?: string) => void;
  onUpdateTricountGroup?: (id: string, name: string, members: string[], description?: string) => void;
  onDeleteTricountGroup?: (id: string) => void;
  onOpenClosedSheets?: () => void;
  closedSheetsCount?: number;
  onImportSheet?: (data: SheetSharePayload, mode: 'new' | 'replace') => void;
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
  onUpdateSheetTricountMode,
  onUpdatePrepaidConfig,
  onCreatePlanner,
  onSelectPlanner,
  onRenamePlanner,
  onDeletePlanner,
  onUpdateSettledTransfers,
  onUpdateSettledDebtors,
  onUpdatePartialSettlements,
  tricountGroups,
  onOpenTricountGroups,
  onAssociateTricountGroup,
  onCreateTricountGroup,
  onUpdateTricountGroup,
  onDeleteTricountGroup,
  onOpenClosedSheets,
  closedSheetsCount = 0,
  onImportSheet,
}) => {
  const [editingSheetTitle, setEditingSheetTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(sheet.title);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [helpInfo, setHelpInfo] = useState<FunctionHelpInfo | null>(null);

  // Column toggle handler: specifically toggles the "Pagar" column
  const handleTogglePaymentColumn = () => {
    setShowPaymentColumn((prev) => !prev);
  };

  // Long press hooks for toolbar functions
  const importLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Importar Cuenta',
        badge: 'Cuentas',
        icon: <Download className="w-5 h-5 text-indigo-600" />,
        description:
          'Permite cargar una cuenta u hoja de cálculos compartida por otra persona pegando el texto recibido por WhatsApp o el código directo de importación.',
        tips: [
          'No sobreescribe ni borra tus otras cuentas existentes',
          'Detecta automáticamente los códigos del portapapeles',
        ],
      });
    },
    onClick: () => setIsImportModalOpen(true),
  });

  const exportLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Exportar y Compartir',
        badge: 'Reportes',
        icon: <Share2 className="w-5 h-5 text-blue-600" />,
        description:
          'Genera un reporte detallado con el desglose de todas las filas y totales en las 4 divisas (USD, VES, USDT, EUR). Permite compartir por WhatsApp o descargar comprobantes.',
        tips: [
          'Incluye un código para que la otra persona importe la cuenta completa',
          'Presenta totales exactos en todas las monedas',
        ],
      });
    },
    onClick: () => {
      if (onOpenExportReport) onOpenExportReport();
    },
  });

  const vaciarLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Vaciar Cuenta',
        badge: 'Edición',
        icon: <Trash2 className="w-5 h-5 text-rose-600" />,
        description:
          'Borra todas las operaciones y filas de la cuenta actualmente abierta para iniciar cálculos desde cero. Siempre solicita confirmación antes de limpiar.',
        tips: [
          'Solo afecta a la cuenta en pantalla',
          'No elimina la cuenta ni afecta al resto de tus hojas',
        ],
      });
    },
    onClick: () => setConfirmClearRows(true),
  });

  const mostrarLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Mostrar / Ocultar Columna de Pago',
        badge: 'Visualización',
        icon: <Eye className="w-5 h-5 text-blue-600" />,
        description:
          `Muestra u oculta la columna de pago (${settings.paymentCurrency}). Al ocultarla, ganas espacio horizontal en la tabla para la descripción y montos principales.`,
        tips: [
          'Pulsa para ocultar o mostrar la columna de pago',
          'Recomendado en celulares para ver descripciones más amplias',
        ],
      });
    },
    onClick: handleTogglePaymentColumn,
  });

  const tricountLongPress = useLongPress({
    onLongPress: () => {
      setHelpInfo({
        title: 'Tricount (División de Gastos)',
        badge: 'Miembros',
        icon: <Users className="w-5 h-5 text-emerald-600" />,
        description:
          'Activa la división de gastos entre amigos o compañeros de viaje. Permite asignar quién pagó cada fila y calcula las transferencias mínimas para saldar deudas en cualquier moneda.',
        tips: [
          'Agrega miembros y asigna pagadores fila por fila',
          'Calcula automáticamente quién le debe a quién en $, Bs, USDT y EUR',
        ],
      });
    },
    onClick: () => setIsTricountModalOpen(true),
  });

  // In-app confirmation and modal states
  const [sheetToClose, setSheetToClose] = useState<Sheet | null>(null);
  const [confirmClearRows, setConfirmClearRows] = useState(false);
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

  // Row Payer & Custom Participants Modal States (Exentar miembros)
  const [selectedRowPayer, setSelectedRowPayer] = useState<string>('');
  const [selectedRowParticipants, setSelectedRowParticipants] = useState<string[]>([]);

  // Planificador de Viaje / Prepaid Stats
  const isPrepaidMode = sheet.tricountMode === 'prepaid';
  const members = useMemo(
    () => (sheet.members && sheet.members.length > 0 ? sheet.members : ['Yo']),
    [sheet.members]
  );

  const sheetPlanners = useMemo(() => getSheetPlanners(sheet), [sheet]);
  const activePlanner = useMemo(() => getActivePlanner(sheet), [sheet]);
  const plannerCurrency: Currency = activePlanner.targetCurrency || settings.displayCurrency;

  const prepaidStats = useMemo(() => {
    if (!activePlanner.targetAmount && !isPrepaidMode && sheet.tricountMode !== 'prepaid') {
      return null;
    }
    return calculatePrepaidTripStats(members, activePlanner, rates, plannerCurrency);
  }, [activePlanner, isPrepaidMode, sheet.tricountMode, members, rates, plannerCurrency]);

  // Quick Abono & Member Detail States & Target Edit States
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<string | null>(null);
  const [isEditingTargetOutside, setIsEditingTargetOutside] = useState(false);
  const [outsideTargetInput, setOutsideTargetInput] = useState('');
  const [outsideTargetCurrency, setOutsideTargetCurrency] = useState<Currency>('USD');
  const [editingContrib, setEditingContrib] = useState<TricountContribution | null>(null);
  const [contribToDelete, setContribToDelete] = useState<TricountContribution | null>(null);
  const [plannerSearchQuery, setPlannerSearchQuery] = useState('');
  const [plannerFilterStatus, setPlannerFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  
  // Sort states: orden alfabético, por abono o por deuda en orden asc o desc
  type PlannerSortField = 'name' | 'collected' | 'remaining';
  type PlannerSortOrder = 'asc' | 'desc';
  const [plannerSortField, setPlannerSortField] = useState<PlannerSortField>('remaining');
  const [plannerSortOrder, setPlannerSortOrder] = useState<PlannerSortOrder>('desc');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // Multiple Planners Modals
  const [isCreatingPlanner, setIsCreatingPlanner] = useState(false);
  const [newPlannerName, setNewPlannerName] = useState('');
  const [newPlannerTarget, setNewPlannerTarget] = useState('');
  const [newPlannerCurrency, setNewPlannerCurrency] = useState<Currency>(settings.displayCurrency);

  const [renamingPlannerId, setRenamingPlannerId] = useState<string | null>(null);
  const [renamingPlannerName, setRenamingPlannerName] = useState('');

  const [deletingPlannerId, setDeletingPlannerId] = useState<string | null>(null);

  const [isQuickAbonoOpen, setIsQuickAbonoOpen] = useState(false);
  const [quickAbonoMember, setQuickAbonoMember] = useState('');
  const [quickAbonoAmount, setQuickAbonoAmount] = useState('');
  const [quickAbonoCurrency, setQuickAbonoCurrency] = useState<Currency>(settings.displayCurrency);
  const [quickAbonoNote, setQuickAbonoNote] = useState('');
  const [quickAbonoDate, setQuickAbonoDate] = useState<string>('');
  const [quickAbonoError, setQuickAbonoError] = useState<string | null>(null);

  const handleOpenRowPayerModal = (rowId: string) => {
    const row = computedRows.find((r) => r.id === rowId);
    if (!row) return;
    const initialPayer = row.payer && members.includes(row.payer) ? row.payer : members[0] || 'Yo';
    setSelectedRowPayer(initialPayer);
    const existingParts =
      row.participants && row.participants.length > 0
        ? row.participants.filter((p) => members.includes(p))
        : members;
    setSelectedRowParticipants(existingParts.length > 0 ? existingParts : members);
    setSelectingPayerRowId(rowId);
  };

  const formatContributionDate = (timestamp: number) => {
    if (!timestamp) return 'Fecha no registrada';
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenQuickAbono = (memberName?: string) => {
    setQuickAbonoMember(memberName || members[0] || 'Yo');
    setQuickAbonoAmount('');
    setQuickAbonoCurrency(sheet.prepaidConfig?.targetCurrency || settings.displayCurrency);
    setQuickAbonoNote('');
    setQuickAbonoDate(new Date().toISOString().slice(0, 16));
    setQuickAbonoError(null);
    setIsQuickAbonoOpen(true);
  };

  const handleSaveQuickAbono = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAbonoError(null);
    const num = parseFloat(quickAbonoAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      setQuickAbonoError('Ingresa un monto válido mayor a 0.');
      return;
    }

    const memberToUse = quickAbonoMember || members[0] || 'Yo';
    const timestamp = quickAbonoDate ? new Date(quickAbonoDate).getTime() : Date.now();

    const newContrib: TricountContribution = {
      id: 'contrib_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      member: memberToUse,
      amount: num,
      currency: quickAbonoCurrency,
      date: isNaN(timestamp) ? Date.now() : timestamp,
      note: quickAbonoNote.trim() || undefined,
    };

    const currentConfig: TricountPrepaidConfig = activePlanner;

    const nextConfig: TricountPrepaidConfig = {
      ...currentConfig,
      contributions: [...(currentConfig.contributions || []), newContrib],
    };

    if (onUpdatePrepaidConfig) {
      onUpdatePrepaidConfig(nextConfig);
    }

    setIsQuickAbonoOpen(false);
  };

  const handleUpdateContribution = (updated: TricountContribution) => {
    const currentConfig: TricountPrepaidConfig = activePlanner;

    const nextContribs = (currentConfig.contributions || []).map((c) =>
      c.id === updated.id ? updated : c
    );

    const nextConfig: TricountPrepaidConfig = {
      ...currentConfig,
      contributions: nextContribs,
    };

    if (onUpdatePrepaidConfig) {
      onUpdatePrepaidConfig(nextConfig);
    }
    setEditingContrib(null);
  };

  const handleDeleteContribution = (id: string) => {
    const currentConfig: TricountPrepaidConfig = activePlanner;

    const nextContribs = (currentConfig.contributions || []).filter((c) => c.id !== id);
    const nextConfig: TricountPrepaidConfig = {
      ...currentConfig,
      contributions: nextContribs,
    };

    if (onUpdatePrepaidConfig) {
      onUpdatePrepaidConfig(nextConfig);
    }
    setContribToDelete(null);
  };

  // Virtual keypad for amount input and device keyboard for descriptions
  const amountInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const isNativeKeyboardOpen = useVirtualKeyboard();

  // Helper to insert tokens into active row's amount
  const handleInsertToken = (token: string) => {
    if (token === 'Enter' || token === '↵ Enter' || token === '+ Fila') {
      const newId = onAddRow(undefined, activeRowId || undefined);
      if (newId && typeof newId === 'string') {
        setActiveRowId(newId);
        setTimeout(() => {
          amountInputRefs.current[newId]?.focus();
        }, 40);
      }
      return;
    }

    const targetRow = sheet.rows.find((r) => r.id === activeRowId) || sheet.rows[sheet.rows.length - 1];
    if (!targetRow) {
      if (token !== 'AC' && token !== 'DEL') {
        const newId = onAddRow();
        if (newId && typeof newId === 'string') {
          setActiveRowId(newId);
          onUpdateRow(newId, { expression: token === 'ans' ? '0' : token });
          setTimeout(() => {
            amountInputRefs.current[newId]?.focus();
          }, 40);
        }
      }
      return;
    }

    const input = amountInputRefs.current[targetRow.id];
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
      updatedExpr = currentExpr.slice(0, start) + token + currentExpr.slice(end);
      newCursorPos = start + token.length;
    }

    onUpdateRow(targetRow.id, { expression: updatedExpr });

    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Helper to add row below and auto-focus its amount input
  const handleEnterAddRow = (currentRowId: string) => {
    const newId = onAddRow(undefined, currentRowId);
    if (newId && typeof newId === 'string') {
      setActiveRowId(newId);
      setTimeout(() => {
        const el = amountInputRefs.current[newId] || (document.getElementById(`amount-input-${newId}`) as HTMLInputElement | null);
        if (el) {
          el.focus();
          el.select();
        }
      }, 40);
    }
  };

  // Local or sheet-persisted tricount toggle state
  const isTricountActive =
    sheet.tricountMode === 'postpaid' ||
    (sheet.isTricountActive === true && sheet.tricountMode !== 'prepaid');

  React.useEffect(() => {
    setTempTitle(sheet.title);
    setEditingSheetTitle(false);
    setSheetToClose(null);
    setConfirmClearRows(false);
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
      onUpdateSheetMembers(['Yo']);
    }
  };

  // Compute Active Sheet Tricount Settlement (Postpaid)
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
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm w-full h-full overflow-hidden">
      {/* 1. Spreadsheet Header: Sheet Tabs with inline rename on tap & optional Cerradas */}
      <div className="bg-slate-100 border-b border-slate-200 px-2 sm:px-3 pt-1.5 pb-1 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Sheet Tabs (scrolls horizontally if multiple tabs) */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none flex-1 py-0.5">
          {sheets.map((s) => {
            const isCurrent = s.id === activeSheetId;
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (!isCurrent) {
                    onSelectSheet(s.id);
                    setEditingSheetTitle(false);
                  }
                }}
                className={`group px-2.5 py-1 rounded-t-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-t border-x transition-all select-none shrink-0 ${
                  isCurrent
                    ? 'bg-white border-slate-200 text-blue-700 shadow-2xs font-bold'
                    : 'bg-slate-200/70 border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title={isCurrent ? 'Haz clic sobre el nombre para cambiarlo' : s.title}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />

                {isCurrent && editingSheetTitle ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') {
                          setTempTitle(s.title);
                          setEditingSheetTitle(false);
                        }
                      }}
                      autoFocus
                      className="w-20 sm:w-28 bg-blue-50/80 border border-blue-500 rounded px-1.5 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      className="p-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
                      title="Guardar nombre"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCurrent) {
                          onSelectSheet(s.id);
                        }
                        setTempTitle(s.title);
                        setEditingSheetTitle(true);
                      }}
                      className="truncate max-w-[90px] sm:max-w-[140px] hover:underline cursor-pointer"
                      title="Haz clic sobre el nombre para cambiarlo"
                    >
                      {s.title}
                    </span>

                    {/* BOTÓN CERRAR CUENTA JUSTO AL LADO DEL NOMBRE (DONDE ESTABA EL LÁPIZ) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetToClose(s);
                      }}
                      className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ml-0.5 ${
                        isCurrent
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-300'
                      }`}
                      title="Cerrar esta cuenta"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          <button
            id="add-sheet-tab-btn"
            onClick={onCreateSheet}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors ml-0.5 cursor-pointer shrink-0"
            title="Añadir nueva cuenta u hoja"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Only Cuentas Cerradas count (clean and separated) */}
        {onOpenClosedSheets && (
          <div className="flex items-center shrink-0 pl-1">
            <button
              type="button"
              onClick={onOpenClosedSheets}
              className="text-[10px] sm:text-[11px] font-semibold text-slate-600 hover:text-amber-700 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              title="Ver y reabrir cuentas cerradas"
            >
              <span>Cerradas ({closedSheetsCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* CUERPO PRINCIPAL: O PLANNER DEDICADO (FONDO AZUL) O TABLA EXCEL DE CÁLCULO */}
      {isPrepaidMode && prepaidStats ? (
        <div className="w-full flex-1 min-h-0 overflow-y-auto bg-slate-100/90 p-2 sm:p-2.5 space-y-2">
          {/* BARRA DE PLANNERS (Pestañas de múltiples planners: Traslado, Estadía, Comida, etc.) */}
          <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-200 flex items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1 shrink-0 flex items-center gap-1">
                <Plane className="w-3 h-3 text-blue-600" />
                <span className="hidden sm:inline">Planners:</span>
              </span>

              {sheetPlanners.map((p) => {
                const isActive = p.id === activePlanner.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isActive && onSelectPlanner && p.id) {
                        onSelectPlanner(p.id);
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    <span className="truncate max-w-[90px] sm:max-w-[140px]">{p.name || 'General'}</span>

                    {p.targetAmount > 0 && (
                      <span className={`text-[9px] font-mono px-1 py-0.2 rounded-xs ${
                        isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        {formatCurrency(p.targetAmount, p.targetCurrency, 0)}
                      </span>
                    )}

                    {/* Acciones para el planner activo */}
                    {isActive && (
                      <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-blue-400/40">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingPlannerId(p.id!);
                            setRenamingPlannerName(p.name || '');
                          }}
                          className="p-0.5 hover:bg-blue-500 rounded text-blue-200 hover:text-white transition-colors cursor-pointer"
                          title="Renombrar este planner"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        {sheetPlanners.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingPlannerId(p.id!);
                            }}
                            className="p-0.5 hover:bg-rose-500 rounded text-blue-200 hover:text-white transition-colors cursor-pointer"
                            title="Eliminar este planner"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Botón + Nuevo Planner */}
            <button
              type="button"
              onClick={() => {
                setNewPlannerName('');
                setNewPlannerTarget('');
                setNewPlannerCurrency(settings.displayCurrency);
                setIsCreatingPlanner(true);
              }}
              className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors"
              title="Añadir un nuevo planner (ej: Traslado, Estadía, Comida)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo Planner</span>
            </button>
          </div>

          {/* 1. TARJETA DE LA META (ULTRA COMPACTA Y ELEGANTE) */}
          <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white rounded-lg p-2 sm:p-2.5 shadow-xs border border-blue-700/60 space-y-1.5 shrink-0">
            {/* Métricas en 1 fila ultra compacta con Cuota p/p */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center sm:text-left">
              <div
                onClick={() => {
                  setOutsideTargetInput(activePlanner.targetAmount ? String(activePlanner.targetAmount) : '');
                  setOutsideTargetCurrency(plannerCurrency);
                  setIsEditingTargetOutside(true);
                }}
                className="bg-white/10 hover:bg-white/20 rounded-md p-1.5 border border-white/10 cursor-pointer transition-colors group"
                title="Toca para ajustar el monto meta y la moneda"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wider block truncate">
                    Meta Total
                  </span>
                  <Pencil className="w-2.5 h-2.5 text-blue-300 opacity-60 group-hover:opacity-100" />
                </div>
                <span className="font-mono font-black text-xs sm:text-sm text-white block truncate">
                  {formatCurrency(prepaidStats.totalTargetInBase, plannerCurrency, settings.decimals)}
                </span>
              </div>

              <div className="bg-white/10 rounded-md p-1.5 border border-white/10">
                <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wider block truncate">
                  Cuota p/p
                </span>
                <span className="font-mono font-black text-xs sm:text-sm text-blue-100 block truncate">
                  {formatCurrency(
                    prepaidStats.totalTargetInBase / (members.length || 1),
                    plannerCurrency,
                    settings.decimals
                  )}
                </span>
              </div>

              <div className="bg-emerald-500/20 rounded-md p-1.5 border border-emerald-400/30">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block truncate">
                    Abonado
                  </span>
                  <span className="text-[8.5px] font-extrabold px-1 py-0.2 rounded bg-emerald-400 text-slate-950 shrink-0">
                    {prepaidStats.progressPercent.toFixed(1)}%
                  </span>
                </div>
                <span className="font-mono font-black text-xs sm:text-sm text-emerald-300 block truncate">
                  {formatCurrency(prepaidStats.totalCollectedInBase, plannerCurrency, settings.decimals)}
                </span>
              </div>

              <div className="bg-white/10 rounded-md p-1.5 border border-white/10">
                <span className="text-[9px] font-bold text-amber-200 uppercase tracking-wider block truncate">
                  Falta
                </span>
                <span className="font-mono font-black text-xs sm:text-sm text-amber-300 block truncate">
                  {formatCurrency(prepaidStats.totalRemainingInBase, plannerCurrency, settings.decimals)}
                </span>
              </div>
            </div>

            {/* Barra de Progreso Ultra Delgada */}
            <div className="w-full bg-blue-950/80 rounded-full h-1.5 overflow-hidden border border-blue-400/20">
              <div
                className="bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, prepaidStats.progressPercent))}%` }}
              />
            </div>
          </div>

          {/* 2. BARRA DE BÚSQUEDA Y FILTROS POR PARTICIPANTE */}
          {(() => {
            const allMembers = prepaidStats.membersStats;
            const completedCount = allMembers.filter((m) => m.isCompleted).length;
            const pendingCount = allMembers.length - completedCount;

            const filteredList = allMembers.filter((ms) => {
              const queryMatch = ms.name.toLowerCase().includes(plannerSearchQuery.toLowerCase().trim());
              if (!queryMatch) return false;
              if (plannerFilterStatus === 'completed') return ms.isCompleted;
              if (plannerFilterStatus === 'pending') return !ms.isCompleted;
              return true;
            });

            // Organizar nombres según orden alfabético, por abono o por deuda en asc o desc
            filteredList.sort((a, b) => {
              let cmp = 0;
              if (plannerSortField === 'name') {
                cmp = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
              } else if (plannerSortField === 'collected') {
                cmp = a.collectedInBase - b.collectedInBase;
              } else if (plannerSortField === 'remaining') {
                cmp = a.remainingInBase - b.remainingInBase;
              }
              return plannerSortOrder === 'asc' ? cmp : -cmp;
            });

            return (
              <div className="space-y-2">
                {/* Search Input & Status Filter Chips */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={plannerSearchQuery}
                      onChange={(e) => setPlannerSearchQuery(e.target.value)}
                      placeholder="Buscar participante..."
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                    {plannerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPlannerSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter Status Chips & Sort Controls */}
                  <div className="flex items-center justify-between sm:justify-start gap-1 shrink-0 overflow-x-auto scrollbar-none py-0.5">
                    {/* Status chips */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPlannerFilterStatus('all')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer shrink-0 border ${
                          plannerFilterStatus === 'all'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        Todos ({allMembers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlannerFilterStatus('pending')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer shrink-0 border ${
                          plannerFilterStatus === 'pending'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        Pendientes ({pendingCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlannerFilterStatus('completed')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer shrink-0 border ${
                          plannerFilterStatus === 'completed'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        Listos ({completedCount})
                      </button>
                    </div>

                    {/* Mobile Sort Trigger Button / Selector */}
                    <div className="sm:hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsSortModalOpen(true)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-300 shadow-2xs flex items-center gap-1 cursor-pointer hover:bg-slate-50 active:scale-95"
                        title="Cambiar orden de participantes"
                      >
                        <span className="text-slate-400">🔀</span>
                        <span>
                          {plannerSortField === 'name'
                            ? `Nombre (${plannerSortOrder === 'asc' ? 'A→Z' : 'Z→A'})`
                            : plannerSortField === 'collected'
                            ? `Abono (${plannerSortOrder === 'desc' ? '▼ Mayor' : '▲ Menor'})`
                            : `Deuda (${plannerSortOrder === 'desc' ? '▼ Mayor' : '▲ Menor'})`}
                        </span>
                      </button>
                    </div>

                    {/* Divisor para Desktop */}
                    <div className="hidden sm:block h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

                    {/* Opciones de Organización en Desktop: Alfabético, Abono, Deuda con Asc/Desc */}
                    <div className="hidden sm:flex items-center gap-1 shrink-0 bg-white rounded-md p-0.5 border border-slate-300 shadow-2xs">
                      <span className="text-[9.5px] font-bold text-slate-500 uppercase px-1">Orden:</span>

                      {/* Botón: Alfabético (Nombre) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (plannerSortField === 'name') {
                            setPlannerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setPlannerSortField('name');
                            setPlannerSortOrder('asc');
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                          plannerSortField === 'name'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Organizar por orden alfabético"
                      >
                        <span>Nombre</span>
                        {plannerSortField === 'name' && (
                          <span className="text-[8.5px] font-extrabold">
                            {plannerSortOrder === 'asc' ? 'A→Z' : 'Z→A'}
                          </span>
                        )}
                      </button>

                      {/* Botón: Abono */}
                      <button
                        type="button"
                        onClick={() => {
                          if (plannerSortField === 'collected') {
                            setPlannerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setPlannerSortField('collected');
                            setPlannerSortOrder('desc');
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                          plannerSortField === 'collected'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Organizar por abono"
                      >
                        <span>Abono</span>
                        {plannerSortField === 'collected' && (
                          <span className="text-[8.5px] font-extrabold">
                            {plannerSortOrder === 'asc' ? '▲ Menor' : '▼ Mayor'}
                          </span>
                        )}
                      </button>

                      {/* Botón: Deuda */}
                      <button
                        type="button"
                        onClick={() => {
                          if (plannerSortField === 'remaining') {
                            setPlannerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setPlannerSortField('remaining');
                            setPlannerSortOrder('desc');
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                          plannerSortField === 'remaining'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="Organizar por deuda"
                      >
                        <span>Deuda</span>
                        {plannerSortField === 'remaining' && (
                          <span className="text-[8.5px] font-extrabold">
                            {plannerSortOrder === 'asc' ? '▲ Menor' : '▼ Mayor'}
                          </span>
                        )}
                      </button>

                      {/* Botón alternar Ascendente / Descendente */}
                      <button
                        type="button"
                        onClick={() => setPlannerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        className="px-1 py-0.5 rounded text-[9.5px] font-black text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border-l border-slate-200"
                        title={plannerSortOrder === 'asc' ? 'Ascendente (Clic para Descendente)' : 'Descendente (Clic para Ascendente)'}
                      >
                        {plannerSortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. LISTA DE TARJETAS ULTRA COMPACTAS */}
                {filteredList.length === 0 ? (
                  <div className="p-4 text-center bg-white border border-slate-200 rounded-lg text-slate-400 text-xs">
                    No se encontraron participantes que coincidan con la búsqueda.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {filteredList.map((ms) => (
                      <div
                        key={ms.name}
                        onClick={() => setSelectedMemberDetail(ms.name)}
                        className={`bg-white rounded-lg p-2 border transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between gap-1 active:scale-[0.99] select-none ${
                          ms.isCompleted
                            ? 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/20'
                            : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/10'
                        }`}
                        title={`Toca para ver historial de abonos y fechas de ${ms.name}`}
                      >
                        {/* Fila 1: Avatar, Nombre, Contador y Estado */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                                ms.isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {ms.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-xs text-slate-900 block truncate leading-tight">
                                {ms.name}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono block truncate leading-none">
                                {ms.contributionsCount} {ms.contributionsCount === 1 ? 'abono' : 'abonos'}
                              </span>
                            </div>
                          </div>

                          {ms.isCompleted ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5 shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" /> Listo
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                              {ms.percent}%
                            </span>
                          )}
                        </div>

                        {/* Fila 2: Barra de Progreso Ultra Delgada */}
                        <div className="w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              ms.isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, ms.percent))}%` }}
                          />
                        </div>

                        {/* Fila 3: Montos Abonado y Restante en 1 línea */}
                        <div className="flex items-center justify-between text-[10px] font-mono leading-tight pt-0.5">
                          <div className="truncate">
                            <span className="text-[9px] font-sans text-slate-400 mr-1">Abonó:</span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(ms.collectedInBase, plannerCurrency, 2)}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            {ms.isCompleted ? (
                              <span className="text-[9px] font-sans font-bold text-emerald-700">100%</span>
                            ) : (
                              <span className="text-[9px] font-sans font-medium text-amber-700">
                                Falta: <span className="font-mono font-bold">{formatCurrency(ms.remainingInBase, plannerCurrency, 2)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* 4. EXCEL-STYLE 1-ROW SPREADSHEET TABLE */
        <div className="w-full flex-1 min-h-0 overflow-y-auto">
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
                      ? isTricountActive ? '43%' : '51%'
                      : showDisplayColumn || showPaymentColumn
                      ? isTricountActive ? '60%' : '70%'
                      : isTricountActive ? '82%' : '95%',
                }}
              />
              {showDisplayColumn && (
                <col
                  style={{
                    width:
                      showPaymentColumn
                        ? isTricountActive ? '19%' : '22%'
                        : isTricountActive ? '23%' : '25%',
                  }}
                />
              )}
              {showPaymentColumn && (
                <col
                  style={{
                    width:
                      showDisplayColumn
                        ? isTricountActive ? '19%' : '22%'
                        : isTricountActive ? '23%' : '25%',
                  }}
                />
              )}
              {isTricountActive && <col style={{ width: '14%', minWidth: '52px' }} />}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
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
                  <th className="border border-slate-300 px-0.5 py-1.5 text-center text-emerald-800 text-[10px] sm:text-[11px] whitespace-nowrap" title="Tricount">
                    <span className="hidden sm:inline">Tricount</span>
                    <span className="sm:hidden">Tric.</span>
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
                            inputMode="text"
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
                            ref={(el) => (amountInputRefs.current[row.id] = el)}
                            id={`amount-input-${row.id}`}
                            type="text"
                            inputMode="none"
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

                    {/* COLUMNA 5: TRICOUNT / BOTÓN NOMBRE MODAL Y PARTICIPANTES */}
                    {isTricountActive && (
                      <td className="border border-slate-300 p-0.5 text-center bg-emerald-50/30 align-middle">
                        {(() => {
                          const fullPayer = (row.payer || members[0] || 'Asignar').trim();
                          const isCustomSplit =
                            row.participants &&
                            row.participants.length > 0 &&
                            row.participants.length < members.length;
                          const partCount = isCustomSplit ? row.participants!.length : members.length;

                          const shortMobile = fullPayer.length <= 4 ? fullPayer : `${fullPayer.slice(0, 3)}.`;
                          const shortDesktop = fullPayer.length > 7 ? `${fullPayer.slice(0, 6)}…` : fullPayer;
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenRowPayerModal(row.id)}
                              className={`w-full max-w-[62px] sm:max-w-[80px] mx-auto px-1 py-0.5 rounded border font-bold text-[10px] sm:text-[11px] block text-center cursor-pointer transition-colors shadow-2xs leading-tight ${
                                isCustomSplit
                                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                                  : 'bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                              }`}
                              title={`Pagado por: ${fullPayer}. ${
                                isCustomSplit
                                  ? `Dividido entre ${partCount} de ${members.length} miembros (${members.length - partCount} exentos).`
                                  : 'Dividido entre todos.'
                              } Clic para cambiar pagador o exentar miembros.`}
                            >
                              <div className="truncate">
                                <span className="sm:hidden">{shortMobile}</span>
                                <span className="hidden sm:inline">{shortDesktop}</span>
                              </div>
                              {isCustomSplit && (
                                <span className="text-[8.5px] font-extrabold text-amber-800 bg-amber-200/80 px-1 rounded-xs block mx-auto leading-none mt-0.5">
                                  {partCount}/{members.length}
                                </span>
                              )}
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
      )}

      {/* 5. Spreadsheet Footer Toolbar: Importar, Exportar, Vaciar, Mostrar, Tricount distribuidos al 100% */}
      <div className="px-1.5 sm:px-3 py-1.5 bg-slate-50 border-t border-slate-200 shrink-0 select-none">
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full">
          {/* 1. IMPORTAR */}
          {onImportSheet ? (
            <button
              type="button"
              {...importLongPress.handlers}
              className="w-full flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1 bg-white hover:bg-slate-100 text-indigo-700 rounded border border-indigo-200 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-2xs active:scale-95 min-w-0"
              title="Importar cuenta u hoja (Mantén presionado para ver qué hace)"
            >
              <Download className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
              <span className="truncate">Importar</span>
            </button>
          ) : (
            <div />
          )}

          {/* 2. EXPORTAR (Icono de compartir) */}
          {onOpenExportReport ? (
            <button
              type="button"
              {...exportLongPress.handlers}
              className="w-full flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1 bg-white hover:bg-slate-100 text-blue-700 rounded border border-blue-200 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-2xs active:scale-95 min-w-0"
              title="Exportar reporte y compartir (Mantén presionado para ver qué hace)"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-600" />
              <span className="truncate">Exportar</span>
            </button>
          ) : (
            <div />
          )}

          {/* 3. VACIAR */}
          <div className="w-full min-w-0">
            <button
              type="button"
              onClick={() => setConfirmClearRows(true)}
              {...vaciarLongPress.handlers}
              className="w-full flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded border border-slate-300 hover:border-rose-300 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-2xs active:scale-95 min-w-0"
              title="Vaciar todas las filas (Mantén presionado para ver qué hace)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Vaciar</span>
            </button>
          </div>

          {/* 4. EN PLANNER: + ABONO / EN MODO NORMAL: MOSTRAR COLUMNA */}
          {isPrepaidMode ? (
            <button
              type="button"
              onClick={() => handleOpenQuickAbono()}
              className="w-full flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded border border-emerald-700 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 min-w-0"
              title="Registrar nuevo abono a la colecta"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
              <span className="truncate">+ Abono</span>
            </button>
          ) : (
            <button
              type="button"
              {...mostrarLongPress.handlers}
              className={`w-full flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1 rounded text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-2xs active:scale-95 min-w-0 border ${
                showPaymentColumn
                  ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                  : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
              }`}
              title={`Mostrar u ocultar columna de pago (${settings.paymentCurrency}) (Mantén presionado para ver qué hace)`}
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Mostrar</span>
            </button>
          )}

          {/* 5. TRIPCOUNT / PLANIFICACIÓN VIAJE (AZUL PARA PLANNER, VERDE PARA TRIPCOUNT) */}
          <button
            id="tricount-account-btn"
            type="button"
            {...tricountLongPress.handlers}
            className={`w-full flex items-center justify-center gap-0.5 sm:gap-1 py-1 px-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 min-w-0 border ${
              sheet.tricountMode === 'prepaid'
                ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-500'
                : isTricountActive
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
            title="Opciones de Tripcount y Planificación de Viaje (Mantén presionado para ver qué hace)"
          >
            {sheet.tricountMode === 'prepaid' ? (
              <Plane className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Users className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {sheet.tricountMode === 'prepaid'
                ? `Fondo (${members.length})`
                : isTricountActive
                ? `Trip. (${members.length})`
                : 'Tripcount'}
            </span>
          </button>
        </div>
      </div>

      {/* 6. Grand Totals Summary Strip (Solo en modo normal de tabla) */}
      {!isPrepaidMode && (
        <div className="bg-slate-50/95 backdrop-blur-xs text-slate-800 px-2 py-1 sm:px-3 sm:py-1 border-t border-slate-200 shrink-0">
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 max-w-2xl mx-auto">
            {/* Total Bs */}
            <div className="bg-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded border border-emerald-200/80 shadow-2xs flex flex-col min-w-0 text-center sm:text-left">
              <span className="text-[9px] uppercase tracking-wide text-emerald-700 font-bold truncate">
                Total Bs
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-emerald-800 truncate">
                {formatNumber(totals.netByCurrency.VES, settings.decimals)} <span className="text-[9px]">Bs</span>
              </span>
            </div>

            {/* Total $ */}
            <div className="bg-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded border border-blue-200/80 shadow-2xs flex flex-col min-w-0 text-center sm:text-left">
              <span className="text-[9px] uppercase tracking-wide text-blue-700 font-bold truncate">
                Total $
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-blue-800 truncate">
                $ {formatNumber(totals.netByCurrency.USD, settings.decimals)}
              </span>
            </div>

            {/* Total USDT */}
            <div className="bg-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded border border-amber-200/80 shadow-2xs flex flex-col min-w-0 text-center sm:text-left">
              <span className="text-[9px] uppercase tracking-wide text-amber-700 font-bold truncate">
                Total USDT
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-amber-800 truncate">
                {formatNumber(totals.netByCurrency.USDT, settings.decimals)} <span className="text-[9px]">USDT</span>
              </span>
            </div>

            {/* Total EUR */}
            <div className="bg-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded border border-teal-200/80 shadow-2xs flex flex-col min-w-0 text-center sm:text-left">
              <span className="text-[9px] uppercase tracking-wide text-teal-700 font-bold truncate">
                Total EUR
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-teal-800 truncate">
                {formatNumber(totals.netByCurrency.EUR, settings.decimals)} <span className="text-[9px]">EUR</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Teclado Numérico Fijo (Solo en modo normal de tabla) */}
      {!isPrepaidMode && !isNativeKeyboardOpen && (
        <div className="p-1.5 sm:p-2 bg-slate-100 border-t border-slate-200 shrink-0 shadow-inner">
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 max-w-2xl mx-auto">
            {/* Row 1: (, ), %, AC, DEL */}
            <button
              type="button"
              onClick={() => handleInsertToken('(')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              (
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken(')')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              )
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('%')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('AC')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-rose-200 hover:bg-rose-300 text-rose-900 active:scale-95 flex items-center justify-center"
            >
              AC
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('DEL')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-rose-100 hover:bg-rose-200 text-rose-800 active:scale-95 flex items-center justify-center"
            >
              DEL
            </button>

            {/* Row 2: 7, 8, 9, /, * */}
            {['7', '8', '9', '/', '*'].map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => handleInsertToken(btn)}
                className={`h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono active:scale-95 flex items-center justify-center ${
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
                onClick={() => handleInsertToken(btn)}
                className={`h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono active:scale-95 flex items-center justify-center ${
                  btn === '-' || btn === '+'
                    ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-lg sm:text-xl'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs'
                }`}
              >
                {btn}
              </button>
            ))}

            {/* Row 4: 1, 2, 3, ans, Limpiar Fila */}
            <button
              type="button"
              onClick={() => handleInsertToken('1')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('2')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('3')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              3
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('ans')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer font-mono bg-indigo-100 hover:bg-indigo-200 text-indigo-900 active:scale-95 flex items-center justify-center"
            >
              Ans
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeRowId) onUpdateRow(activeRowId, { expression: '' });
              }}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer font-sans bg-rose-100 hover:bg-rose-200 text-rose-800 shadow-2xs flex items-center justify-center gap-1 active:scale-95"
              title="Borrar monto de la fila activa"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>

            {/* Row 5: 00, 0, ., +, ↵ Enter */}
            <button
              type="button"
              onClick={() => handleInsertToken('00')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-sm sm:text-base font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('0')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('.')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-base sm:text-lg font-bold transition-all cursor-pointer font-mono bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs active:scale-95 flex items-center justify-center"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('+')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-lg sm:text-xl font-bold transition-all cursor-pointer font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 active:scale-95 flex items-center justify-center"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken('↵ Enter')}
              className="h-9 sm:h-11 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer font-mono bg-indigo-700 hover:bg-indigo-600 text-white shadow-xs flex items-center justify-center gap-1 active:scale-95"
              title="Nueva Fila (Enter)"
            >
              ↵ Enter
            </button>
          </div>
        </div>
      )}

      {/* 7. MODAL COMPLETO DE TRICOUNT & PLANIFICACIÓN DE VIAJE (PREPAGO Y POSTPAGO) */}
      <TricountModal
        isOpen={isTricountModalOpen}
        onClose={() => setIsTricountModalOpen(false)}
        sheet={sheet}
        sheets={sheets}
        onSelectSheet={onSelectSheet}
        computedRows={computedRows}
        rates={rates}
        settings={settings}
        onUpdateSheetMembers={onUpdateSheetMembers}
        onUpdateRowPayer={(rowId, payer) => onUpdateRow(rowId, { payer })}
        onUpdateRowParticipants={(rowId, participants) => onUpdateRow(rowId, { participants })}
        onUpdateSheetTricountMode={onUpdateSheetTricountMode}
        onUpdatePrepaidConfig={onUpdatePrepaidConfig}
        onCreatePlanner={onCreatePlanner}
        onSelectPlanner={onSelectPlanner}
        onRenamePlanner={onRenamePlanner}
        onDeletePlanner={onDeletePlanner}
        onUpdateSettledTransfers={onUpdateSettledTransfers}
        onUpdateSettledDebtors={onUpdateSettledDebtors}
        onUpdatePartialSettlements={onUpdatePartialSettlements}
        tricountGroups={tricountGroups}
        onOpenTricountGroups={onOpenTricountGroups}
        onAssociateTricountGroup={onAssociateTricountGroup}
        onCreateTricountGroup={onCreateTricountGroup}
        onUpdateTricountGroup={onUpdateTricountGroup}
        onDeleteTricountGroup={onDeleteTricountGroup}
      />

      {/* 7. MODAL PARA CONFIGURAR PAGADOR Y PARTICIPANTES (EXENTAR MIEMBROS) */}
      {selectingPayerRowId && (() => {
        const currentRow = computedRows.find((r) => r.id === selectingPayerRowId);
        const rowAmt = currentRow ? Math.abs(currentRow.equivalents[settings.paymentCurrency]) : 0;
        const participantCount = selectedRowParticipants.length;
        const perPersonShare = participantCount > 0 ? rowAmt / participantCount : 0;
        const exemptMembers = members.filter((m) => !selectedRowParticipants.includes(m));

        const handleSavePayerAndParticipants = () => {
          const isAll = selectedRowParticipants.length === members.length &&
            members.every((m) => selectedRowParticipants.includes(m));
          onUpdateRow(selectingPayerRowId, {
            payer: selectedRowPayer,
            participants: isAll ? undefined : selectedRowParticipants,
          });
          setSelectingPayerRowId(null);
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-emerald-50/80 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-md bg-emerald-600 text-white shadow-2xs">
                    <Users className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Configurar Gasto de Tripcount</h3>
                    <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                      {currentRow?.concept || 'Operación'} • {formatCurrency(rowAmt, settings.paymentCurrency, settings.decimals)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectingPayerRowId(null)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto">
                {/* SECCIÓN 1: ¿QUIÉN PAGÓ ESTE GASTO? */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">1. ¿Quién pagó este gasto?</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Pagador: {selectedRowPayer || members[0]}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {members.map((m) => {
                      const isSelected = selectedRowPayer === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedRowPayer(m)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-slate-50 hover:bg-emerald-50 text-slate-800 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <span className="truncate">{m}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Añadir nuevo participante rápido */}
                  <div className="pt-1.5">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = quickPayerName.trim();
                        if (!name) return;
                        if (!members.includes(name) && onUpdateSheetMembers) {
                          onUpdateSheetMembers([...members, name]);
                        }
                        setSelectedRowPayer(name);
                        if (!selectedRowParticipants.includes(name)) {
                          setSelectedRowParticipants([...selectedRowParticipants, name]);
                        }
                        setQuickPayerName('');
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={quickPayerName}
                        onChange={(e) => setQuickPayerName(e.target.value)}
                        placeholder="Añadir nueva persona..."
                        className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                      >
                        + Añadir
                      </button>
                    </form>
                  </div>
                </div>

                {/* SECCIÓN 2: ¿QUIÉNES COMPARTEN ESTE GASTO? (EXENTAR MIEMBROS) */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        2. ¿Entre quiénes se divide?
                      </span>
                      <p className="text-[10.5px] text-slate-500">
                        Desmarca a quienes no participaron para dejarlos exentos.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRowParticipants([...members])}
                      className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      Todos ({members.length})
                    </button>
                  </div>

                  {/* Grid de checkboxes de participantes */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {members.map((m) => {
                      const isParticipating = selectedRowParticipants.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            if (isParticipating) {
                              // Desmarcar / Exentar (mantener al menos 1 participante)
                              if (selectedRowParticipants.length > 1) {
                                setSelectedRowParticipants(selectedRowParticipants.filter((p) => p !== m));
                              }
                            } else {
                              // Incluir
                              setSelectedRowParticipants([...selectedRowParticipants, m]);
                            }
                          }}
                          className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer border text-left ${
                            isParticipating
                              ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-400 line-through hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{m}</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                            isParticipating ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 no-underline'
                          }`}>
                            {isParticipating ? 'Participa' : 'Exento'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Resumen de división */}
                  <div className={`p-2 rounded-lg text-xs font-medium border ${
                    exemptMembers.length > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    {exemptMembers.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between font-bold">
                          <span>Dividido entre {participantCount} personas:</span>
                          <span className="font-mono text-amber-900">
                            {formatCurrency(perPersonShare, settings.paymentCurrency, settings.decimals)} c/u
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          Exentos (no pagan): <strong>{exemptMembers.join(', ')}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between font-bold">
                        <span>Dividido entre todos ({members.length} miembros):</span>
                        <span className="font-mono text-slate-900">
                          {formatCurrency(perPersonShare, settings.paymentCurrency, settings.decimals)} c/u
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer con Guardar */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectingPayerRowId(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePayerAndParticipants}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 1: CREAR NUEVO PLANNER */}
      {isCreatingPlanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-blue-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-blue-600 text-white shadow-2xs">
                  <Plane className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Crear Nuevo Planner</h3>
                  <p className="text-[11px] text-slate-500">Ej: Traslado, Estadía, Comida, Entradas</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatingPlanner(false)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newPlannerName.trim() || 'Nuevo Planner';
                const targetNum = parseFloat(newPlannerTarget.replace(',', '.')) || 0;
                if (onCreatePlanner) {
                  onCreatePlanner(name, targetNum, newPlannerCurrency);
                }
                setIsCreatingPlanner(false);
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Planner:</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newPlannerName}
                  onChange={(e) => setNewPlannerName(e.target.value)}
                  placeholder="ej: Traslado, Estadía, Comida..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Meta Inicial:</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newPlannerTarget}
                    onChange={(e) => setNewPlannerTarget(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Moneda:</label>
                  <select
                    value={newPlannerCurrency}
                    onChange={(e) => setNewPlannerCurrency(e.target.value as Currency)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {ALL_CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingPlanner(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Crear Planner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RENOMBRAR PLANNER */}
      {renamingPlannerId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="font-bold text-sm text-slate-900">Renombrar Planner</h3>
              <button
                onClick={() => setRenamingPlannerId(null)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = renamingPlannerName.trim();
                if (trimmed && onRenamePlanner && renamingPlannerId) {
                  onRenamePlanner(renamingPlannerId, trimmed);
                }
                setRenamingPlannerId(null);
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nuevo nombre:</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={renamingPlannerName}
                  onChange={(e) => setRenamingPlannerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingPlannerId(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINAR PLANNER */}
      {deletingPlannerId && (() => {
        const targetPl = sheetPlanners.find((p) => p.id === deletingPlannerId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col animate-scale-up p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="p-2 bg-rose-100 rounded-full">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">¿Eliminar Planner?</h3>
                  <p className="text-xs text-slate-500 font-semibold">{targetPl?.name || 'Planner'}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Se eliminarán la meta y los <strong>{targetPl?.contributions?.length || 0} abonos</strong> registrados en este planner. Esta acción no se puede deshacer.
              </p>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingPlannerId(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeletePlanner && deletingPlannerId) {
                      onDeletePlanner(deletingPlannerId);
                    }
                    setDeletingPlannerId(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Eliminar Planner
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* MODAL CONFIRMAR CERRAR CUENTA */}
      {sheetToClose && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-5 flex flex-col gap-3.5 animate-fade-in border border-slate-200 text-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                  ¿Cerrar "{sheetToClose.title}"?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Esta cuenta se guardará en <span className="font-semibold text-slate-700">"Cuentas Cerradas"</span>. Podrás revisarla o reabrirla cuando lo desees.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSheetToClose(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSheet(sheetToClose.id);
                  setSheetToClose(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Sí, cerrar cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAR HOJA O CUENTA COMPARTIDA */}
      {onImportSheet && (
        <ImportSharedModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          context="sheets"
          onImportSheet={onImportSheet}
        />
      )}

      {/* MODAL PARA ORDENAR PARTICIPANTES EN MÓVIL / PANTALLA */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <span className="text-base">🔀</span>
                <div>
                  <h4 className="font-extrabold text-sm">Ordenar Participantes</h4>
                  <p className="text-[10px] text-slate-400">Selecciona el criterio de organización</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Options List */}
            <div className="p-3 space-y-1.5 max-h-[70vh] overflow-y-auto">
              {[
                {
                  field: 'name' as PlannerSortField,
                  order: 'asc' as PlannerSortOrder,
                  icon: '🔤',
                  title: 'Nombre (A → Z)',
                  desc: 'Orden alfabético ascendente',
                },
                {
                  field: 'name' as PlannerSortField,
                  order: 'desc' as PlannerSortOrder,
                  icon: '🔤',
                  title: 'Nombre (Z → A)',
                  desc: 'Orden alfabético descendente',
                },
                {
                  field: 'remaining' as PlannerSortField,
                  order: 'desc' as PlannerSortOrder,
                  icon: '⏳',
                  title: 'Mayor Deuda / Falta primero (▼)',
                  desc: 'Primero los que tienen mayor saldo pendiente',
                },
                {
                  field: 'remaining' as PlannerSortField,
                  order: 'asc' as PlannerSortOrder,
                  icon: '⏳',
                  title: 'Menor Deuda / Falta primero (▲)',
                  desc: 'Primero los que deben menos o están al día',
                },
                {
                  field: 'collected' as PlannerSortField,
                  order: 'desc' as PlannerSortOrder,
                  icon: '💰',
                  title: 'Mayor Abono primero (▼)',
                  desc: 'Primero quienes han aportado mayor dinero',
                },
                {
                  field: 'collected' as PlannerSortField,
                  order: 'asc' as PlannerSortOrder,
                  icon: '💰',
                  title: 'Menor Abono primero (▲)',
                  desc: 'Primero quienes han aportado menor dinero',
                },
              ].map((opt, idx) => {
                const isSelected = plannerSortField === opt.field && plannerSortOrder === opt.order;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPlannerSortField(opt.field);
                      setPlannerSortOrder(opt.order);
                      setIsSortModalOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{opt.icon}</span>
                      <div className="min-w-0">
                        <span className={`text-xs font-bold block truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {opt.title}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {opt.desc}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE APORTES Y FECHAS DE UN PARTICIPANTE */}
      {selectedMemberDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-4 py-3.5 bg-blue-900 text-white shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm shrink-0">
                  {selectedMemberDetail.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm sm:text-base leading-tight truncate">
                    Aportes de {selectedMemberDetail}
                  </h4>
                  <p className="text-[11px] text-blue-200">
                    Historial de abonos, fechas y comprobantes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberDetail(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Lista de Aportes */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {(() => {
                const memberStat = prepaidStats?.membersStats.find(
                  (m) => m.name.trim().toLowerCase() === (selectedMemberDetail || '').trim().toLowerCase()
                );
                const memberContribs = (sheet.prepaidConfig?.contributions || [])
                  .filter((c) => resolveMemberForContribution(c.member, members) === selectedMemberDetail)
                  .sort((a, b) => (b.date || 0) - (a.date || 0));

                return (
                  <>
                    {/* Tarjeta Resumen y Estado (Combinación de Imagen 1 e Imagen 2) */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                      {/* Fila superior: Avatar + Nombre + Contador + Badge Estado */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${memberStat?.isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                            {selectedMemberDetail.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-sm text-slate-900 block truncate leading-tight">{selectedMemberDetail}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              {memberContribs.length} {memberContribs.length === 1 ? 'abono realizado' : 'abonos realizados'}
                            </span>
                          </div>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border shrink-0 ${memberStat?.isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'}`}>
                          {memberStat?.isCompleted ? '✓ Cuota Completa' : `Falta ${100 - (memberStat?.percent || 0)}%`}
                        </span>
                      </div>

                      {/* Fila de montos: Abonado vs Cuota */}
                      <div className="flex items-center justify-between text-xs font-mono pt-1.5 border-t border-slate-200">
                        <div>
                          <span className="text-slate-500 font-sans mr-1">Abonado:</span>
                          <strong className="text-slate-900 font-black">{formatCurrency(memberStat?.collectedInBase || 0, plannerCurrency, 2)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 font-sans mr-1">Cuota:</span>
                          <strong className="text-slate-900 font-black">{formatCurrency(memberStat?.quotaInBase || 0, plannerCurrency, 2)}</strong>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${memberStat?.isCompleted ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, Math.max(0, memberStat?.percent || 0))}%` }}
                        />
                      </div>

                      {/* Caja de FALTA POR ABONAR en 4 Monedas (Imagen 1) */}
                      {!memberStat?.isCompleted && (memberStat?.remainingInBase || 0) > 0.001 && (
                        <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-xs font-extrabold text-rose-800">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>FALTA POR ABONAR:</span>
                            </div>
                            <span className="font-mono font-black text-rose-900">{formatCurrency(memberStat?.remainingInBase || 0, plannerCurrency, 2)}</span>
                          </div>

                          {/* Grid de las 4 Monedas */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                            <div className="bg-white border border-blue-200 rounded-lg p-1.5 shadow-2xs">
                              <span className="text-[9px] text-blue-500 font-bold uppercase block">USD</span>
                              <span className="font-bold text-slate-900">${formatNumber(memberStat?.remainingInAllCurrencies.USD || 0, 2)}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-2xs">
                              <span className="text-[9px] text-slate-500 font-bold uppercase block">VES</span>
                              <span className="font-bold text-slate-900">Bs {formatNumber(memberStat?.remainingInAllCurrencies.VES || 0, 2)}</span>
                            </div>
                            <div className="bg-white border border-amber-200 rounded-lg p-1.5 shadow-2xs">
                              <span className="text-[9px] text-amber-600 font-bold uppercase block">USDT</span>
                              <span className="font-bold text-amber-900">{formatNumber(memberStat?.remainingInAllCurrencies.USDT || 0, 2)}</span>
                            </div>
                            <div className="bg-white border border-emerald-200 rounded-lg p-1.5 shadow-2xs">
                              <span className="text-[9px] text-emerald-600 font-bold uppercase block">EUR</span>
                              <span className="font-bold text-emerald-900">€ {formatNumber(memberStat?.remainingInAllCurrencies.EUR || 0, 2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón Prominente para Registrar Abono */}
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenQuickAbono(selectedMemberDetail);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>+ Registrar Nuevo Abono para {selectedMemberDetail}</span>
                    </button>

                    {/* Lista de Abonos */}
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-slate-700 block">
                        Historial de Abonos ({memberContribs.length})
                      </span>

                      {memberContribs.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs space-y-2">
                          <Clock className="w-6 h-6 mx-auto text-slate-300" />
                          <p>Aún no hay abonos registrados para {selectedMemberDetail}.</p>
                        </div>
                      ) : (
                        memberContribs.map((c) => (
                          <div
                            key={c.id}
                            className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-blue-300 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-extrabold text-slate-900 text-sm">
                                  {formatCurrency(c.amount, c.currency, 2)}
                                </span>
                                {c.currency !== settings.displayCurrency && (
                                  <span className="text-[11px] font-mono text-slate-500">
                                    (~{formatCurrency(convertCurrency(c.amount, c.currency, settings.displayCurrency, rates), settings.displayCurrency, 2)})
                                  </span>
                                )}
                              </div>

                              {/* FECHA Y HORA (Importante) */}
                              <div className="flex items-center gap-1 text-[11px] text-blue-700 font-medium mt-0.5">
                                <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{formatContributionDate(c.date)}</span>
                              </div>

                              {/* NOTA O CONCEPTO */}
                              {c.note && (
                                <p className="text-xs text-slate-600 italic mt-0.5 truncate">
                                  "{c.note}"
                                </p>
                              )}
                            </div>

                            {/* Botones de Editar y Eliminar */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingContrib(c)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer transition-colors"
                                title="Editar este abono"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setContribToDelete(c)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                title="Eliminar este abono"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedMemberDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR ABONO */}
      {editingContrib && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-blue-900 text-white">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-300" />
                <h4 className="font-extrabold text-sm">Editar Abono</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingContrib(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const amt = parseFloat((form.elements.namedItem('editAmount') as HTMLInputElement).value.replace(',', '.'));
                if (isNaN(amt) || amt <= 0) return;
                const curr = (form.elements.namedItem('editCurrency') as HTMLSelectElement).value as Currency;
                const note = (form.elements.namedItem('editNote') as HTMLInputElement).value;
                const dateStr = (form.elements.namedItem('editDate') as HTMLInputElement).value;
                const date = dateStr ? new Date(dateStr).getTime() : editingContrib.date;

                handleUpdateContribution({
                  ...editingContrib,
                  amount: amt,
                  currency: curr,
                  note: note.trim() || undefined,
                  date: date || Date.now(),
                });
              }}
              className="p-4 space-y-3 text-xs text-slate-800"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Participante</label>
                <input
                  type="text"
                  disabled
                  value={editingContrib.member}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2 font-bold text-slate-600 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto y Moneda</label>
                <div className="flex gap-2">
                  <input
                    name="editAmount"
                    type="number"
                    min="0.01"
                    step="any"
                    defaultValue={editingContrib.amount}
                    required
                    className="flex-1 bg-white border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    name="editCurrency"
                    defaultValue={editingContrib.currency}
                    className="w-24 bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs"
                  >
                    {ALL_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Fecha del Abono</label>
                <input
                  name="editDate"
                  type="datetime-local"
                  defaultValue={editingContrib.date ? new Date(editingContrib.date).toISOString().slice(0, 16) : ''}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Concepto / Nota</label>
                <input
                  name="editNote"
                  type="text"
                  defaultValue={editingContrib.note || ''}
                  placeholder="Ej: Pago de pasajes..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingContrib(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINAR ABONO */}
      {contribToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">¿Eliminar este abono?</h4>
                <p className="text-xs text-slate-500">Historial de abonos de la colecta</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Persona:</span>
                <span className="font-bold text-slate-900 text-sm">{contribToDelete.member}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Monto abonado:</span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  {formatCurrency(contribToDelete.amount, contribToDelete.currency, 2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Fecha:</span>
                <span className="font-mono text-slate-700">{formatContributionDate(contribToDelete.date)}</span>
              </div>
              {contribToDelete.note && (
                <div className="pt-1.5 border-t border-slate-200/70">
                  <span className="text-slate-400 font-medium block text-[10px]">Concepto / Nota:</span>
                  <span className="text-slate-700 italic font-medium">"{contribToDelete.note}"</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              El total recaudado se descontará inmediatamente y se recalcularán los porcentajes de avance de la meta.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setContribToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteContribution(contribToDelete.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, eliminar abono</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ABONO RÁPIDO PARA EL PLANNER */}
      {isQuickAbonoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-blue-900 text-white">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-white/20">
                  <Plane className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm">Registrar Abono al Fondo</h4>
                  <p className="text-[10.5px] text-blue-200">Planificación de Viaje & Colecta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAbonoOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickAbono} className="p-4 space-y-3.5 text-xs text-slate-800">
              {/* Persona que abona */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">¿Quién realizó el abono?</label>
                <select
                  value={quickAbonoMember}
                  onChange={(e) => setQuickAbonoMember(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto y Moneda */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto Abonado</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={quickAbonoAmount}
                    onChange={(e) => setQuickAbonoAmount(e.target.value)}
                    placeholder="Ej: 50"
                    autoFocus
                    className="flex-1 bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={quickAbonoCurrency}
                    onChange={(e) => setQuickAbonoCurrency(e.target.value as Currency)}
                    className="w-24 bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none cursor-pointer"
                  >
                    {ALL_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fecha del abono */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Fecha del Abono</label>
                <input
                  type="datetime-local"
                  value={quickAbonoDate}
                  onChange={(e) => setQuickAbonoDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Concepto / Nota */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Concepto / Nota <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={quickAbonoNote}
                  onChange={(e) => setQuickAbonoNote(e.target.value)}
                  placeholder="Ej: Pago móvil Bs, Zelle, efectivo..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {quickAbonoError && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {quickAbonoError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAbonoOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar y Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTAR META TOTAL FUERA */}
      {isEditingTargetOutside && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-blue-100 text-blue-700">
                  <Target className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">Ajustar Meta Total</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTargetOutside(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto Meta Total</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={outsideTargetInput}
                  onChange={(e) => setOutsideTargetInput(e.target.value)}
                  placeholder="Ej: 500"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Moneda de la Meta</label>
                <select
                  value={outsideTargetCurrency}
                  onChange={(e) => setOutsideTargetCurrency(e.target.value as Currency)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none cursor-pointer"
                >
                  {ALL_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c} ({CURRENCY_CONFIG[c].name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditingTargetOutside(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const num = parseFloat(outsideTargetInput.replace(',', '.'));
                  if (!isNaN(num) && num > 0) {
                    const currentConfig = sheet.prepaidConfig || createDefaultPrepaidConfig(0, 'USD');
                    const nextConfig = {
                      ...currentConfig,
                      targetAmount: num,
                      targetCurrency: outsideTargetCurrency,
                    };
                    if (onUpdatePrepaidConfig) {
                      onUpdatePrepaidConfig(nextConfig);
                    }
                  }
                  setIsEditingTargetOutside(false);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Guardar Meta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR VACIAR CONTEXTUAL SEGÚN EL MODO ACTIVO */}
      {confirmClearRows && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in select-none">
          <div className="bg-white rounded-2xl p-4 sm:p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  {isPrepaidMode
                    ? '¿Vaciar datos del Planner?'
                    : isTricountActive
                    ? '¿Vaciar datos de Tripcount?'
                    : '¿Vaciar filas de la tabla?'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isPrepaidMode
                    ? 'Limpia únicamente los abonos y cuotas del Planner'
                    : isTricountActive
                    ? 'Limpia únicamente los pagos y abonos parciales de Tripcount'
                    : 'Limpia las operaciones de la tabla activa'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-950 text-xs space-y-1.5 leading-relaxed">
              <p className="font-bold">Se borrará únicamente:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] font-medium text-rose-900">
                {isPrepaidMode ? (
                  <>
                    <li>Historial de abonos del Planner ({sheet.prepaidConfig?.contributions?.length || 0} abonos)</li>
                    <li>Cuotas personalizadas fijadas para la meta</li>
                  </>
                ) : isTricountActive ? (
                  <>
                    <li>Todas las deudas liquidadas de Tripcount</li>
                    <li>Los abonos parciales registrados entre participantes</li>
                  </>
                ) : (
                  <li>Todas las filas de operaciones ({sheet.rows?.length || 0} filas)</li>
                )}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmClearRows(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPrepaidMode) {
                    if (onUpdatePrepaidConfig) {
                      onUpdatePrepaidConfig({
                        ...(sheet.prepaidConfig || createDefaultPrepaidConfig(0, 'USD')),
                        contributions: [],
                        customQuotas: {},
                      });
                    }
                  } else if (isTricountActive) {
                    if (onUpdateSettledTransfers) onUpdateSettledTransfers({});
                    if (onUpdateSettledDebtors) onUpdateSettledDebtors({});
                    if (onUpdatePartialSettlements) onUpdatePartialSettlements({});
                  } else {
                    onClearRows();
                  }
                  setConfirmClearRows(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Trash2 className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {isPrepaidMode
                    ? 'Sí, Vaciar Planner'
                    : isTricountActive
                    ? 'Sí, Vaciar Tripcount'
                    : 'Sí, Vaciar Filas'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACIÓN DE FUNCIONES EN PULSACIÓN LARGA */}
      <FunctionInfoModal
        info={helpInfo}
        onClose={() => setHelpInfo(null)}
      />
    </div>
  );
};
