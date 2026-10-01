import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  X,
  Copy,
  Check,
  ArrowRight,
  Plane,
  Receipt,
  Pencil,
  Target,
  Wallet,
  CheckCircle2,
  Calendar,
  Sparkles,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  Save,
  Clock,
} from 'lucide-react';
import {
  Sheet,
  ComputedRow,
  Currency,
  RatesState,
  AppSettings,
  TricountMode,
  TricountPrepaidConfig,
  TricountContribution,
  TricountGroup,
} from '../types';
import {
  ALL_CURRENCIES,
  CURRENCY_CONFIG,
  formatCurrency,
  formatNumber,
  convertCurrency,
  convertToVES,
} from '../utils/currency';
import {
  calculatePrepaidTripStats,
  createDefaultPrepaidConfig,
  formatPrepaidWhatsAppReport,
} from '../utils/tricountPrepaid';

interface TricountModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: Sheet;
  sheets?: Sheet[];
  onSelectSheet?: (sheetId: string) => void;
  computedRows: ComputedRow[];
  rates: RatesState;
  settings: AppSettings;
  onUpdateSheetMembers?: (members: string[]) => void;
  onUpdateMembers?: (members: string[]) => void;
  onUpdateRowPayer?: (rowId: string, payer: string) => void;
  onUpdateSheetTricountMode?: (mode: TricountMode) => void;
  onUpdatePrepaidConfig?: (config: TricountPrepaidConfig) => void;
  onUpdateSettledTransfers?: (settledTransfers: Record<string, boolean>) => void;
  onUpdateSettledDebtors?: (settledDebtors: Record<string, boolean>) => void;
  onUpdatePartialSettlements?: (partialSettlements: Record<string, number>) => void;
  tricountGroups?: TricountGroup[];
  onOpenTricountGroups?: () => void;
  onAssociateTricountGroup?: (groupId: string) => void;
  onCreateTricountGroup?: (name: string, members: string[], description?: string) => void;
  onUpdateTricountGroup?: (id: string, name: string, members: string[], description?: string) => void;
  onDeleteTricountGroup?: (id: string) => void;
}

interface TransferInstruction {
  from: string;
  to: string;
  amount: number;
  amountsInAllCurrencies: Record<Currency, number>;
}

export const TricountModal: React.FC<TricountModalProps> = ({
  isOpen,
  onClose,
  sheet,
  sheets,
  onSelectSheet,
  computedRows,
  rates,
  settings,
  onUpdateSheetMembers,
  onUpdateMembers,
  onUpdateRowPayer,
  onUpdateSheetTricountMode,
  onUpdatePrepaidConfig,
  onUpdateSettledTransfers,
  onUpdateSettledDebtors,
  onUpdatePartialSettlements,
  tricountGroups = [],
  onOpenTricountGroups,
  onAssociateTricountGroup,
  onCreateTricountGroup,
  onUpdateTricountGroup,
  onDeleteTricountGroup,
}) => {
  const updateMembersCallback = onUpdateSheetMembers || onUpdateMembers;

  // Active top navigation tab: 'planner' | 'tripcount' | 'groups'
  const [activeTab, setActiveTab] = useState<'planner' | 'tripcount' | 'groups'>(() => {
    return sheet.tricountMode === 'prepaid' ? 'planner' : 'tripcount';
  });

  // Sync tab with sheet mode
  useEffect(() => {
    if (isOpen) {
      if (sheet.tricountMode === 'prepaid') {
        setActiveTab('planner');
      } else {
        setActiveTab('tripcount');
      }
    }
  }, [isOpen, sheet.id, sheet.tricountMode]);

  // Local state for participants
  const [localMembers, setLocalMembers] = useState<string[]>(() => sheet.members || ['Yo', 'Amigo 1']);
  const [newMemberName, setNewMemberName] = useState('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [settleCurrency, setSettleCurrency] = useState<Currency>(settings.displayCurrency);
  const [copied, setCopied] = useState(false);
  const [copiedPrepaid, setCopiedPrepaid] = useState(false);

  // Group Management in Groups Tab
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newGroupMemberInput, setNewGroupMemberInput] = useState('');
  const [groupFormError, setGroupFormError] = useState<string | null>(null);

  // Keep local members in sync with sheet changes
  useEffect(() => {
    setLocalMembers(sheet.members && sheet.members.length > 0 ? sheet.members : ['Yo', 'Amigo 1']);
  }, [sheet.id, sheet.members]);

  const members = localMembers;

  // Prepaid Config State
  const [prepaidConfig, setPrepaidConfig] = useState<TricountPrepaidConfig>(() => {
    return sheet.prepaidConfig || createDefaultPrepaidConfig(500, 'USD');
  });

  useEffect(() => {
    if (sheet.prepaidConfig) {
      setPrepaidConfig(sheet.prepaidConfig);
    } else {
      setPrepaidConfig(createDefaultPrepaidConfig(500, 'USD'));
    }
  }, [sheet.id, sheet.prepaidConfig]);

  // Handler to update prepaid config
  const updatePrepaidConfigState = (newConfig: TricountPrepaidConfig) => {
    setPrepaidConfig(newConfig);
    if (onUpdatePrepaidConfig) {
      onUpdatePrepaidConfig(newConfig);
    }
  };

  // Add / Edit / Delete Contribution Modal state
  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [contribToDelete, setContribToDelete] = useState<TricountContribution | null>(null);
  const [contribMember, setContribMember] = useState('');
  const [contribAmount, setContribAmount] = useState('');
  const [contribCurrency, setContribCurrency] = useState<Currency>(settings.displayCurrency);
  const [contribDate, setContribDate] = useState<string>('');
  const [contribNote, setContribNote] = useState('');
  const [contribError, setContribError] = useState<string | null>(null);

  // Settled / Paid transfers state (indicates who has already paid)
  const [settledTransfers, setSettledTransfers] = useState<Record<string, boolean>>(
    () => sheet.settledTransfers || {}
  );
  const [settledDebtors, setSettledDebtors] = useState<Record<string, boolean>>(
    () => sheet.settledDebtors || {}
  );
  const [partialSettlements, setPartialSettlements] = useState<Record<string, number>>(
    () => sheet.partialSettlements || {}
  );
  const [partialModalTransfer, setPartialModalTransfer] = useState<{ from: string; to: string; fullAmount: number } | null>(null);
  const [partialInputAmount, setPartialInputAmount] = useState('');

  useEffect(() => {
    setSettledTransfers(sheet.settledTransfers || {});
    setSettledDebtors(sheet.settledDebtors || {});
    setPartialSettlements(sheet.partialSettlements || {});
  }, [sheet.id, sheet.settledTransfers, sheet.settledDebtors, sheet.partialSettlements]);

  // Target editing state
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInputVal, setTargetInputVal] = useState(String(prepaidConfig.targetAmount || 500));
  const [targetCurrencyVal, setTargetCurrencyVal] = useState<Currency>(prepaidConfig.targetCurrency || 'USD');
  const [targetSuccessMessage, setTargetSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (prepaidConfig.targetAmount) {
      setTargetInputVal(String(prepaidConfig.targetAmount));
    }
    if (prepaidConfig.targetCurrency) {
      setTargetCurrencyVal(prepaidConfig.targetCurrency);
    }
  }, [prepaidConfig.targetAmount, prepaidConfig.targetCurrency]);

  // Custom Quotas Drawer/State
  const [showCustomQuotas, setShowCustomQuotas] = useState(false);
  const [customQuotasState, setCustomQuotasState] = useState<Record<string, string>>({});

  // Group Modals & Renaming/Deleting State
  const [isSaveGroupModalOpen, setIsSaveGroupModalOpen] = useState(false);
  const [saveGroupNameVal, setSaveGroupNameVal] = useState('');
  const [editingGroupObj, setEditingGroupObj] = useState<{ id: string; name: string } | null>(null);
  const [editingGroupNameVal, setEditingGroupNameVal] = useState('');
  const [groupToDeleteObj, setGroupToDeleteObj] = useState<{ id: string; name: string } | null>(null);

  // Initialize custom quotas state
  useEffect(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => {
      map[m] =
        prepaidConfig.customQuotas && prepaidConfig.customQuotas[m] !== undefined
          ? String(prepaidConfig.customQuotas[m])
          : '';
    });
    setCustomQuotasState(map);
  }, [members, prepaidConfig.customQuotas]);

  // Compute Prepaid Stats (uses the planner target currency)
  const prepaidCurrency: Currency = prepaidConfig.targetCurrency || settings.displayCurrency;

  const prepaidStats = useMemo(() => {
    return calculatePrepaidTripStats(members, prepaidConfig, rates, prepaidCurrency);
  }, [members, prepaidConfig, rates, prepaidCurrency]);

  // Compute Postpaid Stats
  const postpaidStats = useMemo(() => {
    const paidByPerson: Record<string, number> = {};
    members.forEach((m) => {
      paidByPerson[m] = 0;
    });

    let totalSharedExpense = 0;

    computedRows.forEach((row) => {
      const valInSettle = Math.abs(row.equivalents[settleCurrency]);
      const payer = row.payer && members.includes(row.payer) ? row.payer : members[0];

      if (payer && valInSettle > 0) {
        paidByPerson[payer] = (paidByPerson[payer] || 0) + valInSettle;
        totalSharedExpense += valInSettle;
      }
    });

    const activeMembersCount = members.length > 0 ? members.length : 1;
    const fairShare = members.length > 0 ? totalSharedExpense / activeMembersCount : 0;

    const balances: Record<string, number> = {};
    members.forEach((m) => {
      balances[m] = (paidByPerson[m] || 0) - fairShare;
    });

    const debtors: { name: string; amount: number }[] = [];
    const creditors: { name: string; amount: number }[] = [];

    members.forEach((m) => {
      const bal = balances[m];
      if (bal < -0.009) {
        debtors.push({ name: m, amount: -bal });
      } else if (bal > 0.009) {
        creditors.push({ name: m, amount: bal });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers: TransferInstruction[] = [];
    let dIdx = 0;
    let cIdx = 0;

    const debtorsCopy = debtors.map((d) => ({ ...d }));
    const creditorsCopy = creditors.map((c) => ({ ...c }));

    while (dIdx < debtorsCopy.length && cIdx < creditorsCopy.length) {
      const debtor = debtorsCopy[dIdx];
      const creditor = creditorsCopy[cIdx];

      const settlement = Math.min(debtor.amount, creditor.amount);
      if (settlement > 0.001) {
        const amountsInAllCurrencies: Record<Currency, number> = {
          USD: convertCurrency(settlement, settleCurrency, 'USD', rates),
          VES: convertToVES(settlement, settleCurrency, rates),
          USDT: convertCurrency(settlement, settleCurrency, 'USDT', rates),
          EUR: convertCurrency(settlement, settleCurrency, 'EUR', rates),
        };

        transfers.push({
          from: debtor.name,
          to: creditor.name,
          amount: settlement,
          amountsInAllCurrencies,
        });
      }

      debtor.amount -= settlement;
      creditor.amount -= settlement;

      if (debtor.amount <= 0.009) dIdx++;
      if (creditor.amount <= 0.009) cIdx++;
    }

    return {
      paidByPerson,
      totalSharedExpense,
      fairShare,
      balances,
      transfers,
    };
  }, [members, computedRows, settleCurrency, rates]);

  // Tab change handler
  const handleSelectTab = (tab: 'planner' | 'tripcount' | 'groups') => {
    setActiveTab(tab);
    if (tab === 'planner') {
      if (onUpdateSheetTricountMode) {
        onUpdateSheetTricountMode('prepaid');
      }
    } else if (tab === 'tripcount') {
      if (onUpdateSheetTricountMode) {
        onUpdateSheetTricountMode('postpaid');
      }
    }
  };

  // Member Handlers
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    const name = newMemberName.trim();
    if (!name) return;

    if (members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      setMemberError('Esta persona ya está en la lista.');
      return;
    }

    const updated = [...members, name];
    setLocalMembers(updated);
    setNewMemberName('');
    if (updateMembersCallback) {
      updateMembersCallback(updated);
    }
  };

  const handleStartRename = (name: string) => {
    setEditingMember(name);
    setEditingNameVal(name);
  };

  const handleSaveRename = (oldName: string) => {
    const trimmed = editingNameVal.trim();
    if (!trimmed) {
      setEditingMember(null);
      return;
    }

    if (
      trimmed.toLowerCase() !== oldName.toLowerCase() &&
      members.some((m) => m.toLowerCase() === trimmed.toLowerCase())
    ) {
      setMemberError('Ya existe un participante con ese nombre.');
      return;
    }

    const updated = members.map((m) => (m === oldName ? trimmed : m));
    setLocalMembers(updated);
    setEditingMember(null);
    setEditingNameVal('');

    if (updateMembersCallback) {
      updateMembersCallback(updated);
    }

    // Update row payers
    if (onUpdateRowPayer) {
      computedRows.forEach((r) => {
        if (r.payer === oldName) {
          onUpdateRowPayer(r.id, trimmed);
        }
      });
    }

    // Update contributions member name
    const updatedContribs = (prepaidConfig.contributions || []).map((c) =>
      c.member === oldName ? { ...c, member: trimmed } : c
    );
    const updatedQuotas: Record<string, number> = {};
    if (prepaidConfig.customQuotas) {
      Object.entries(prepaidConfig.customQuotas).forEach(([k, v]) => {
        updatedQuotas[k === oldName ? trimmed : k] = Number(v);
      });
    }
    updatePrepaidConfigState({
      ...prepaidConfig,
      contributions: updatedContribs,
      customQuotas: updatedQuotas,
    });
  };

  const handleRemoveMember = (name: string) => {
    if (members.length <= 1) {
      setMemberError('Debe haber al menos un participante.');
      return;
    }
    const updated = members.filter((m) => m !== name);
    setLocalMembers(updated);
    if (updateMembersCallback) {
      updateMembersCallback(updated);
    }
  };

  // Target Save Handler: immediately updates config and sheet
  const handleSaveTarget = () => {
    const num = parseFloat(targetInputVal.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      return;
    }
    const nextConfig: TricountPrepaidConfig = {
      ...prepaidConfig,
      targetAmount: num,
      targetCurrency: targetCurrencyVal,
    };
    updatePrepaidConfigState(nextConfig);
    setIsEditingTarget(false);
    setTargetSuccessMessage('¡Meta y moneda actualizadas correctamente!');
    setTimeout(() => setTargetSuccessMessage(null), 2500);
  };

  // Open Add Contribution Modal for a specific member
  const handleOpenAddContribution = (memberName?: string) => {
    setEditingContribId(null);
    setContribMember(memberName || members[0] || 'Yo');
    setContribAmount('');
    setContribCurrency(prepaidConfig.targetCurrency);
    setContribDate(new Date().toISOString().slice(0, 16));
    setContribNote('');
    setContribError(null);
    setIsAddingContribution(true);
  };

  // Open Edit Contribution Modal
  const handleStartEditContribution = (c: TricountContribution) => {
    setEditingContribId(c.id);
    setContribMember(c.member);
    setContribAmount(String(c.amount));
    setContribCurrency(c.currency);
    setContribDate(
      c.date ? new Date(c.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    );
    setContribNote(c.note || '');
    setContribError(null);
    setIsAddingContribution(true);
  };

  // Save Contribution (Add or Edit)
  const handleSaveContribution = (e: React.FormEvent) => {
    e.preventDefault();
    setContribError(null);
    const val = parseFloat(contribAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setContribError('Ingresa un monto válido mayor a 0.');
      return;
    }
    if (!contribMember) {
      setContribError('Selecciona la persona que abona.');
      return;
    }

    const timestamp = contribDate ? new Date(contribDate).getTime() : Date.now();

    if (editingContribId) {
      const nextContribs = (prepaidConfig.contributions || []).map((c) =>
        c.id === editingContribId
          ? {
              ...c,
              member: contribMember,
              amount: val,
              currency: contribCurrency,
              date: isNaN(timestamp) ? c.date : timestamp,
              note: contribNote.trim() || undefined,
            }
          : c
      );
      updatePrepaidConfigState({
        ...prepaidConfig,
        contributions: nextContribs,
      });
      setEditingContribId(null);
      setIsAddingContribution(false);
      return;
    }

    const newContrib: TricountContribution = {
      id: 'contrib_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      member: contribMember,
      amount: val,
      currency: contribCurrency,
      date: isNaN(timestamp) ? Date.now() : timestamp,
      note: contribNote.trim() || undefined,
    };

    const nextContribs = [...(prepaidConfig.contributions || []), newContrib];
    updatePrepaidConfigState({
      ...prepaidConfig,
      contributions: nextContribs,
    });

    setIsAddingContribution(false);
  };

  // Delete Contribution
  const handleDeleteContribution = (id: string) => {
    const nextContribs = (prepaidConfig.contributions || []).filter((c) => c.id !== id);
    updatePrepaidConfigState({
      ...prepaidConfig,
      contributions: nextContribs,
    });
  };

  // Toggle settled / paid status for a transfer
  const handleToggleSettleTransfer = (from: string, to: string) => {
    const key = `${from}->${to}`;
    const nextVal = !settledTransfers[key];
    const updated = { ...settledTransfers, [key]: nextVal };
    setSettledTransfers(updated);
    if (onUpdateSettledTransfers) {
      onUpdateSettledTransfers(updated);
    }
  };

  // Toggle all debts settled for a person
  const handleToggleSettleDebtor = (debtorName: string) => {
    const isNowSettled = !settledDebtors[debtorName];
    const updatedDebtors = { ...settledDebtors, [debtorName]: isNowSettled };
    setSettledDebtors(updatedDebtors);
    if (onUpdateSettledDebtors) {
      onUpdateSettledDebtors(updatedDebtors);
    }

    const updatedTransfers = { ...settledTransfers };
    postpaidStats.transfers.forEach((t) => {
      if (t.from === debtorName) {
        updatedTransfers[`${t.from}->${t.to}`] = isNowSettled;
      }
    });
    setSettledTransfers(updatedTransfers);
    if (onUpdateSettledTransfers) {
      onUpdateSettledTransfers(updatedTransfers);
    }
  };

  // Save Custom Quotas
  const handleSaveCustomQuotas = () => {
    const newQuotas: Record<string, number> = {};
    members.forEach((m) => {
      const valStr = customQuotasState[m];
      if (valStr && valStr.trim() !== '') {
        const parsed = parseFloat(valStr.replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) {
          newQuotas[m] = parsed;
        }
      }
    });

    updatePrepaidConfigState({
      ...prepaidConfig,
      customQuotas: newQuotas,
    });
    setShowCustomQuotas(false);
  };

  const handleResetEqualQuotas = () => {
    updatePrepaidConfigState({
      ...prepaidConfig,
      customQuotas: {},
    });
    const map: Record<string, string> = {};
    members.forEach((m) => {
      map[m] = '';
    });
    setCustomQuotasState(map);
    setShowCustomQuotas(false);
  };

  // Copy WhatsApp Reports
  const handleCopyPostpaidReport = () => {
    let text = `👥 *TRIPCOUNT / GASTOS COMPARTIDOS*\n`;
    text += `📂 *Cuenta:* ${sheet.title}\n`;
    text += `💰 *Gasto Total:* ${formatCurrency(postpaidStats.totalSharedExpense, settleCurrency, settings.decimals)}\n`;
    text += `🤝 *Cuota por persona:* ${formatCurrency(postpaidStats.fairShare, settleCurrency, settings.decimals)}\n`;
    text += `───────────────────────────\n`;
    text += `📊 *PAGOS REALIZADOS:*\n`;
    members.forEach((m) => {
      const paid = postpaidStats.paidByPerson[m] || 0;
      const bal = postpaidStats.balances[m] || 0;
      const status =
        bal > 0.01
          ? `(recibe +${formatCurrency(bal, settleCurrency, settings.decimals)})`
          : bal < -0.01
          ? `(debe ${formatCurrency(Math.abs(bal), settleCurrency, settings.decimals)})`
          : `(al día)`;
      text += `• *${m}*: pagó ${formatCurrency(paid, settleCurrency, settings.decimals)} ${status}\n`;
    });

    text += `───────────────────────────\n`;
    text += `💸 *LIQUIDACIÓN: ¿QUIÉN LE DEBE A QUIÉN? (En las 4 monedas)*\n`;
    if (postpaidStats.transfers.length === 0) {
      text += `✅ ¡Todos están al día! Nadie se debe nada.\n`;
    } else {
      postpaidStats.transfers.forEach((t) => {
        const transferKey = `${t.from}->${t.to}`;
        const isSettled = Boolean(settledTransfers[transferKey] || settledDebtors[t.from]);
        if (isSettled) {
          text += `\n✅ *[LISTO / YA PAGÓ]* *${t.from}* ➔ *${t.to}*: ${formatCurrency(t.amountsInAllCurrencies.USD, 'USD', settings.decimals)} (Liquidado)\n`;
        } else {
          text += `\n⏳ *[PENDIENTE]* *${t.from}* le paga a *${t.to}*:\n`;
          text += `   • ${formatCurrency(t.amountsInAllCurrencies.USD, 'USD', settings.decimals)} (Dólares)\n`;
          text += `   • ${formatCurrency(t.amountsInAllCurrencies.VES, 'VES', settings.decimals)} (Bolívares)\n`;
          text += `   • ${formatCurrency(t.amountsInAllCurrencies.USDT, 'USDT', settings.decimals)} (USDT)\n`;
          text += `   • ${formatCurrency(t.amountsInAllCurrencies.EUR, 'EUR', settings.decimals)} (Euros)\n`;
        }
      });
    }
    text += `───────────────────────────\n`;
    text += `_Calculado con ProCalc_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyPrepaidReport = () => {
    const text = formatPrepaidWhatsAppReport(sheet.title, prepaidStats, settings.decimals);
    navigator.clipboard.writeText(text);
    setCopiedPrepaid(true);
    setTimeout(() => setCopiedPrepaid(false), 2500);
  };

  // Group creation / save from active members
  const handleSaveCurrentMembersAsNewGroup = () => {
    if (members.length === 0) return;
    const defaultName = `Grupo ${sheet.title}`;
    if (onCreateTricountGroup) {
      onCreateTricountGroup(defaultName, members, `Creado desde la cuenta "${sheet.title}"`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        id="tricount-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-scale-up text-slate-800"
      >
        {/* 1. MODAL HEADER WITH MAIN TITLE & CLOSE */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`p-2 rounded-xl text-white shadow-2xs shrink-0 ${
                activeTab === 'planner'
                  ? 'bg-blue-600'
                  : activeTab === 'tripcount'
                  ? 'bg-emerald-600'
                  : 'bg-indigo-600'
              }`}
            >
              {activeTab === 'planner' ? (
                <Plane className="w-5 h-5" />
              ) : activeTab === 'tripcount' ? (
                <Receipt className="w-5 h-5" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                  {activeTab === 'planner'
                    ? 'Planner • Planificación & Colecta'
                    : activeTab === 'tripcount'
                    ? 'Tripcount • Gastos Compartidos'
                    : 'Gestión de Grupos e Integrantes'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-200 text-slate-800 font-bold shrink-0">
                  {members.length} {members.length === 1 ? 'persona' : 'personas'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Cuenta activa: <span className="font-semibold text-slate-700">{sheet.title}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. TOP SEGMENTED CONTROL: 1. Planner | 2. Tripcount | 3. Grupos */}
        <div className="px-3 sm:px-5 py-2 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center p-1 bg-slate-200/80 rounded-xl w-full sm:w-auto">
            {/* Tab 1: Planner (Prepago / Colecta) */}
            <button
              type="button"
              onClick={() => handleSelectTab('planner')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'planner'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plane className="w-3.5 h-3.5 shrink-0" />
              <span>Planner</span>
            </button>

            {/* Tab 2: Tripcount (Postpago / Gastos Compartidos) */}
            <button
              type="button"
              onClick={() => handleSelectTab('tripcount')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'tripcount'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span>Tripcount</span>
            </button>

            {/* Tab 3: Grupos (Gestión de Grupos y Participantes) */}
            <button
              type="button"
              onClick={() => handleSelectTab('groups')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'groups'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Grupos</span>
            </button>
          </div>

          {/* Settle Currency switcher (Only on Planner / Tripcount) */}
          {activeTab !== 'groups' && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end text-xs">
              <span className="text-slate-500 font-medium text-[11px]">Ver en:</span>
              <select
                value={settleCurrency}
                onChange={(e) => setSettleCurrency(e.target.value as Currency)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              >
                {ALL_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} ({CURRENCY_CONFIG[c].name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3. MODAL CONTENT BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-slate-800">

          {/* ========================================================================= */}
          {/* TAB 1: PLANNER (PLANIFICACIÓN DE VIAJE / COLECTA / PREPAGO)               */}
          {/* ========================================================================= */}
          {activeTab === 'planner' && (
            <div className="space-y-4">
              {/* Target Banner / Config Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 border border-blue-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                      <Target className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-blue-950 block">
                        Presupuesto / Meta a Reunir
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Define el monto total y la moneda para la colecta de esta cuenta
                      </span>
                    </div>
                  </div>

                  {/* Edit Meta Form or Trigger */}
                  {!isEditingTarget ? (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-black font-mono text-blue-950 block">
                          {formatCurrency(prepaidConfig.targetAmount, prepaidConfig.targetCurrency, 2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetInputVal(String(prepaidConfig.targetAmount));
                          setTargetCurrencyVal(prepaidConfig.targetCurrency);
                          setIsEditingTarget(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Cambiar</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={targetInputVal}
                        onChange={(e) => setTargetInputVal(e.target.value)}
                        placeholder="Ej: 500"
                        className="w-24 px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs font-mono font-bold text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <select
                        value={targetCurrencyVal}
                        onChange={(e) => setTargetCurrencyVal(e.target.value as Currency)}
                        className="bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer"
                      >
                        {ALL_CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSaveTarget}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        title="Guardar meta y moneda"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingTarget(false)}
                        className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {targetSuccessMessage && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{targetSuccessMessage}</span>
                  </div>
                )}

                {/* Progress Bar & Key Numbers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span>Progreso de recaudación:</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold font-mono text-[11px]">
                        {prepaidStats.progressPercent.toFixed(1)}%
                      </span>
                    </span>
                    <span className="text-slate-500 text-[11px] font-mono">
                      {formatCurrency(prepaidStats.totalCollectedInBase, prepaidCurrency, settings.decimals)} de{' '}
                      {formatCurrency(prepaidStats.totalTargetInBase, prepaidCurrency, settings.decimals)}
                    </span>
                  </div>

                  {/* Progress Bar with vibrant fill */}
                  <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden p-0.5 border border-slate-300/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        prepaidStats.isGoalReached
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(prepaidStats.progressPercent, 2))}%` }}
                    />
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Meta Total</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block truncate">
                      {formatCurrency(prepaidStats.totalTargetInBase, prepaidCurrency, settings.decimals)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {prepaidConfig.targetAmount} {prepaidConfig.targetCurrency}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Cuota p/p</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-blue-900 block truncate">
                      {formatCurrency(
                        prepaidStats.totalTargetInBase / (members.length || 1),
                        prepaidCurrency,
                        settings.decimals
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomQuotas(!showCustomQuotas)}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    >
                      {showCustomQuotas ? 'Ocultar' : 'Personalizar'}
                    </button>
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">Abonado</span>
                      <span className="text-[9px] font-extrabold px-1 rounded bg-emerald-300 text-emerald-950">
                        {prepaidStats.progressPercent.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700 block truncate">
                      {formatCurrency(prepaidStats.totalCollectedInBase, prepaidCurrency, settings.decimals)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {prepaidStats.contributions.length} abonos
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Falta</span>
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono block truncate ${
                        prepaidStats.isGoalReached ? 'text-emerald-700' : 'text-amber-800'
                      }`}
                    >
                      {prepaidStats.isGoalReached
                        ? '¡Meta lista! 🎉'
                        : formatCurrency(prepaidStats.totalRemainingInBase, prepaidCurrency, settings.decimals)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {prepaidStats.isGoalReached
                        ? '100% cubierto'
                        : `Restan ${(100 - prepaidStats.progressPercent).toFixed(1)}%`}
                    </span>
                  </div>
                </div>

                {/* Multicurrency breakdown of Remaining Total */}
                {!prepaidStats.isGoalReached && (
                  <div className="p-2.5 rounded-lg bg-blue-950/5 border border-blue-200/60 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                      Falta en total en las 4 monedas:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center font-mono font-bold text-xs">
                      <div className="p-1 bg-white rounded border border-blue-200 text-blue-900">
                        $ {formatNumber(prepaidStats.amountsInAllCurrencies.remaining.USD, 2)}
                      </div>
                      <div className="p-1 bg-white rounded border border-slate-300 text-slate-900">
                        Bs {formatNumber(prepaidStats.amountsInAllCurrencies.remaining.VES, 2)}
                      </div>
                      <div className="p-1 bg-white rounded border border-orange-200 text-orange-900">
                        {formatNumber(prepaidStats.amountsInAllCurrencies.remaining.USDT, 2)} USDT
                      </div>
                      <div className="p-1 bg-white rounded border border-emerald-200 text-emerald-900">
                        € {formatNumber(prepaidStats.amountsInAllCurrencies.remaining.EUR, 2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Quotas Drawer */}
              {showCustomQuotas && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-950 block">Cuotas Personalizadas</span>
                      <span className="text-[11px] text-slate-500">
                        Modifica el monto objetivo específico en {prepaidConfig.targetCurrency} para cada persona.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetEqualQuotas}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold text-[10px] cursor-pointer"
                    >
                      Restablecer equitativo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {members.map((m) => (
                      <div key={m} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-800 truncate">{m}:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder={String(
                              (prepaidConfig.targetAmount / (members.length || 1)).toFixed(2)
                            )}
                            value={customQuotasState[m] ?? ''}
                            onChange={(e) =>
                              setCustomQuotasState({
                                ...customQuotasState,
                                [m]: e.target.value,
                              })
                            }
                            className="w-20 px-2 py-0.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                          />
                          <span className="text-[10px] font-bold text-slate-500">
                            {prepaidConfig.targetCurrency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveCustomQuotas}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                    >
                      Aplicar Cuotas
                    </button>
                  </div>
                </div>
              )}

              {/* Notice & Quick WhatsApp Copy */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>
                    <strong>Gestión activa en pantalla principal:</strong> Toca <strong>"Meta Total"</strong> afuera para ajustar el presupuesto, o toca la tarjeta de cualquier persona para registrar abonos y ver su desglose en 4 monedas.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPrepaidReport}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs shrink-0 active:scale-95"
                  title="Copiar reporte formateado de recaudación para WhatsApp"
                >
                  {copiedPrepaid ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Reporte WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TRIPCOUNT (GASTOS COMPARTIDOS / POSTPAGO / LIQUIDACIÓN)            */}
          {/* ========================================================================= */}
          {activeTab === 'tripcount' && (
            <div className="space-y-4">
              {/* Postpaid Summary Banner - 3 Tarjetas en 1 Sola Línea */}
              <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border border-emerald-200 shadow-2xs">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-center sm:text-left">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Gasto Total</span>
                    <span className="text-xs sm:text-base font-extrabold font-mono text-slate-900 block truncate mt-0.5">
                      {formatCurrency(postpaidStats.totalSharedExpense, settleCurrency, settings.decimals)}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-center sm:text-left">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Cuota p/p</span>
                    <span className="text-xs sm:text-base font-extrabold font-mono text-emerald-800 block truncate mt-0.5">
                      {formatCurrency(postpaidStats.fairShare, settleCurrency, settings.decimals)}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-center sm:text-left">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Participantes</span>
                    <span className="text-xs sm:text-base font-extrabold font-mono text-slate-900 block truncate mt-0.5">
                      {members.length} {members.length === 1 ? 'persona' : 'personas'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assign who paid each row */}
              {members.length > 0 && computedRows.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    1. ¿Quién pagó cada fila?
                  </h4>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {computedRows.map((row, idx) => {
                      const currentPayer = row.payer && members.includes(row.payer) ? row.payer : members[0];
                      return (
                        <div
                          key={row.id}
                          className="p-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="font-mono text-slate-400 text-[10px] font-bold">
                              #{idx + 1}
                            </span>
                            <span className="font-medium text-slate-800 truncate">
                              {row.concept || '(Sin descripción)'}
                            </span>
                            <span className="font-mono font-semibold text-slate-600 shrink-0 text-[11px]">
                              {formatCurrency(row.equivalents[settleCurrency], settleCurrency, settings.decimals)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-medium">Pagó:</span>
                            <select
                              value={currentPayer}
                              onChange={(e) => onUpdateRowPayer && onUpdateRowPayer(row.id, e.target.value)}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2 py-0.5 text-xs font-bold text-emerald-800 cursor-pointer focus:outline-none"
                            >
                              {members.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Debt Simplification & Transfers */}
              {members.length >= 2 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                    2. Liquidación • ¿Quién le debe a quién?
                  </h4>

                  {postpaidStats.transfers.length === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800 text-xs font-medium">
                      🎉 ¡Cuentas al día! Nadie se debe nada.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {postpaidStats.transfers.map((t, idx) => {
                        const transferKey = `${t.from}->${t.to}`;
                        const partialPaid = partialSettlements[transferKey] || 0;
                        const netRemaining = Math.max(0, t.amount - partialPaid);
                        const isSettled = Boolean(
                          settledTransfers[transferKey] || settledDebtors[t.from] || netRemaining <= 0.009
                        );

                        const remVES = convertToVES(netRemaining, settleCurrency, rates);
                        const remUSD = convertCurrency(netRemaining, settleCurrency, 'USD', rates);
                        const remEUR = convertCurrency(netRemaining, settleCurrency, 'EUR', rates);
                        const remUSDT = convertCurrency(netRemaining, settleCurrency, 'USDT', rates);

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl shadow-2xs space-y-2 border transition-all ${
                              isSettled
                                ? 'bg-emerald-50/40 border-emerald-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded border ${
                                    isSettled
                                      ? 'bg-slate-100 text-slate-500 line-through border-slate-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {t.from}
                                </span>
                                <span className="text-slate-400 text-xs font-normal">
                                  le debe pagar a
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {t.to}
                                </span>
                                {partialPaid > 0 && !isSettled && (
                                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-2xs">
                                    <span>Abonado: {formatCurrency(partialPaid, settleCurrency, 2)}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPartialModalTransfer({
                                          from: t.from,
                                          to: t.to,
                                          fullAmount: t.amount,
                                        });
                                        setPartialInputAmount(String(partialPaid));
                                      }}
                                      className="p-0.5 hover:bg-amber-200 rounded text-amber-900 cursor-pointer transition-colors"
                                      title="Editar este abono parcial"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = { ...partialSettlements };
                                        delete updated[transferKey];
                                        setPartialSettlements(updated);
                                        if (onUpdatePartialSettlements) {
                                          onUpdatePartialSettlements(updated);
                                        }
                                      }}
                                      className="p-0.5 hover:bg-rose-200 rounded text-rose-700 cursor-pointer transition-colors"
                                      title="Eliminar este abono parcial"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!isSettled && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPartialModalTransfer({
                                        from: t.from,
                                        to: t.to,
                                        fullAmount: t.amount,
                                      });
                                      setPartialInputAmount('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                    title="Registrar un abono parcial a esta deuda"
                                  >
                                    + Abono Parcial
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleToggleSettleTransfer(t.from, t.to)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                                    isSettled
                                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  {isSettled ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                      <span>✓ Listo / Pagó</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Marcar pagado</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 flex flex-col">
                                <span className="text-[10px] font-sans font-semibold text-blue-700">
                                  En Dólares ($):
                                </span>
                                <span className="font-mono font-extrabold text-xs sm:text-sm text-blue-950 mt-0.5">
                                  {formatCurrency(remUSD, 'USD', settings.decimals)}
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-slate-100/90 border border-slate-200 flex flex-col">
                                <span className="text-[10px] font-sans font-semibold text-slate-700">
                                  En Bolívares (Bs):
                                </span>
                                <span className="font-mono font-extrabold text-xs sm:text-sm text-slate-950 mt-0.5">
                                  {formatCurrency(remVES, 'VES', settings.decimals)}
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-orange-50/70 border border-orange-100 flex flex-col">
                                <span className="text-[10px] font-sans font-semibold text-orange-700">
                                  En USDT:
                                </span>
                                <span className="font-mono font-extrabold text-xs sm:text-sm text-orange-950 mt-0.5">
                                  {formatNumber(remUSDT, 2)}
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 flex flex-col">
                                <span className="text-[10px] font-sans font-semibold text-emerald-700">
                                  En Euros (€):
                                </span>
                                <span className="font-mono font-extrabold text-xs sm:text-sm text-emerald-950 mt-0.5">
                                  {formatCurrency(remEUR, 'EUR', settings.decimals)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Historial de Abonos y Liquidaciones de Tripcount */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                    <span>3. Historial de Abonos y Liquidaciones de Tripcount</span>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">
                      {Object.keys(partialSettlements).filter((k) => (partialSettlements[k] || 0) > 0).length + Object.keys(settledTransfers).filter((k) => settledTransfers[k]).length} registros
                    </span>
                  </h4>

                  {(() => {
                    const partialKeys = Object.keys(partialSettlements).filter((k) => (partialSettlements[k] || 0) > 0);
                    const settledKeys = Object.keys(settledTransfers).filter((k) => settledTransfers[k]);

                    if (partialKeys.length === 0 && settledKeys.length === 0) {
                      return (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs space-y-1">
                          <Clock className="w-5 h-5 mx-auto text-slate-300" />
                          <p>Aún no hay abonos ni liquidaciones registradas en Tripcount.</p>
                          <p className="text-[10px]">Usa <strong>"+ Abono Parcial"</strong> o <strong>"Marcar pagado"</strong> en cada deuda para registrarlos aquí.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                        {/* Abonos parciales */}
                        {partialKeys.map((key) => {
                          const [from, to] = key.split('->');
                          const amt = partialSettlements[key];
                          const matchedT = postpaidStats.transfers.find((t) => t.from === from && t.to === to);
                          const fullAmount = matchedT ? matchedT.amount : amt;

                          return (
                            <div
                              key={key}
                              className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded text-[10px]">
                                    Abono Parcial
                                  </span>
                                  <span>{from}</span>
                                  <span className="text-slate-400 font-normal">➔</span>
                                  <span className="text-emerald-800">{to}</span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                                  Abonó: <strong className="text-amber-800 font-bold">{formatCurrency(amt, settleCurrency, 2)}</strong>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartialModalTransfer({
                                      from,
                                      to,
                                      fullAmount,
                                    });
                                    setPartialInputAmount(String(amt));
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                                  title="Editar este abono parcial"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...partialSettlements };
                                    delete updated[key];
                                    setPartialSettlements(updated);
                                    if (onUpdatePartialSettlements) onUpdatePartialSettlements(updated);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                  title="Eliminar este abono parcial"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Deudas marcadas completas (Listo / Pagó) */}
                        {settledKeys.map((key) => {
                          const [from, to] = key.split('->');

                          return (
                            <div
                              key={key}
                              className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-2.5 shadow-2xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                                  <span className="bg-emerald-600 text-white px-1.5 py-0.2 rounded text-[10px]">
                                    ✓ Pagado Completo
                                  </span>
                                  <span>{from}</span>
                                  <span className="text-slate-400 font-normal">➔</span>
                                  <span className="text-emerald-800">{to}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...settledTransfers, [key]: false };
                                    setSettledTransfers(updated);
                                    if (onUpdateSettledTransfers) onUpdateSettledTransfers(updated);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                  title="Deshacer o eliminar este pago completo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: GESTIÓN DE GRUPOS E INTEGRANTES                                    */}
          {/* ========================================================================= */}
          {activeTab === 'groups' && (
            <div className="space-y-4">
              {/* 1. Selector de Grupo para esta Cuenta (Carga Visual Reducida) */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs shrink-0">
                    <Users className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 block">
                    Grupo Asociado
                  </span>
                </div>

                {/* Selector directo sin textos ni banners redundantes */}
                <select
                  value={sheet.tricountGroupId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (onAssociateTricountGroup) {
                      onAssociateTricountGroup(val);
                    }
                  }}
                  className="w-full sm:w-auto bg-white border border-indigo-300 text-indigo-950 font-bold text-xs rounded-lg px-3 py-1.5 cursor-pointer shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">(Sin grupo • Solo esta cuenta)</option>
                  {tricountGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.members.length} integrantes)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Lista y Edición de Integrantes de esta cuenta */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Integrantes de la Cuenta ({members.length})
                    </h4>
                    <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                      <span>Nombre del grupo:</span>
                      <strong className="text-slate-900 font-bold">
                        {sheet.tricountGroupId && tricountGroups.find((g) => g.id === sheet.tricountGroupId)?.name
                          ? tricountGroups.find((g) => g.id === sheet.tricountGroupId)?.name
                          : '(Personalizado / Sin grupo)'}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const defaultName = sheet.tricountGroupId
                        ? (tricountGroups.find((g) => g.id === sheet.tricountGroupId)?.name || '')
                        : sheet.title || 'Mi Grupo';
                      setSaveGroupNameVal(defaultName);
                      setIsSaveGroupModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Guardar estos integrantes como un grupo reutilizable"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Guardar como Grupo</span>
                  </button>
                </div>

                {/* Form to Add New Member */}
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nombre del nuevo participante (ej: Carlos)"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </form>

                {memberError && (
                  <p className="text-[11px] text-rose-600 font-medium">{memberError}</p>
                )}

                {/* Members List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-0.5">
                  {members.map((name) => {
                    const isEditingThis = editingMember === name;
                    return (
                      <div
                        key={name}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs text-xs"
                      >
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingNameVal}
                              onChange={(e) => setEditingNameVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(name);
                                if (e.key === 'Escape') setEditingMember(null);
                              }}
                              autoFocus
                              className="flex-1 bg-white border border-indigo-400 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(name)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                              title="Guardar nombre"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMember(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 font-black text-xs flex items-center justify-center shrink-0">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-800 truncate">{name}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartRename(name)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                title="Editar nombre"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Eliminar participante"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Grupos Guardados Reutilizables */}
              {tricountGroups && tricountGroups.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Grupos Guardados en la App ({tricountGroups.length})
                  </h4>
                  <div className="space-y-1.5">
                    {tricountGroups.map((g) => {
                      const isLinked = sheet.tricountGroupId === g.id;
                      return (
                        <div
                          key={g.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                            isLinked
                              ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{g.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({g.members.length} personas)
                              </span>
                              {isLinked && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900">
                                  Activo en esta cuenta
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {g.members.join(', ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isLinked ? (
                              <button
                                type="button"
                                onClick={() => onAssociateTricountGroup && onAssociateTricountGroup(g.id)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                              >
                                Usar grupo
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>En uso</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGroupObj({ id: g.id, name: g.name });
                                setEditingGroupNameVal(g.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Renombrar este grupo"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {onDeleteTricountGroup && (
                              <button
                                type="button"
                                onClick={() => setGroupToDeleteObj({ id: g.id, name: g.name })}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Eliminar este grupo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA AGREGAR / EDITAR ABONO */}
      {isAddingContribution && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-4 space-y-3.5 animate-scale-up text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                  <Wallet className="w-4 h-4" />
                </span>
                <h4 className="font-bold text-sm text-slate-900">
                  {editingContribId ? 'Editar Abono' : 'Registrar Nuevo Abono'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingContribution(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContribution} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Participante que abona:</label>
                <select
                  value={contribMember}
                  onChange={(e) => setContribMember(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {members.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Monto y Moneda:</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="0.00"
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <select
                    value={contribCurrency}
                    onChange={(e) => setContribCurrency(e.target.value as Currency)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <label className="block text-slate-600 font-bold mb-1">Fecha y Hora:</label>
                <input
                  type="datetime-local"
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Nota o Referencia (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej: Pago móvil, Zelle, Efectivo..."
                  value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {contribError && (
                <p className="text-[11px] text-rose-600 font-medium">{contribError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingContribution(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer shadow-2xs"
                >
                  {editingContribId ? 'Guardar Cambios' : 'Registrar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ABONO PARCIAL A DEUDA TRIPCOUNT */}
      {partialModalTransfer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Registrar Abono Parcial</h4>
                <p className="text-[11px] text-slate-500">
                  De: <strong>{partialModalTransfer.from}</strong> a <strong>{partialModalTransfer.to}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPartialModalTransfer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px] space-y-0.5">
                <div>Deuda Total: <strong>{formatCurrency(partialModalTransfer.fullAmount, settleCurrency, settings.decimals)}</strong></div>
                <div>
                  Abonado previo: <strong>{formatCurrency(partialSettlements[`${partialModalTransfer.from}->${partialModalTransfer.to}`] || 0, settleCurrency, settings.decimals)}</strong>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto del Abono ({settleCurrency})</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={partialInputAmount}
                  onChange={(e) => setPartialInputAmount(e.target.value)}
                  placeholder="Ej: 50"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPartialModalTransfer(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const num = parseFloat(partialInputAmount.replace(',', '.'));
                  if (!isNaN(num) && num > 0) {
                    const key = `${partialModalTransfer.from}->${partialModalTransfer.to}`;
                    const currentPartial = partialSettlements[key] || 0;
                    const newTotalPartial = currentPartial + num;
                    const updatedPartial = { ...partialSettlements, [key]: newTotalPartial };
                    setPartialSettlements(updatedPartial);
                    if (onUpdatePartialSettlements) {
                      onUpdatePartialSettlements(updatedPartial);
                    }
                    if (newTotalPartial >= partialModalTransfer.fullAmount) {
                      handleToggleSettleTransfer(partialModalTransfer.from, partialModalTransfer.to);
                    }
                  }
                  setPartialModalTransfer(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Guardar Abono</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: GUARDAR COMO GRUPO CON NOMBRE */}
      {isSaveGroupModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 space-y-3.5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                  <FolderPlus className="w-4 h-4" />
                </span>
                <h4 className="font-extrabold text-sm text-slate-900">Guardar como Grupo</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveGroupModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = saveGroupNameVal.trim();
                if (!trimmed) return;
                if (onCreateTricountGroup) {
                  onCreateTricountGroup(trimmed, members, `Creado desde la cuenta "${sheet.title}"`);
                }
                setIsSaveGroupModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre del Grupo</label>
                <input
                  type="text"
                  required
                  value={saveGroupNameVal}
                  onChange={(e) => setSaveGroupNameVal(e.target.value)}
                  placeholder="Ej: Viaje Cancún 2026, Amigos..."
                  className="w-full bg-slate-50 border border-indigo-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                <span className="font-bold text-slate-700 block mb-0.5">Integrantes a incluir:</span>
                <p className="font-medium text-slate-800 truncate">{members.join(', ')}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaveGroupModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Guardar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RENOMBRAR GRUPO GUARDADO */}
      {editingGroupObj && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 space-y-3.5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                  <Pencil className="w-4 h-4" />
                </span>
                <h4 className="font-extrabold text-sm text-slate-900">Renombrar Grupo</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroupObj(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editingGroupNameVal.trim();
                if (!trimmed || !editingGroupObj) return;
                const targetG = tricountGroups.find((g) => g.id === editingGroupObj.id);
                if (targetG && onUpdateTricountGroup) {
                  onUpdateTricountGroup(targetG.id, trimmed, targetG.members, targetG.description);
                }
                setEditingGroupObj(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nuevo Nombre del Grupo</label>
                <input
                  type="text"
                  required
                  value={editingGroupNameVal}
                  onChange={(e) => setEditingGroupNameVal(e.target.value)}
                  placeholder="Ingresa el nombre del grupo"
                  className="w-full bg-slate-50 border border-indigo-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingGroupObj(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Guardar Nombre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINAR GRUPO */}
      {groupToDeleteObj && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-4 space-y-3.5 text-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">¿Eliminar este grupo?</h4>
                <p className="text-[11px] font-bold text-rose-700">{groupToDeleteObj.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Este grupo ya no estará disponible para vincular a tus cuentas de calculadoras.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGroupToDeleteObj(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTricountGroup && groupToDeleteObj) {
                    onDeleteTricountGroup(groupToDeleteObj.id);
                  }
                  setGroupToDeleteObj(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Sí, Eliminar Grupo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
