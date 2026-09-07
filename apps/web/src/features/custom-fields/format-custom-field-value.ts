import type { CustomFieldDefinition } from './api';

export function formatCustomFieldValue(
  field: CustomFieldDefinition | undefined,
  value: string | number | null | undefined,
): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (field?.type === 'select') {
    return field.options.find((option) => option.id === value)?.label ?? String(value);
  }
  return String(value);
}
