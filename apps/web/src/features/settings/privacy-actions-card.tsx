import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { logout, requestDataDeletion, requestDataExport } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function PrivacyActionsCard() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const emailVerified = Boolean(user?.emailVerifiedAt);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [dsrMessage, setDsrMessage] = useState<string | null>(null);
  const confirmWord = i18n.language.startsWith('en') ? 'DELETE' : 'EXCLUIR';

  const exportData = useMutation({
    mutationFn: () =>
      requestDataExport('Solicitação via app — exportação de dados pessoais (LGPD)'),
    onSuccess: () => setDsrMessage(t('settings.exportSuccess')),
    onError: (err) => setDsrMessage(getApiErrorMessage(err)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => requestDataDeletion('Solicitação via app — exclusão de conta (LGPD)'),
    onSuccess: async () => {
      setDsrMessage(t('settings.deleteSuccess'));
      setDeleteOpen(false);
      try {
        await logout();
      } catch {
        /* ignore */
      }
      clearAuth();
      window.location.assign('/login');
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err);
      setDsrMessage(msg === 'EMAIL_NOT_VERIFIED' ? t('settings.emailGateHint') : msg);
    },
  });

  return (
    <>
      <Card>
        <CardHeader
          className="px-6 py-5 sm:px-8"
          title={t('settings.privacyTitle')}
          description={t('settings.privacyDesc')}
        />
        <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
          <p className="text-sm leading-6 text-[color:var(--ink-muted)]">
            {t('settings.privacyBody')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              loading={exportData.isPending}
              disabled={!emailVerified}
              onClick={() => exportData.mutate()}
            >
              {t('settings.requestExport')}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!emailVerified}
              onClick={() => setDeleteOpen(true)}
            >
              {t('settings.deleteAccount')}
            </Button>
          </div>
          {!emailVerified ? <Alert tone="warning">{t('settings.emailGateHint')}</Alert> : null}
          {dsrMessage ? <Alert tone="info">{dsrMessage}</Alert> : null}
        </CardContent>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('settings.deleteAccountTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--ink-muted)]">{t('settings.deleteAccountBody')}</p>
          <Input
            id="delete-confirm"
            name="delete-confirm"
            label={t('settings.deleteConfirmLabel', { word: confirmWord })}
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            autoComplete="off"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleteAccount.isPending}
              disabled={deleteConfirm.trim().toUpperCase() !== confirmWord}
              onClick={() => deleteAccount.mutate()}
            >
              {t('settings.deleteAccount')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
