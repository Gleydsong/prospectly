import type { CustomFieldDefinition, CustomFieldType } from './api';
import type { CustomFieldFilterOp } from '@/features/saved-views/lead-filter';

export function pickerCustomFields(
  fields: CustomFieldDefinition[],
  selectedColumns: string[],
): CustomFieldDefinition[] {
  return fields.filter((field) => !field.archivedAt || selectedColumns.includes(field.id));
}

export function opsForType(type: CustomFieldType): [CustomFieldFilterOp, ...CustomFieldFilterOp[]] {
  if (type === 'number') {
    return ['eq', 'gte', 'lte'];
  }
  if (type === 'date') {
    return ['eq', 'older_than', 'within'];
  }
  return ['eq'];
}
