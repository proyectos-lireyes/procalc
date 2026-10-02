import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  X,
  Check,
  ArrowRight,
  Plane,
  Receipt,
  Pencil,
  Target,
  CheckCircle2,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import {
  Sheet,
  ComputedRow,
  Currency,
  RatesState,
  AppSettings,
  TricountMode,
  TricountPrepaidConfig,
  TricountGroup,
} from '../types';
import {
  formatCurrency,
  formatNumber,
} from '../utils/currency';
import {
  calculatePrepaidTripStats,
  calculatePostpaidStats,
  getSheetPlanners,
  getActivePlanner,
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
  onUpdateRowParticipants?: (rowId: string, participants: string[]) => void;
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
}

export const TricountModal: React.FC<TricountModalProps> = ({
  isOpen,
  onClose,
  sheet,
  computedRows,
  rates,
  settings,
  onUpdateSheetMembers,
  onUpdateMembers,
  onUpdateSheetTricountMode,
  onSelectPlanner,
  tricountGroups = [],
  onAssociateTricountGroup,
  onCreateTricountGroup,
  onUpdateTricountGroup,
  onDeleteTricountGroup,
}) => {
  const updateMembersCallback = onUpdateSheetMembers || onUpdateMembers;

  // Mode view: 'switcher' (main 3 summary cards) or 'groups' (group & member manager)
  const [currentView, setCurrentView] = useState<'switcher' | 'groups'>('switcher');

  // Reset view on open
  useEffect(() => {
    if (isOpen) {
      setCurrentView('switcher');
    }
  }, [isOpen]);

  // Local members state
  const [localMembers, setLocalMembers] = useState<string[]>(() =>
    sheet.members && sheet.members.length > 0 ? sheet.members : ['Yo']
  );
  const [newMemberName, setNewMemberName] = useState('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);

  // Group creation & editing state
  const [isSaveGroupModalOpen, setIsSaveGroupModalOpen] = useState(false);
  const [saveGroupNameVal, setSaveGroupNameVal] = useState('');
  const [editingGroupObj, setEditingGroupObj] = useState<{ id: string; name: string } | null>(null);
  const [editingGroupNameVal, setEditingGroupNameVal] = useState('');
  const [groupToDeleteObj, setGroupToDeleteObj] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setLocalMembers(sheet.members && sheet.members.length > 0 ? sheet.members : ['Yo']);
  }, [sheet.id, sheet.members]);

  const members = localMembers;

  // Planner stats & calculations
  const sheetPlanners = useMemo(() => getSheetPlanners(sheet), [sheet]);
  const defaultPlanner = useMemo(() => getActivePlanner(sheet), [sheet]);
  const [selectedPlannerId, setSelectedPlannerId] = useState<string>(
    sheet.activePlannerId || defaultPlanner.id || 'planner_default'
  );

  useEffect(() => {
    if (sheet.activePlannerId) {
      setSelectedPlannerId(sheet.activePlannerId);
    } else if (defaultPlanner.id) {
      setSelectedPlannerId(defaultPlanner.id);
    }
  }, [sheet.activePlannerId, defaultPlanner.id]);

  const currentPlanner = useMemo(() => {
    return sheetPlanners.find((p) => p.id === selectedPlannerId) || defaultPlanner;
  }, [sheetPlanners, selectedPlannerId, defaultPlanner]);

  const plannerCurrency = currentPlanner.targetCurrency || settings.displayCurrency;

  const prepaidStats = useMemo(() => {
    return calculatePrepaidTripStats(members, currentPlanner, rates, plannerCurrency);
  }, [members, currentPlanner, rates, plannerCurrency]);

  // Tripcount stats & calculations
  const settleCurrency = settings.displayCurrency;
  const postpaidStats = useMemo(() => {
    return calculatePostpaidStats(members, computedRows, settleCurrency, rates);
  }, [members, computedRows, settleCurrency, rates]);

  // Actions for switching modes directly
  const handleSwitchToPlanner = (plannerId?: string) => {
    const targetId = plannerId || selectedPlannerId;
    if (targetId && onSelectPlanner && targetId !== sheet.activePlannerId) {
      onSelectPlanner(targetId);
    }
    if (onUpdateSheetTricountMode) {
      onUpdateSheetTricountMode('prepaid');
    }
    onClose();
  };

  const handleSelectPlannerInModal = (plannerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlannerId(plannerId);
    if (onSelectPlanner) {
      onSelectPlanner(plannerId);
    }
  };

  const handleSwitchToTripcount = () => {
    if (onUpdateSheetTricountMode) {
      onUpdateSheetTricountMode('postpaid');
    }
    onClose();
  };

  // Member management handlers
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

  const handleRemoveMember = (nameToRemove: string) => {
    if (members.length <= 1) {
      setMemberError('Debe haber al menos 1 participante.');
      return;
    }
    const updated = members.filter((m) => m !== nameToRemove);
    setLocalMembers(updated);
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
    if (!trimmed || trimmed.toLowerCase() === oldName.toLowerCase()) {
      setEditingMember(null);
      return;
    }
    if (members.some((m) => m.toLowerCase() === trimmed.toLowerCase() && m !== oldName)) {
      setMemberError('Ya existe un integrante con ese nombre.');
      return;
    }
    const updated = members.map((m) => (m === oldName ? trimmed : m));
    setLocalMembers(updated);
    setEditingMember(null);
    if (updateMembersCallback) {
      updateMembersCallback(updated);
    }
  };

  // Group creation / save from active members
  const handleConfirmSaveGroup = () => {
    const name = saveGroupNameVal.trim();
    if (!name || members.length === 0) return;
    if (onCreateTricountGroup) {
      onCreateTricountGroup(name, members, `Creado desde "${sheet.title}"`);
    }
    setIsSaveGroupModalOpen(false);
    setSaveGroupNameVal('');
  };

  const handleConfirmRenameGroup = () => {
    if (!editingGroupObj || !editingGroupNameVal.trim()) return;
    const targetGroup = tricountGroups.find((g) => g.id === editingGroupObj.id);
    if (targetGroup && onUpdateTricountGroup) {
      onUpdateTricountGroup(
        targetGroup.id,
        editingGroupNameVal.trim(),
        targetGroup.members,
        targetGroup.description
      );
    }
    setEditingGroupObj(null);
  };

  const handleConfirmDeleteGroup = () => {
    if (!groupToDeleteObj) return;
    if (onDeleteTricountGroup) {
      onDeleteTricountGroup(groupToDeleteObj.id);
    }
    setGroupToDeleteObj(null);
  };

  if (!isOpen) return null;

  const currentGroupName = sheet.tricountGroupId
    ? (tricountGroups.find((g) => g.id === sheet.tricountGroupId)?.name || 'Grupo vinculado')
    : 'Personalizado';

  const isPlannerActive = sheet.tricountMode === 'prepaid';
  const isTripcountActive = sheet.tricountMode === 'postpaid';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        id="tricount-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-up text-slate-800"
      >
        {/* 1. MODAL HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentView === 'groups' ? (
              <button
                type="button"
                onClick={() => setCurrentView('switcher')}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                title="Volver al selector de modos"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <span className="p-2 rounded-xl bg-slate-900 text-white shadow-2xs shrink-0">
                <Target className="w-4 h-4" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                {currentView === 'groups' ? 'Gestión de Grupos y Participantes' : 'Alternar Modo de Cuenta'}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Cuenta: <strong className="text-slate-700 font-semibold">{sheet.title}</strong>
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

        {/* 2. MODAL BODY (SWITCHER VIEW: NO SCROLL REQUIRED) */}
        {currentView === 'switcher' ? (
          <div className="p-3.5 sm:p-4.5 space-y-2.5">
            {/* CARD 1: PLANNER (PREPAGADO / COLECTA) */}
            <div
              onClick={() => handleSwitchToPlanner(selectedPlannerId)}
              className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                isPlannerActive
                  ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${isPlannerActive ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                    <Plane className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      <span>Planner • Colecta y Metas</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 block">
                      Planner: <strong className="text-blue-900 font-semibold">{currentPlanner.name || 'General'}</strong>
                    </span>
                  </div>
                </div>

                {isPlannerActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                    Activo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    Activar
                  </span>
                )}
              </div>

              {/* Ultra-compact Metrics Strip */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] bg-white/90 p-1.5 rounded-lg border border-slate-200/80">
                <div>
                  <span className="text-[8.5px] text-slate-400 block font-sans font-bold uppercase">Meta</span>
                  <strong className="text-slate-900 font-black truncate block">
                    {formatCurrency(prepaidStats.totalTargetInBase, plannerCurrency, 2)}
                  </strong>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 block font-sans font-bold uppercase">Abonado</span>
                  <strong className="text-emerald-700 font-black truncate block">
                    {prepaidStats.progressPercent.toFixed(1)}%
                  </strong>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 block font-sans font-bold uppercase">Resta</span>
                  <strong className={`${prepaidStats.isGoalReached ? 'text-emerald-600' : 'text-amber-800'} font-black truncate block`}>
                    {prepaidStats.isGoalReached ? '¡Listo! 🎉' : formatCurrency(prepaidStats.totalRemainingInBase, plannerCurrency, 2)}
                  </strong>
                </div>
              </div>

              {/* Multiple Planners Quick Switcher without closing modal */}
              {sheetPlanners.length > 1 && (
                <div
                  className="mt-2 pt-1.5 border-t border-blue-100 flex items-center gap-1 overflow-x-auto scrollbar-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[9px] font-bold text-slate-500 uppercase shrink-0">Cambiar a:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {sheetPlanners.map((p) => {
                      const isSel = p.id === currentPlanner.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={(e) => handleSelectPlannerInModal(p.id!, e)}
                          className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer border ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'
                          }`}
                        >
                          {p.name || 'General'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: TRIPCOUNT (POSTPAGO / GASTOS COMPARTIDOS) */}
            <div
              onClick={handleSwitchToTripcount}
              className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                isTripcountActive
                  ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${isTripcountActive ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                    <Receipt className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                      Tripcount • Gastos Compartidos
                    </h4>
                    <span className="text-[10px] text-slate-500 block">
                      Liquidación y división equitativa de consumos
                    </span>
                  </div>
                </div>

                {isTripcountActive ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                    Activo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    Activar
                  </span>
                )}
              </div>

              {/* Ultra-compact Metrics Strip */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] bg-white/90 p-1.5 rounded-lg border border-slate-200/80">
                <div>
                  <span className="text-[8.5px] text-slate-400 block font-sans font-bold uppercase">Gasto Total</span>
                  <strong className="text-slate-900 font-black truncate block">
                    {formatCurrency(postpaidStats.totalSharedExpense, settleCurrency, 2)}
                  </strong>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 block font-sans font-bold uppercase">Cuota p/p</span>
                  <strong className="text-emerald-800 font-black truncate block">
                    {formatCurrency(postpaidStats.fairShare, settleCurrency, 2)}
                  </strong>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 block font-sans font-bold uppercase">Liquidación</span>
                  <strong className={`${postpaidStats.transfers.length === 0 ? 'text-emerald-700' : 'text-amber-800'} font-black truncate block`}>
                    {postpaidStats.transfers.length === 0 ? '¡Al día! 🎉' : `${postpaidStats.transfers.length} transf.`}
                  </strong>
                </div>
              </div>
            </div>

            {/* CARD 3: GRUPOS Y PARTICIPANTES */}
            <div
              onClick={() => setCurrentView('groups')}
              className="p-3 sm:p-3.5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-slate-50 hover:border-indigo-400 transition-all cursor-pointer group shadow-2xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
                  <Users className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    Gestión de Grupos e Integrantes
                  </h4>
                  <p className="text-[10.5px] text-slate-500 truncate">
                    {members.length} {members.length === 1 ? 'persona' : 'personas'} • Grupo: <strong className="text-indigo-900">{currentGroupName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-indigo-700 font-bold text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
                <span>Administrar</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 3. GROUP MANAGEMENT FULL VIEW                                             */
          /* ========================================================================= */
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[78vh]">
            {/* Grupo Activo en esta cuenta */}
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block">
                    Grupo Asociado a esta Cuenta
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {currentGroupName}
                  </span>
                </div>

                <select
                  value={sheet.tricountGroupId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (onAssociateTricountGroup) {
                      onAssociateTricountGroup(val);
                    }
                  }}
                  className="bg-white border border-indigo-300 text-indigo-950 font-bold text-xs rounded-lg px-2.5 py-1 cursor-pointer shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">(Sin grupo • Solo esta cuenta)</option>
                  {tricountGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.members.length} integrantes)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Integrantes de esta cuenta */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Integrantes ({members.length})
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSaveGroupNameVal(sheet.title || 'Mi Grupo');
                    setIsSaveGroupModalOpen(true);
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Guardar estos integrantes como un grupo reutilizable"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Guardar como Grupo</span>
                </button>
              </div>

              {/* Form to Add Member */}
              <form onSubmit={handleAddMember} className="flex gap-1.5">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Nombre del nuevo participante..."
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                {members.map((name) => {
                  const isEditingThis = editingMember === name;
                  return (
                    <div
                      key={name}
                      className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs text-xs"
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
                            className="flex-1 bg-white border border-indigo-400 rounded px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(name)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMember(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 font-black text-[10px] flex items-center justify-center shrink-0">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800 truncate">{name}</span>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleStartRename(name)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Editar nombre"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
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
            </div>

            {/* Grupos Guardados Reutilizables */}
            {tricountGroups.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Grupos Guardados ({tricountGroups.length})
                </span>
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
                                Activo
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                            {g.members.join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isLinked ? (
                            <button
                              type="button"
                              onClick={() => onAssociateTricountGroup && onAssociateTricountGroup(g.id)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] cursor-pointer shadow-2xs"
                            >
                              Usar
                            </button>
                          ) : (
                            <span className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-1">
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
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="Renombrar grupo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupToDeleteObj({ id: g.id, name: g.name })}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="Eliminar grupo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SAVE GROUP MODAL */}
        {isSaveGroupModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 w-full max-w-sm space-y-4">
              <h4 className="font-bold text-base text-slate-900">Guardar como Nuevo Grupo</h4>
              <p className="text-xs text-slate-500">
                Se guardarán los {members.length} integrantes actuales para usarlos en cualquier otra cuenta.
              </p>
              <input
                type="text"
                value={saveGroupNameVal}
                onChange={(e) => setSaveGroupNameVal(e.target.value)}
                placeholder="Nombre del grupo..."
                autoFocus
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSaveGroupModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveGroup}
                  disabled={!saveGroupNameVal.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg cursor-pointer shadow-xs"
                >
                  Guardar Grupo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RENAME GROUP MODAL */}
        {editingGroupObj && (
          <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 w-full max-w-sm space-y-4">
              <h4 className="font-bold text-base text-slate-900">Renombrar Grupo</h4>
              <input
                type="text"
                value={editingGroupNameVal}
                onChange={(e) => setEditingGroupNameVal(e.target.value)}
                placeholder="Nuevo nombre..."
                autoFocus
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingGroupObj(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRenameGroup}
                  disabled={!editingGroupNameVal.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg cursor-pointer shadow-xs"
                >
                  Guardar Nombre
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE GROUP MODAL */}
        {groupToDeleteObj && (
          <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 w-full max-w-sm space-y-4">
              <h4 className="font-bold text-base text-slate-900">¿Eliminar Grupo?</h4>
              <p className="text-xs text-slate-600">
                ¿Estás seguro de eliminar el grupo <strong className="text-slate-900 font-bold">"{groupToDeleteObj.name}"</strong>?
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setGroupToDeleteObj(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteGroup}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer shadow-xs"
                >
                  Eliminar Grupo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
