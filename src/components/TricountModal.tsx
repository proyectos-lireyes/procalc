import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  X,
  Copy,
  Check,
  ArrowRight,
  DollarSign,
  Share2,
  Receipt,
  Layers,
  Pencil,
} from 'lucide-react';
import {
  Sheet,
  SheetRow,
  ComputedRow,
  Currency,
  RatesState,
  AppSettings,
} from '../types';
import {
  ALL_CURRENCIES,
  CURRENCY_CONFIG,
  formatCurrency,
  formatNumber,
  convertCurrency,
  convertToVES,
} from '../utils/currency';

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
}) => {
  const updateMembersCallback = onUpdateSheetMembers || onUpdateMembers;

  // Local state for participants to guarantee immediate UI reaction
  const [localMembers, setLocalMembers] = useState<string[]>(() => sheet.members || []);
  const [newMemberName, setNewMemberName] = useState('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [settleCurrency, setSettleCurrency] = useState<Currency>(settings.displayCurrency);
  const [copied, setCopied] = useState(false);

  // Keep local members in sync with sheet changes
  useEffect(() => {
    setLocalMembers(sheet.members || []);
  }, [sheet.id, sheet.members]);

  // Use localMembers
  const members = localMembers;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    const name = newMemberName.trim();
    if (!name) return;

    if (members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      setMemberError('Esta persona ya está en la lista de participantes.');
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

    // Update row payers that had the old name
    if (onUpdateRowPayer) {
      computedRows.forEach((r) => {
        if (r.payer === oldName) {
          onUpdateRowPayer(r.id, trimmed);
        }
      });
    }
  };

  const handleRemoveMember = (name: string) => {
    const updated = members.filter((m) => m !== name);
    setLocalMembers(updated);
    if (updateMembersCallback) {
      updateMembersCallback(updated);
    }
  };

  // Calculate expenses paid per person (in settleCurrency)
  const stats = useMemo(() => {
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

    // Balances: paid - fairShare
    const balances: Record<string, number> = {};
    members.forEach((m) => {
      balances[m] = (paidByPerson[m] || 0) - fairShare;
    });

    // Debtors & Creditors
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
        // Calculate settlement in ALL 4 currencies!
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

  const handleCopyTricountReport = () => {
    let text = `👥 *TRICOUNT / GASTOS COMPARTIDOS*\n`;
    text += `📂 *Cuenta:* ${sheet.title}\n`;
    text += `💰 *Gasto Total:* ${formatCurrency(stats.totalSharedExpense, settleCurrency, settings.decimals)}\n`;
    text += `🤝 *Cuota por persona:* ${formatCurrency(stats.fairShare, settleCurrency, settings.decimals)}\n`;
    text += `───────────────────────────\n`;
    text += `📊 *PAGOS REALIZADOS:*\n`;
    members.forEach((m) => {
      const paid = stats.paidByPerson[m] || 0;
      const bal = stats.balances[m] || 0;
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
    if (stats.transfers.length === 0) {
      text += `✅ ¡Todos están al día! Nadie se debe nada.\n`;
    } else {
      stats.transfers.forEach((t) => {
        text += `\n👉 *${t.from}* le paga a *${t.to}*:\n`;
        text += `   • ${formatCurrency(t.amountsInAllCurrencies.USD, 'USD', settings.decimals)} (Dólares)\n`;
        text += `   • ${formatCurrency(t.amountsInAllCurrencies.VES, 'VES', settings.decimals)} (Bolívares)\n`;
        text += `   • ${formatCurrency(t.amountsInAllCurrencies.USDT, 'USDT', settings.decimals)} (USDT)\n`;
        text += `   • ${formatCurrency(t.amountsInAllCurrencies.EUR, 'EUR', settings.decimals)} (Euros)\n`;
      });
    }
    text += `───────────────────────────\n`;
    text += `_Calculado con MultiPayCalc_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        id="tricount-modal"
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col text-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  Tricount • Gastos Compartidos
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-100 text-emerald-800 font-bold">
                  {members.length} participantes
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cada cuenta tiene su propio Tricount con liquidación automática en las 4 monedas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-bar: Cuenta actual selector & Base Currency */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          {/* Cuenta selector */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="font-semibold text-slate-500 shrink-0">Cuenta activa:</span>
            {sheets && sheets.length > 1 && onSelectSheet ? (
              <select
                value={sheet.id}
                onChange={(e) => onSelectSheet(e.target.value)}
                className="bg-white border border-slate-300 font-bold text-slate-800 rounded px-2 py-1 text-xs cursor-pointer focus:outline-none flex-1 sm:flex-initial"
              >
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.members?.length || 0} personas)
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                {sheet.title}
              </span>
            )}
          </div>

          {/* Settle Currency switcher */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <span className="text-slate-500">Moneda base de visualización:</span>
            <select
              value={settleCurrency}
              onChange={(e) => setSettleCurrency(e.target.value as Currency)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none"
            >
              {ALL_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_CONFIG[c].name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-800">
          
          {/* 1. Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Total Compartido</span>
              <span className="text-base font-bold font-mono text-slate-900">
                {formatCurrency(stats.totalSharedExpense, settleCurrency, settings.decimals)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Cuota por persona</span>
              <span className="text-base font-bold font-mono text-blue-700">
                {formatCurrency(stats.fairShare, settleCurrency, settings.decimals)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-500 font-medium block">Deudas pendientes</span>
              <span className="text-base font-bold font-mono text-emerald-700">
                {stats.transfers.length} {stats.transfers.length === 1 ? 'pago' : 'pagos'}
              </span>
            </div>
          </div>

          {/* 2. Members Management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Participantes de esta cuenta ({members.length})
              </h4>
            </div>

            {/* Input to add member */}
            <form onSubmit={handleAddMember} className="flex gap-2 mb-2">
              <input
                id="tricount-member-input"
                type="text"
                value={newMemberName}
                onChange={(e) => {
                  setNewMemberName(e.target.value);
                  if (memberError) setMemberError(null);
                }}
                placeholder="Escribe el nombre de la persona (ej. Juan, María, Pedro...)"
                className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                id="tricount-add-member-btn"
                type="submit"
                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </form>

            {memberError && (
              <p className="text-[11px] text-rose-600 font-medium mb-2.5">{memberError}</p>
            )}

            {members.length === 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs text-center">
                👉 Ingresa al menos 2 personas arriba para calcular la repartición y quién le debe a quién.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-0.5">
                {members.map((name) => {
                  const paid = stats.paidByPerson[name] || 0;
                  const bal = stats.balances[name] || 0;
                  const isPositive = bal > 0.009;
                  const isNegative = bal < -0.009;
                  const isEditingThis = editingMember === name;

                  return (
                    <div
                      key={name}
                      className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs text-xs"
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
                            className="flex-1 bg-white border border-blue-400 rounded px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(name)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Guardar nombre"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMember(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 truncate">{name}</span>
                              <span className="text-[10px] text-slate-400">
                                (pagó {formatCurrency(paid, settleCurrency, settings.decimals)})
                              </span>
                            </div>
                            <div className="text-[11px] mt-0.5 font-mono">
                              {isPositive && (
                                <span className="text-emerald-600 font-bold">
                                  Recibe +{formatCurrency(bal, settleCurrency, settings.decimals)}
                                </span>
                              )}
                              {isNegative && (
                                <span className="text-rose-600 font-bold">
                                  Debe {formatCurrency(Math.abs(bal), settleCurrency, settings.decimals)}
                                </span>
                              )}
                              {!isPositive && !isNegative && (
                                <span className="text-slate-400">Al día</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleStartRename(name)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Editar nombre"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(name)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
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
            )}
          </div>

          {/* 3. Assign who paid each row */}
          {members.length > 0 && computedRows.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                2. Asignar quién pagó cada fila
              </h4>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
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
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded px-1.5 py-0.5 text-xs font-bold text-emerald-800 cursor-pointer focus:outline-none"
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

          {/* 4. Debt Simplification & LIQUIDATION IN ALL 4 CURRENCIES */}
          {members.length >= 2 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    3. Liquidación • ¿Quién le debe a quién?
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Calculada automáticamente en las 4 monedas para transferir o pagar en efectivo
                  </p>
                </div>
                <button
                  onClick={handleCopyTricountReport}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiar para WhatsApp</span>
                    </>
                  )}
                </button>
              </div>

              {stats.transfers.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-emerald-800 text-xs font-medium">
                  🎉 ¡Cuentas saldadas! Nadie se debe nada.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stats.transfers.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      {/* Person to Person header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            {t.from}
                          </span>
                          <span className="text-slate-400 text-xs flex items-center gap-1 font-normal">
                            le debe pagar a
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t.to}
                          </span>
                        </div>
                      </div>

                      {/* LIQUIDATION IN THE 4 CURRENCIES */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Dólares ($) */}
                        <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 flex flex-col">
                          <span className="text-[10px] font-sans font-semibold text-blue-700">
                            En Dólares ($):
                          </span>
                          <span className="font-mono font-extrabold text-xs sm:text-sm text-blue-950 mt-0.5">
                            {formatCurrency(t.amountsInAllCurrencies.USD, 'USD', settings.decimals)}
                          </span>
                        </div>

                        {/* Bolívares (Bs) */}
                        <div className="p-2 rounded-lg bg-slate-100/90 border border-slate-200 flex flex-col">
                          <span className="text-[10px] font-sans font-semibold text-slate-700">
                            En Bolívares (Bs):
                          </span>
                          <span className="font-mono font-extrabold text-xs sm:text-sm text-slate-950 mt-0.5">
                            {formatCurrency(t.amountsInAllCurrencies.VES, 'VES', settings.decimals)}
                          </span>
                        </div>

                        {/* USDT */}
                        <div className="p-2 rounded-lg bg-orange-50/70 border border-orange-100 flex flex-col">
                          <span className="text-[10px] font-sans font-semibold text-orange-700">
                            En USDT:
                          </span>
                          <span className="font-mono font-extrabold text-xs sm:text-sm text-orange-950 mt-0.5">
                            {formatCurrency(t.amountsInAllCurrencies.USDT, 'USDT', settings.decimals)}
                          </span>
                        </div>

                        {/* EUR */}
                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 flex flex-col">
                          <span className="text-[10px] font-sans font-semibold text-emerald-700">
                            En Euros (EUR):
                          </span>
                          <span className="font-mono font-extrabold text-xs sm:text-sm text-emerald-950 mt-0.5">
                            {formatCurrency(t.amountsInAllCurrencies.EUR, 'EUR', settings.decimals)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Los montos se convierten a las 4 divisas con las tasas vigentes.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
