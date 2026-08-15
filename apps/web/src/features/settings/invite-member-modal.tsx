import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { inviteOrganizationMember, type InviteRole } from '@/features/organizations/api';
import { generateTemporaryPassword } from '@/lib/compress-avatar';
import { getApiErrorMessage } from '@/lib/api';
import { Role } from '@/types';

const INVITE_ROLES: InviteRole[] = [Role.ADMIN, Role.SALES, Role.MEMBER, Role.VIEWER];

export function InviteMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>(Role.SALES);
  const [tempPassword, setTempPassword] = useState(() => generateTemporaryPassword());
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRole(Role.SALES);
    setTempPassword(generateTemporaryPassword());
    setRevealedPassword(null);
    setCopied(false);
    setError(null);
  }, [open]);

  const invite = useMutation({
    mutationFn: () =>
      inviteOrganizationMember({
        name: name.trim(),
        email: email.trim(),
        role,
        temporaryPassword: tempPassword,
      }),
    onSuccess: async () => {
      setRevealedPassword(tempPassword);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'members'] });
    },
    onError: (err) => setError(getApiErrorMessage(err) || t('settings.inviteError')),
  });

  const copyPassword = async () => {
    if (!revealedPassword) return;
    await navigator.clipboard.writeText(revealedPassword);
    setCopied(true);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('settings.inviteTitle')}>
      {revealedPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--ink-muted)]">{t('settings.inviteSuccessBody')}</p>
          <div className="flex items-center gap-2 rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
            <code className="flex-1 truncate font-mono text-sm text-[color:var(--ink)]">
              {revealedPassword}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyPassword()}>
              <Copy className="h-4 w-4" />
              {copied ? t('settings.copied') : t('settings.copyPassword')}
            </Button>
          </div>
          <p className="text-xs text-amber-300">{t('settings.invitePasswordWarning')}</p>
          <Button type="button" onClick={onClose}>
            {t('common.back')}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <Input
            id="invite-name"
            name="invite-name"
            label={t('settings.memberName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
          <Input
            id="invite-email"
            name="invite-email"
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Select
            id="invite-role"
            name="invite-role"
            label={t('settings.memberRole')}
            value={role}
            onChange={(event) => setRole(event.target.value as InviteRole)}
          >
            {INVITE_ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`settings.roles.${value}`)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-[color:var(--ink-muted)]">{t('settings.inviteHint')}</p>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={invite.isPending}>
              {t('settings.inviteSubmit')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
