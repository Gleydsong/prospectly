import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { canManageOrg } from '@/features/settings/can-manage-org';
import {
  useArchiveCustomField,
  useCreateCustomField,
  useCustomFields,
  useReorderCustomFields,
  useUnarchiveCustomField,
  useUpdateCustomField,
} from '@/features/custom-fields/hooks';
import type { CustomFieldDefinition, CustomFieldType } from '@/features/custom-fields/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const TYPES: CustomFieldType[] = ['text', 'number', 'select', 'date'];

function SelectOptionsEditor({
  field,
  canManage,
  onSave,
}: {
  field: CustomFieldDefinition;
  canManage: boolean;
  onSave: (options: Array<{ id?: string; label: string; archived?: boolean }>) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [newLabel, setNewLabel] = useState('');
  const live = field.options.filter((option) => !option.archivedAt);
  const archived = field.options.filter((option) => option.archivedAt);

  const persist = (options: Array<{ id?: string; label: string; archived?: boolean }>) => onSave(options);

  return (
    <div className="w-full space-y-2 border-t border-[color:var(--border)] pt-2">
      <p className="text-xs font-medium uppercase text-[color:var(--ink-muted)]">
        {t('customFields.optionsTitle')}
      </p>
      {live.map((option) => (
        <div key={option.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-[color:var(--ink)]">{option.label}</span>
          {canManage ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = window.prompt(t('customFields.renameOptionPrompt'), option.label);
                  if (!next?.trim() || next.trim() === option.label) return;
                  void persist(
                    field.options.map((item) =>
                      item.id === option.id
                        ? { id: item.id, label: next.trim(), archived: false }
                        : { id: item.id, label: item.label, archived: Boolean(item.archivedAt) },
                    ),
                  );
                }}
              >
                {t('customFields.rename')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void persist(
                    field.options.map((item) =>
                      item.id === option.id
                        ? { id: item.id, label: item.label, archived: true }
                        : { id: item.id, label: item.label, archived: Boolean(item.archivedAt) },
                    ),
                  )
                }
              >
                {t('customFields.archiveOption')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {archived.map((option) => (
        <div key={option.id} className="flex items-center justify-between gap-2">
          <span className="text-sm text-[color:var(--ink-muted)]">
            {option.label} ({t('customFields.archivedReadOnly')})
          </span>
          {canManage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void persist(
                  field.options.map((item) =>
                    item.id === option.id
                      ? { id: item.id, label: item.label, archived: false }
                      : { id: item.id, label: item.label, archived: Boolean(item.archivedAt) },
                  ),
                )
              }
            >
              {t('customFields.unarchiveOption')}
            </Button>
          ) : null}
        </div>
      ))}
      {canManage && live.length < 30 ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id={`custom-field-option-${field.id}`}
            label={t('customFields.addOption')}
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={!newLabel.trim()}
            onClick={() => {
              const label = newLabel.trim();
              setNewLabel('');
              void persist([
                ...field.options.map((item) => ({
                  id: item.id,
                  label: item.label,
                  archived: Boolean(item.archivedAt),
                })),
                { label },
              ]);
            }}
          >
            {t('customFields.addOption')}
          </Button>
        </div>
      ) : null}
    </div>
  );
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
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionLabel, setOptionLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => (query.data ?? []).filter((field) => !field.archivedAt),
    [query.data],
  );
  const archived = useMemo(
    () => (query.data ?? []).filter((field) => field.archivedAt),
    [query.data],
  );

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(getApiErrorMessage(err) || t('customFields.error'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('tools.eyebrow')}
        title={t('customFields.title')}
        description={t('customFields.subtitle')}
      />
      <p>
        <Link to="/tools" className="text-sm font-semibold text-[color:var(--accent)] hover:underline">
          {t('customFields.backToTools')}
        </Link>
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!canManage ? <Alert tone="info">{t('customFields.readOnlyNotice')}</Alert> : null}

      {canManage ? (
        <Card>
          <CardHeader title={t('customFields.createTitle')} />
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <Input
              id="custom-field-name"
              label={t('customFields.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Select
              id="custom-field-type"
              label={t('customFields.type')}
              value={type}
              onChange={(event) => setType(event.target.value as CustomFieldType)}
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`customFields.types.${value}`)}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button
                disabled={!name.trim() || (type === 'select' && !optionLabel.trim())}
                onClick={() =>
                  void run(async () => {
                    const options =
                      type === 'select' && optionLabel.trim()
                        ? [{ label: optionLabel.trim() }]
                        : undefined;
                    await createField.mutateAsync({ name, type, options });
                    setName('');
                    setOptionLabel('');
                  })
                }
              >
                {t('customFields.create')}
              </Button>
            </div>
            {type === 'select' ? (
              <div className="sm:col-span-3">
                <Input
                  id="custom-field-first-option"
                  label={t('customFields.firstOption')}
                  value={optionLabel}
                  onChange={(event) => setOptionLabel(event.target.value)}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t('customFields.activeTitle')} />
        <CardContent className="space-y-3">
          {active.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-muted)]">{t('customFields.empty')}</p>
          ) : (
            active.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-[color:var(--border)] p-3"
              >
                <div>
                  <p className="font-semibold text-[color:var(--ink)]">{field.name}</p>
                  <p className="text-xs text-[color:var(--ink-muted)]">
                    {t(`customFields.types.${field.type}`)}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => {
                        if (index === 0) return;
                        const currentId = active[index]?.id;
                        const previousId = active[index - 1]?.id;
                        if (!currentId || !previousId) return;
                        const next = active.map((item) => item.id);
                        next[index - 1] = currentId;
                        next[index] = previousId;
                        void run(() => reorder.mutateAsync(next));
                      }}
                    >
                      {t('customFields.moveUp')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          const next = window.prompt(t('customFields.renamePrompt'), field.name);
                          if (!next?.trim() || next.trim() === field.name) return;
                          await updateField.mutateAsync({ id: field.id, name: next.trim() });
                        })
                      }
                    >
                      {t('customFields.rename')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void run(() => archiveField.mutateAsync(field.id))}
                    >
                      {t('customFields.archive')}
                    </Button>
                  </div>
                ) : null}
                {field.type === 'select' ? (
                  <SelectOptionsEditor
                    field={field}
                    canManage={canManage}
                    onSave={(options) => run(() => updateField.mutateAsync({ id: field.id, options }))}
                  />
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {archived.length ? (
        <Card>
          <CardHeader title={t('customFields.archivedTitle')} />
          <CardContent className="space-y-3">
            {archived.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between gap-2 rounded-control border border-[color:var(--border)] p-3"
              >
                <p className="text-sm text-[color:var(--ink-muted)]">{field.name}</p>
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void run(() => unarchiveField.mutateAsync(field.id))}
                  >
                    {t('customFields.unarchive')}
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
