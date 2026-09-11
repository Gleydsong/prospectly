import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import type { SavedViewVisibility } from '@/features/saved-views/api';

export function LeadsSaveViewDialog({
  open,
  mode,
  name,
  visibility,
  saving,
  onClose,
  onNameChange,
  onVisibilityChange,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'update';
  name: string;
  visibility: SavedViewVisibility;
  saving: boolean;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onVisibilityChange: (value: SavedViewVisibility) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(mode === 'update' ? 'leads.updateViewTitle' : 'leads.saveViewTitle')}
    >
      <div className="space-y-4">
        <Input
          id="saved-view-name"
          name="viewName"
          label={t('leads.saveViewName')}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={120}
        />
        <Select
          id="saved-view-visibility"
          label={t('leads.saveViewVisibility')}
          value={visibility}
          onChange={(event) => onVisibilityChange(event.target.value as SavedViewVisibility)}
        >
          <option value="PRIVATE">{t('leads.saveViewPrivate')}</option>
          <option value="TEAM">{t('leads.saveViewTeam')}</option>
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" loading={saving} disabled={!name.trim()} onClick={onSave}>
            {mode === 'update' ? t('leads.updateView') : t('leads.saveViewSubmit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
