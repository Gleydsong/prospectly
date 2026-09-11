import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CustomFieldDefinition } from '@/features/custom-fields/api';
import { opsForType } from '@/features/custom-fields/lead-list-custom-fields';
import {
  DEFAULT_LAST_CONTACT_DAYS,
  type CustomFieldFilterOp,
  type CustomFieldListFilter,
} from '@/features/saved-views/lead-filter';

export function CustomFieldFilterValue({
  fields,
  filter,
  onChange,
}: {
  fields: CustomFieldDefinition[];
  filter: CustomFieldListFilter;
  onChange: (next: CustomFieldListFilter) => void;
}) {
  const { t } = useTranslation();
  const field = fields.find((item) => item.id === filter.fieldId);
  const ops = field ? opsForType(field.type) : (['eq'] as [CustomFieldFilterOp]);
  const op: CustomFieldFilterOp = ops.includes(filter.op) ? filter.op : ops[0];
  const relative = op === 'older_than' || op === 'within';

  return (
    <>
      {ops.length > 1 ? (
        <div className="w-full sm:w-44">
          <Select
            value={op}
            onChange={(event) => {
              const nextOp = event.target.value as CustomFieldFilterOp;
              onChange({
                fieldId: filter.fieldId,
                op: nextOp,
                value: nextOp === 'older_than' || nextOp === 'within' ? undefined : '',
                days: DEFAULT_LAST_CONTACT_DAYS,
              });
            }}
            aria-label={t('leads.customFieldFilter')}
          >
            {ops.map((item) => (
              <option key={item} value={item}>
                {t(
                  item === 'eq'
                    ? 'leads.customFieldOpEq'
                    : item === 'gte'
                      ? 'leads.customFieldOpGte'
                      : item === 'lte'
                        ? 'leads.customFieldOpLte'
                        : item === 'older_than'
                          ? 'leads.customFieldOpOlder'
                          : 'leads.customFieldOpWithin',
                )}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {relative ? (
        <div className="w-full sm:w-28">
          <Input
            type="number"
            min={1}
            max={365}
            value={filter.days ?? DEFAULT_LAST_CONTACT_DAYS}
            onChange={(event) => {
              const next = Number(event.target.value);
              onChange({
                ...filter,
                op,
                days: Number.isInteger(next)
                  ? Math.min(365, Math.max(1, next))
                  : DEFAULT_LAST_CONTACT_DAYS,
              });
            }}
            aria-label={t('leads.lastContactDays')}
          />
        </div>
      ) : field?.type === 'select' ? (
        <div className="w-full sm:w-48">
          <Select
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(event) => onChange({ ...filter, op, value: event.target.value })}
            aria-label={field.name}
          >
            <option value="">—</option>
            {field.options
              .filter((option) => !option.archivedAt || option.id === filter.value)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </Select>
        </div>
      ) : (
        <div className="w-full sm:w-48">
          <Input
            type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'}
            value={filter.value === undefined ? '' : String(filter.value)}
            onChange={(event) => {
              const raw = event.target.value;
              if (field?.type === 'number') {
                const parsed = Number(raw);
                onChange({
                  ...filter,
                  op,
                  value: raw === '' || !Number.isFinite(parsed) ? '' : parsed,
                });
              } else {
                onChange({ ...filter, op, value: raw });
              }
            }}
            aria-label={field?.name ?? t('leads.customFieldFilter')}
          />
        </div>
      )}
    </>
  );
}
