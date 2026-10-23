import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, MoreHorizontal, Plus, X } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MonoLabel } from '@/components/ui/mono-label';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { canManageOrg } from '@/features/settings/can-manage-org';
import {
  useArchiveCustomField,
  useCreateCustomField,
  useCustomFields,
  useReorderCustomFields,
  useUnarchiveCustomField,
  useUpdateCustomField,
} from '@/features/custom-fields/hooks';
import type { CustomFieldType } from '@/features/custom-fields/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const TYPES: Array<{ value: CustomFieldType; label: string }> = [
  { value: 'text', label: 'Texto curto' },
  { value: 'number', label: 'Moeda / Número' },
  { value: 'select', label: 'Opções' },
  { value: 'date', label: 'Data' },
];

function formatFieldType(type: CustomFieldType, optionsCount?: number): string {
  switch (type) {
    case 'number':
      return 'Moeda';
    case 'select':
      return optionsCount ? `Opções · ${optionsCount}` : 'Opções';
    case 'date':
      return 'Data';
    case 'text':
    default:
      return 'Texto curto';
  }
}

export function CustomFieldsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canManage = canManageOrg(user?.role);
  const query = useCustomFields();
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const archiveField = useArchiveCustomField();
  const unarchiveField = useUnarchiveCustomField();
  const reorder = useReorderCustomFields();

  // Form states for creating a new field
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Active & archived lists
  const active = useMemo(
    () => (query.data ?? []).filter((field) => !field.archivedAt),
    [query.data],
  );
  const archived = useMemo(
    () => (query.data ?? []).filter((field) => field.archivedAt),
    [query.data],
  );

  // Local switch toggles for mock/presentation in active list
  const [inListFlags, setInListFlags] = useState<Record<string, boolean>>({});
  const [inFilterFlags, setInFilterFlags] = useState<Record<string, boolean>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleInList = (id: string) => {
    setInListFlags((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const toggleInFilter = (id: string) => {
    setInFilterFlags((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(getApiErrorMessage(err) || t('customFields.error'));
    }
  };

  const handleAddOptionToNew = () => {
    const trimmed = newOptionInput.trim();
    if (!trimmed) return;
    setOptionsList((prev) => [...prev, trimmed]);
    setNewOptionInput('');
  };

  const handleRemoveOptionFromNew = (index: number) => {
    setOptionsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    await run(async () => {
      const options =
        type === 'select'
          ? optionsList.map((label) => ({ label }))
          : undefined;
      await createField.mutateAsync({ name: name.trim(), type, options });
      setName('');
      setType('text');
      setOptionsList([]);
      setNewOptionInput('');
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="CONFIGURAÇÕES / CAMPOS"
        title="Campos personalizados"
        description="Os valores vivem no cliente; a Vista pode mostrar colunas e filtros."
        actions={
          canManage ? (
            <Button
              type="button"
              className="rounded-full px-5 py-2.5 shadow-soft"
              onClick={() => {
                const input = document.getElementById('custom-field-name');
                input?.focus();
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Novo campo
            </Button>
          ) : null
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {!canManage ? <Alert tone="info">{t('customFields.readOnlyNotice')}</Alert> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left Column: Campos ativos & Arquivados */}
        <div className="space-y-6">
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card">
            <div className="flex items-center justify-between pb-4">
              <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
                Campos ativos
              </h2>
              <span className="font-mono text-sm font-semibold text-[color:var(--ink-secondary)]">
                {active.length}
              </span>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_90px_90px_40px] gap-2 pb-3 pt-2 border-b border-[color:var(--border-default)]">
              <MonoLabel>NOME</MonoLabel>
              <MonoLabel>TIPO</MonoLabel>
              <MonoLabel>NA LISTA</MonoLabel>
              <MonoLabel>FILTRO</MonoLabel>
              <span />
            </div>

            {/* Field Rows */}
            {active.length === 0 ? (
              <p className="py-8 text-center text-sm text-[color:var(--ink-secondary)]">
                {t('customFields.empty', { defaultValue: 'Nenhum campo personalizado cadastrado.' })}
              </p>
            ) : (
              <div className="divide-y divide-[color:var(--border-default)]">
                {active.map((field, index) => {
                  const isInList = inListFlags[field.id] ?? true;
                  const isInFilter = inFilterFlags[field.id] ?? true;
                  const isMenuOpen = activeMenuId === field.id;

                  return (
                    <div
                      key={field.id}
                      className="py-4 first:pt-3 flex flex-col sm:grid sm:grid-cols-[1fr_120px_90px_90px_40px] items-start sm:items-center gap-3 sm:gap-2"
                    >
                      {/* Name & Drag Handle */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {canManage ? (
                          <GripVertical
                            className="h-4 w-4 shrink-0 text-[color:var(--ink-secondary)]/50 cursor-grab"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[color:var(--ink)] truncate">
                            {field.name}
                          </p>
                          <span className="sm:hidden text-xs text-[color:var(--ink-secondary)]">
                            {formatFieldType(field.type, field.options?.length)}
                          </span>
                        </div>
                      </div>

                      {/* Type (desktop) */}
                      <div className="hidden sm:block text-sm text-[color:var(--ink-secondary)] truncate">
                        {formatFieldType(field.type, field.options?.length)}
                      </div>

                      {/* NA LISTA Switch */}
                      <div className="flex items-center gap-2">
                        <span className="sm:hidden text-xs text-[color:var(--ink-secondary)]">Na lista:</span>
                        <Switch
                          checked={isInList}
                          onCheckedChange={() => toggleInList(field.id)}
                          label=""
                          aria-label={`Mostrar ${field.name} na lista`}
                        />
                      </div>

                      {/* FILTRO Switch */}
                      <div className="flex items-center gap-2">
                        <span className="sm:hidden text-xs text-[color:var(--ink-secondary)]">Filtro:</span>
                        <Switch
                          checked={isInFilter}
                          onCheckedChange={() => toggleInFilter(field.id)}
                          label=""
                          aria-label={`Usar ${field.name} como filtro`}
                        />
                      </div>

                      {/* Actions Menu */}
                      {canManage ? (
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`Ações para ${field.name}`}
                            onClick={() => setActiveMenuId(isMenuOpen ? null : field.id)}
                            className="rounded-lg p-1.5 text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {isMenuOpen ? (
                            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-1.5 shadow-popover">
                              {index > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    const next = active.map((item) => item.id);
                                    const curr = next[index]!;
                                    next[index] = next[index - 1]!;
                                    next[index - 1] = curr;
                                    void run(() => reorder.mutateAsync(next));
                                  }}
                                  className="w-full text-left rounded-lg px-3 py-1.5 text-xs text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]"
                                >
                                  {t('customFields.moveUp', { defaultValue: 'Mover para cima' })}
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  const nextName = window.prompt(t('customFields.renamePrompt'), field.name);
                                  if (!nextName?.trim() || nextName.trim() === field.name) return;
                                  void run(() => updateField.mutateAsync({ id: field.id, name: nextName.trim() }));
                                }}
                                className="w-full text-left rounded-lg px-3 py-1.5 text-xs text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]"
                              >
                                {t('customFields.rename', { defaultValue: 'Renomear' })}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  void run(() => archiveField.mutateAsync(field.id));
                                }}
                                className="w-full text-left rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/10"
                              >
                                {t('customFields.archive', { defaultValue: 'Arquivar' })}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div />
                      )}

                      {/* Manage select options if type is select */}
                      {field.type === 'select' && (
                        <div className="col-span-full w-full pt-2">
                          <div className="rounded-xl bg-[color:var(--bg-subtle)] p-3 text-xs space-y-2">
                            <span className="font-semibold text-[color:var(--ink)]">Opções existentes:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {field.options?.map((opt) => (
                                <span
                                  key={opt.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-surface)] border border-[color:var(--border-default)] px-2.5 py-1 text-xs text-[color:var(--ink)]"
                                >
                                  {opt.label}
                                  {canManage && (
                                    <button
                                      type="button"
                                      aria-label={`Remover opção ${opt.label}`}
                                      onClick={() => {
                                        const nextOptions = field.options
                                          .filter((o) => o.id !== opt.id)
                                          .map((o) => ({ id: o.id, label: o.label }));
                                        void run(() => updateField.mutateAsync({ id: field.id, options: nextOptions }));
                                      }}
                                      className="text-[color:var(--ink-secondary)] hover:text-red-500"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                            {canManage && (
                              <div className="flex items-center gap-2 pt-1">
                                <Input
                                  id={`add-opt-${field.id}`}
                                  label={t('customFields.addOption', { defaultValue: 'Adicionar opção' })}
                                  value={newOptionInput}
                                  onChange={(e) => setNewOptionInput(e.target.value)}
                                  className="h-8 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs shrink-0"
                                  disabled={!newOptionInput.trim()}
                                  onClick={() => {
                                    const label = newOptionInput.trim();
                                    setNewOptionInput('');
                                    const next = [
                                      ...(field.options || []).map((o) => ({ id: o.id, label: o.label, archived: false })),
                                      { label },
                                    ];
                                    void run(() => updateField.mutateAsync({ id: field.id, options: next }));
                                  }}
                                >
                                  {t('customFields.addOption', { defaultValue: 'Adicionar opção' })}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ARQUIVADOS Section */}
            {archived.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[color:var(--border-default)] space-y-3">
                <MonoLabel>ARQUIVADOS</MonoLabel>
                <div className="space-y-2">
                  {archived.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-2xl bg-[color:var(--bg-subtle)] px-4 py-3 text-sm text-[color:var(--ink-secondary)]"
                    >
                      <span>
                        {field.name} · {formatFieldType(field.type)}
                      </span>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => void run(() => unarchiveField.mutateAsync(field.id))}
                          className="font-medium text-[color:var(--brand-blue)] hover:underline"
                        >
                          Restaurar
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Novo campo Form */}
        {canManage ? (
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-5">
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              Novo campo
            </h2>

            <div className="space-y-4">
              <Input
                id="custom-field-name"
                name="custom-field-name"
                label={t('customFields.name', { defaultValue: 'Nome' })}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Plataforma atual"
              />

              <Select
                id="custom-field-type"
                name="custom-field-type"
                label={t('customFields.type', { defaultValue: 'Tipo' })}
                value={type}
                onChange={(event) => setType(event.target.value as CustomFieldType)}
              >
                {TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>

              {/* Dynamic options editor when Type is Opções */}
              {type === 'select' && (
                <div className="space-y-2.5 pt-1">
                  <MonoLabel>OPÇÕES</MonoLabel>
                  <div className="space-y-2">
                    {optionsList.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-3.5 py-2 text-sm text-[color:var(--ink)]"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          aria-label={`Remover ${opt}`}
                          onClick={() => handleRemoveOptionFromNew(idx)}
                          className="text-[color:var(--ink-secondary)] hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nova opção"
                        value={newOptionInput}
                        onChange={(e) => setNewOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOptionToNew();
                          }
                        }}
                        className="flex-1 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!newOptionInput.trim()}
                        onClick={handleAddOptionToNew}
                      >
                        + Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="button"
                className="w-full rounded-full py-3 shadow-soft"
                disabled={!name.trim() || createField.isPending}
                loading={createField.isPending}
                onClick={handleCreate}
              >
                Criar campo
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
