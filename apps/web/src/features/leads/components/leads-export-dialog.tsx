import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  EXPORTABLE_LEAD_COLUMNS,
  type ExportableLeadColumn,
} from '@/features/leads/api';

export function LeadsExportDialog({
  open,
  columns,
  exporting,
  onClose,
  onToggleColumn,
  onExport,
}: {
  open: boolean;
  columns: ExportableLeadColumn[];
  exporting: boolean;
  onClose: () => void;
  onToggleColumn: (column: ExportableLeadColumn) => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('leads.exportTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-[color:var(--ink-muted)]">{t('leads.exportColumns')}</p>
        <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[color:var(--border)] p-3">
          {EXPORTABLE_LEAD_COLUMNS.map((column) => (
            <label key={column} className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[color:var(--border)] text-brand-400 focus:ring-[color:var(--ring)]"
                checked={columns.includes(column)}
                onChange={() => onToggleColumn(column)}
              />
              <span>{column}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-[color:var(--ink-muted)]">
          Os filtros atuais (busca, status, website e vista) serão aplicados à exportação.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            loading={exporting}
            disabled={!columns.length}
            onClick={onExport}
          >
            {t('leads.export')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
