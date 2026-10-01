import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Link as LinkIcon,
  Sparkles,
  Info,
} from 'lucide-react';
import { TricountGroup, Sheet } from '../types';

interface TricountGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: TricountGroup[];
  currentSheet?: Sheet;
  onCreateGroup: (name: string, members: string[], description?: string) => void;
  onUpdateGroup: (id: string, name: string, members: string[], description?: string) => void;
  onDeleteGroup: (id: string) => void;
  onAssociateGroupToCurrentSheet?: (groupId: string) => void;
}

export const TricountGroupsModal: React.FC<TricountGroupsModalProps> = ({
  isOpen,
  onClose,
  groups,
  currentSheet,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAssociateGroupToCurrentSheet,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // Form states
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [membersList, setMembersList] = useState<string[]>(['Yo']);
  const [newMemberInput, setNewMemberInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingGroupId(null);
    setGroupName('');
    setGroupDesc('');
    // Seed with current sheet members if available
    setMembersList(
      currentSheet?.members && currentSheet.members.length > 0
        ? currentSheet.members
        : ['Yo']
    );
    setNewMemberInput('');
    setFormError(null);
  };

  const handleStartEdit = (g: TricountGroup) => {
    setIsCreating(false);
    setEditingGroupId(g.id);
    setGroupName(g.name);
    setGroupDesc(g.description || '');
    setMembersList([...g.members]);
    setNewMemberInput('');
    setFormError(null);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingGroupId(null);
    setFormError(null);
  };

  const handleAddMemberToForm = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMemberInput.trim();
    if (!name) return;
    if (membersList.some((m) => m.toLowerCase() === name.toLowerCase())) {
      setFormError('Este integrante ya está en el grupo.');
      return;
    }
    setMembersList([...membersList, name]);
    setNewMemberInput('');
    setFormError(null);
  };

  const handleRemoveMemberFromForm = (name: string) => {
    if (membersList.length <= 1) {
      setFormError('El grupo debe tener al menos un integrante.');
      return;
    }
    setMembersList(membersList.filter((m) => m !== name));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setFormError('Ingresa un nombre para el grupo.');
      return;
    }
    if (membersList.length === 0) {
      setFormError('Agrega al menos un integrante al grupo.');
      return;
    }

    if (isCreating) {
      onCreateGroup(trimmedName, membersList, groupDesc.trim() || undefined);
    } else if (editingGroupId) {
      onUpdateGroup(editingGroupId, trimmedName, membersList, groupDesc.trim() || undefined);
    }

    handleCancelForm();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-2xs">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Grupos de Tricount Generales
              </h3>
              <p className="text-[11px] text-slate-500">
                Crea grupos de personas reutilizables para asociar a cualquier cuenta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Create or Edit Form */}
          {isCreating || editingGroupId ? (
            <form onSubmit={handleSaveForm} className="bg-slate-50 p-3.5 rounded-xl border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  {isCreating ? 'Crear Nuevo Grupo General' : 'Editar Grupo General'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {formError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nombre del grupo..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Descripción breve..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              {/* Members in group */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Integrantes del Grupo ({membersList.length})
                </label>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {membersList.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                    >
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberFromForm(m)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Quitar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add member input */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newMemberInput}
                    onChange={(e) => setNewMemberInput(e.target.value)}
                    placeholder="Nombre del integrante..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMemberToForm(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddMemberToForm}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  {isCreating ? 'Crear Grupo' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tus Grupos ({groups.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Grupo</span>
              </button>
            </div>
          )}

          {/* Groups List */}
          {groups.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs text-slate-600 font-medium">
                No tienes grupos creados aún.
              </p>
              <p className="text-[11px] text-slate-400">
                Crea un grupo para asociarlo rápidamente a cualquier cuenta o viaje.
              </p>
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs inline-block mt-1"
              >
                + Crear Primer Grupo
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map((g) => {
                const isLinkedToCurrent = currentSheet?.tricountGroupId === g.id;

                return (
                  <div
                    key={g.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isLinkedToCurrent
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900">
                            {g.name}
                          </h4>
                          {isLinkedToCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-2xs">
                              <Check className="w-2.5 h-2.5" />
                              Asociado a esta cuenta
                            </span>
                          )}
                        </div>
                        {g.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {g.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(g)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar grupo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {deletingGroupId === g.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 animate-fade-in">
                            <span className="text-[10px] font-bold text-rose-700">¿Eliminar?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteGroup(g.id);
                                setDeletingGroupId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingGroupId(null)}
                              className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingGroupId(g.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar grupo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Members pills */}
                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-400 font-bold mr-1">
                        {g.members.length} integrantes:
                      </span>
                      {g.members.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
                        >
                          {m}
                        </span>
                      ))}
                    </div>

                    {/* Action to associate with current account */}
                    {currentSheet && onAssociateGroupToCurrentSheet && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {isLinkedToCurrent
                            ? 'Los integrantes de la cuenta están sincronizados con este grupo.'
                            : 'Aplica estos integrantes a la cuenta actual.'}
                        </span>

                        <button
                          type="button"
                          onClick={() => onAssociateGroupToCurrentSheet(g.id)}
                          disabled={isLinkedToCurrent}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isLinkedToCurrent
                              ? 'bg-slate-100 text-slate-400 cursor-default'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white shadow-2xs'
                          }`}
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span>{isLinkedToCurrent ? 'Vinculado' : 'Asociar a esta cuenta'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Info Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[11px] text-slate-600">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">
                ¿Cómo funcionan los Grupos de Tricount?
              </p>
              <p className="text-slate-500 mt-0.5">
                Crea un grupo con tus amigos o familia una sola vez. Luego, al crear cualquier cuenta o viaje, puedes asociar el grupo en un solo clic y compartir gastos sin tener que volver a escribir los nombres.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer shadow-2xs"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
