import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { MessageTemplate } from '@/features/campaigns/api';
import { formatMessageTemplateCategory } from '@/lib/presentation-labels';

export type CampaignTemplateForm = {
  name: string;
  category: string;
  subject: string;
  body: string;
};

export function CampaignTemplatesModal({
  open,
  onClose,
  variables,
  templateForm,
  onTemplateFormChange,
  templates,
  creating,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  variables: string[];
  templateForm: CampaignTemplateForm;
  onTemplateFormChange: (form: CampaignTemplateForm) => void;
  templates: MessageTemplate[];
  creating: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('campaigns.templatesManage')}>
      <div className="space-y-4">
        <p className="text-xs text-amber-200">{t('campaigns.previewNotice')}</p>
        <p className="text-xs text-[color:var(--ink-muted)]">
          {t('campaigns.variablesHint')}: {variables.join(', ')}
        </p>
        <Input
          value={templateForm.name}
          onChange={(e) => onTemplateFormChange({ ...templateForm, name: e.target.value })}
          placeholder={t('campaigns.templateName')}
          aria-label={t('campaigns.templateName')}
        />
        <Input
          value={templateForm.category}
          onChange={(e) => onTemplateFormChange({ ...templateForm, category: e.target.value })}
          placeholder={t('campaigns.templateCategory')}
          aria-label={t('campaigns.templateCategory')}
        />
        <Input
          value={templateForm.subject}
          onChange={(e) => onTemplateFormChange({ ...templateForm, subject: e.target.value })}
          placeholder={t('campaigns.templateSubject')}
          aria-label={t('campaigns.templateSubject')}
        />
        <textarea
          className="min-h-28 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface-card)] px-3 py-2 text-sm"
          value={templateForm.body}
          onChange={(e) => onTemplateFormChange({ ...templateForm, body: e.target.value })}
          aria-label={t('campaigns.templateBody')}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" loading={creating} onClick={onCreate}>
            {t('campaigns.saveTemplate')}
          </Button>
        </div>
        <ul className="space-y-2 text-sm text-[color:var(--ink)]">
          {templates.map((template) => (
            <li key={template.id} className="rounded-md border border-[color:var(--border)] p-3">
              <div className="font-medium text-[color:var(--ink)]">{template.name}</div>
              <div className="text-xs text-[color:var(--ink-muted)]">
                {formatMessageTemplateCategory(template.category)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
