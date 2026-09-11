import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CustomFieldDefinition } from '@/features/custom-fields/api';
import { pickerCustomFields, opsForType } from '@/features/custom-fields/lead-list-custom-fields';
import type { SavedView } from '@/features/saved-views/api';
import {
  DEFAULT_LAST_CONTACT_DAYS,
  LEAD_VIEW_COLUMN_KEYS,
  toggleLeadViewColumn,
  type CustomFieldFilterOp,
  type CustomFieldListFilter,
  type LastContactOp,
  type LeadViewColumnKey,
  type LeadViewLayout,
} from '@/features/saved-views/lead-filter';
import { getLeadStatusLabel } from '@/lib/lead-status';
import { LeadStatus } from '@/types';

import { CustomFieldFilterValue } from './custom-field-filter-value';

export function LeadsListToolbar({
  q,
  onQChange,
  onSearch,
  status,
  onStatusChange,
  statusOr,
  onStatusOrChange,
  hasWebsite,
  onHasWebsiteChange,
  lastContactOp,
  onLastContactOpChange,
  lastContactDays,
  onLastContactDaysChange,
  customFields,
  customFilters,
  onCustomFiltersChange,
  layout,
  onLayoutChange,
  columns,
  onColumnsChange,
  viewId,
  views,
  onSelectView,
  canSaveView,
  selectedView,
  duplicating,
  archiving,
  previewCount,
  onCreateView,
  onDuplicateView,
  onUpdateView,
  onArchiveView,
}: {
  q: string;
  onQChange: (value: string) => void;
  onSearch: () => void;
  status: LeadStatus | '';
  onStatusChange: (value: LeadStatus | '') => void;
  statusOr: LeadStatus | '';
  onStatusOrChange: (value: LeadStatus | '') => void;
  hasWebsite: '' | 'yes' | 'no';
  onHasWebsiteChange: (value: '' | 'yes' | 'no') => void;
  lastContactOp: LastContactOp;
  onLastContactOpChange: (value: LastContactOp) => void;
  lastContactDays: number;
  onLastContactDaysChange: (value: number) => void;
  customFields: CustomFieldDefinition[];
  customFilters: CustomFieldListFilter[];
  onCustomFiltersChange: (value: CustomFieldListFilter[]) => void;
  layout: LeadViewLayout;
  onLayoutChange: (value: LeadViewLayout) => void;
  columns: LeadViewColumnKey[];
  onColumnsChange: (value: LeadViewColumnKey[]) => void;
  viewId: string;
  views: SavedView[];
  onSelectView: (id: string) => void;
  canSaveView: boolean;
  selectedView?: SavedView;
  duplicating: boolean;
  archiving: boolean;
  previewCount?: number;
  onCreateView: () => void;
  onDuplicateView: () => void;
  onUpdateView: () => void;
  onArchiveView: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 border-b border-[color:var(--border)] p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_200px_170px_auto]">
        <div className="flex gap-2">
          <Input
            placeholder={t('principal.clientsSearch')}
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearch();
            }}
            aria-label={t('nav.searchClients')}
          />
        </div>
        <Select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as LeadStatus | '')}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {Object.values(LeadStatus).map((value) => (
            <option key={value} value={value}>
              {getLeadStatusLabel(value)}
            </option>
          ))}
        </Select>
        <Select
          value={statusOr}
          onChange={(event) => onStatusOrChange(event.target.value as LeadStatus | '')}
          aria-label={t('leads.statusOr')}
        >
          <option value="">{t('leads.statusOrNone')}</option>
          {Object.values(LeadStatus).map((value) => (
            <option key={value} value={value}>
              {getLeadStatusLabel(value)}
            </option>
          ))}
        </Select>
        <Select
          value={hasWebsite}
          onChange={(event) => onHasWebsiteChange(event.target.value as '' | 'yes' | 'no')}
          aria-label="Filtrar por website"
        >
          <option value="">Com/sem site</option>
          <option value="yes">Com site</option>
          <option value="no">Sem site</option>
        </Select>
        <Button variant="outline" onClick={onSearch}>
          Buscar
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Select
            value={lastContactOp}
            onChange={(event) => onLastContactOpChange(event.target.value as LastContactOp)}
            aria-label={t('leads.lastContact')}
          >
            <option value="">{t('leads.lastContactAny')}</option>
            <option value="older_than">{t('leads.lastContactOlder')}</option>
            <option value="within">{t('leads.lastContactWithin')}</option>
          </Select>
        </div>
        {lastContactOp ? (
          <div className="w-full sm:w-28">
            <Input
              type="number"
              min={1}
              max={365}
              value={lastContactDays}
              onChange={(event) => {
                const next = Number(event.target.value);
                onLastContactDaysChange(
                  Number.isInteger(next)
                    ? Math.min(365, Math.max(1, next))
                    : DEFAULT_LAST_CONTACT_DAYS,
                );
              }}
              aria-label={t('leads.lastContactDays')}
            />
          </div>
        ) : null}
        <div className="w-full sm:w-56">
          <Select
            value={customFilters[0]?.fieldId ?? ''}
            onChange={(event) => {
              const fieldId = event.target.value;
              if (!fieldId) {
                onCustomFiltersChange([]);
                return;
              }
              const field = customFields.find((item) => item.id === fieldId);
              const op: CustomFieldFilterOp = field ? opsForType(field.type)[0] : 'eq';
              onCustomFiltersChange([
                {
                  fieldId,
                  op,
                  value: '',
                  days: DEFAULT_LAST_CONTACT_DAYS,
                },
              ]);
            }}
            aria-label={t('leads.customFieldFilter')}
          >
            <option value="">{t('leads.customFieldFilterNone')}</option>
            {pickerCustomFields(
              customFields,
              customFilters.map((item) => item.fieldId),
            ).map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
                {field.archivedAt ? ` (${t('leads.customFieldArchivedSuffix')})` : ''}
              </option>
            ))}
          </Select>
        </div>
        {customFilters[0] ? (
          <CustomFieldFilterValue
            fields={customFields}
            filter={customFilters[0]}
            onChange={(next) => onCustomFiltersChange([next])}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('leads.layout')}>
          <Button
            type="button"
            variant={layout === 'table' ? 'primary' : 'outline'}
            aria-pressed={layout === 'table'}
            onClick={() => onLayoutChange('table')}
          >
            {t('leads.layoutTable')}
          </Button>
          <Button
            type="button"
            variant={layout === 'kanban' ? 'primary' : 'outline'}
            aria-pressed={layout === 'kanban'}
            onClick={() => onLayoutChange('kanban')}
          >
            {t('leads.layoutKanban')}
          </Button>
        </div>
        {layout === 'table' ? (
          <fieldset className="flex flex-wrap gap-3 rounded-lg border border-[color:var(--border)] px-3 py-2">
            <legend className="px-1 text-xs font-semibold text-[color:var(--ink-muted)]">
              {t('leads.columns')}
            </legend>
            {LEAD_VIEW_COLUMN_KEYS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-1.5 text-sm text-[color:var(--ink)]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[color:var(--border)]"
                  checked={columns.includes(column)}
                  disabled={column === 'companyName'}
                  onChange={() => {
                    if (column === 'companyName') return;
                    onColumnsChange(toggleLeadViewColumn(columns, column));
                  }}
                />
                {t(`leads.column.${column}`)}
              </label>
            ))}
            {pickerCustomFields(customFields, columns).map((field) => (
              <label
                key={field.id}
                className="flex items-center gap-1.5 text-sm text-[color:var(--ink)]"
              >
                <input
                  type="checkbox"
                  aria-label={field.name}
                  className="h-4 w-4 rounded border-[color:var(--border)]"
                  checked={columns.includes(field.id)}
                  onChange={() => onColumnsChange(toggleLeadViewColumn(columns, field.id))}
                />
                <span className="max-w-[180px] truncate" title={field.name}>
                  {field.name}
                </span>
                <span className="rounded bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--ink-muted)] border border-[color:var(--border)]">
                  {t('leads.customFieldBadge')}
                </span>
                {field.archivedAt ? (
                  <span className="text-xs text-[color:var(--ink-muted)]">
                    ({t('leads.customFieldArchivedSuffix')})
                  </span>
                ) : null}
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs sm:flex-1">
          <Select
            id="leads-saved-view"
            label={t('leads.viewsLabel')}
            value={viewId}
            onChange={(event) => onSelectView(event.target.value)}
          >
            <option value="">{t('leads.viewsNone')}</option>
            {views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSaveView ? (
            <Button type="button" variant="outline" onClick={onCreateView}>
              {t('leads.saveView')}
            </Button>
          ) : null}
          {canSaveView && selectedView ? (
            <Button type="button" variant="outline" loading={duplicating} onClick={onDuplicateView}>
              {t('leads.duplicateView')}
            </Button>
          ) : null}
          {canSaveView && selectedView?.canEdit ? (
            <Button type="button" variant="outline" onClick={onUpdateView}>
              {t('leads.updateView')}
            </Button>
          ) : null}
          {canSaveView && selectedView?.canEdit ? (
            <Button type="button" variant="ghost" loading={archiving} onClick={onArchiveView}>
              {t('leads.archiveView')}
            </Button>
          ) : null}
        </div>
      </div>
      {previewCount != null && selectedView ? (
        <p className="text-sm text-[color:var(--ink-muted)]">
          {t('leads.viewCount', { count: previewCount })}
        </p>
      ) : null}
    </div>
  );
}
