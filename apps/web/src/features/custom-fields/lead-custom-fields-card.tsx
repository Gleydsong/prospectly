import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCustomFields } from '@/features/custom-fields/hooks';
import { useUpdateLead } from '@/features/leads/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

export function LeadCustomFieldsCard({
  leadId,
  values,
}: {
  leadId: string;
  values?: Record<string, string | number | null>;
}) {
  const { t } = useTranslation();
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role !== Role.VIEWER && Boolean(role);
  const fieldsQuery = useCustomFields();
  const updateLead = useUpdateLead(leadId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const fields = fieldsQuery.data;
  const active = useMemo(() => (fields ?? []).filter((field) => !field.archivedAt), [fields]);
  const archivedWithValue = useMemo(
    () =>
      (fields ?? []).filter(
        (field) => field.archivedAt && values?.[field.id] !== undefined && values[field.id] !== null,
      ),
    [fields, values],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of active) {
      const current = values?.[field.id];
      next[field.id] = current === undefined || current === null ? '' : String(current);
    }
    setDraft(next);
  }, [active, values]);

  if (!fields?.length) return null;

  return (
    <Card>
      <CardHeader title={t('customFields.leadTitle')} />
      <CardContent className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {active.map((field) => {
          const liveOptions = field.options.filter((option) => !option.archivedAt);
          const current = draft[field.id] ?? '';
          const currentOption = field.options.find((option) => option.id === current);
          if (!canEdit) {
            return (
              <p key={field.id} className="text-sm text-[color:var(--ink)]">
                <span className="text-[color:var(--ink-muted)]">{field.name}: </span>
                {currentOption?.label || current || '—'}
              </p>
            );
          }
          if (field.type === 'select') {
            const stale =
              current && !liveOptions.some((option) => option.id === current) ? currentOption : null;
            return (
              <Select
                key={field.id}
                id={`custom-field-${field.id}`}
                label={field.name}
                value={current}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [field.id]: event.target.value }))
                }
              >
                <option value="">{t('customFields.emptyValue')}</option>
                {liveOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
                {stale ? (
                  <option value={stale.id} disabled>
                    {stale.label}
                  </option>
                ) : null}
              </Select>
            );
          }
          return (
            <Input
              key={field.id}
              id={`custom-field-${field.id}`}
              label={field.name}
              type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
              step={field.type === 'number' ? '0.0001' : undefined}
              value={current}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, [field.id]: event.target.value }))
              }
            />
          );
        })}
        {archivedWithValue.map((field) => (
          <p key={field.id} className="text-sm text-[color:var(--ink-muted)]">
            {field.name}: {String(values?.[field.id] ?? '—')} ({t('customFields.archivedReadOnly')})
          </p>
        ))}
        {canEdit && active.length ? (
          <Button
            onClick={async () => {
              setError(null);
              const patch: Record<string, string | number | null> = {};
              for (const field of active) {
                const raw = (draft[field.id] ?? '').trim();
                if (!raw) {
                  patch[field.id] = null;
                  continue;
                }
                patch[field.id] = field.type === 'number' ? Number(raw.replace(',', '.')) : raw;
              }
              try {
                await updateLead.mutateAsync({ customFieldValues: patch });
              } catch (err) {
                setError(getApiErrorMessage(err) || t('customFields.error'));
              }
            }}
          >
            {t('customFields.saveValues')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
