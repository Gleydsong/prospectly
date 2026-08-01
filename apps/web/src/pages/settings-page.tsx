import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Copy, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  cancelBillingSubscription,
  changeEmail,
  createBillingPortal,
  createCheckoutSession,
  getBillingStatus,
  getProfile,
  logout,
  requestDataDeletion,
  requestDataExport,
  updateProfile,
} from '@/features/auth/api';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import {
  fetchCurrentOrganization,
  fetchOrganizationMembers,
  inviteOrganizationMember,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  updateOrganizationName,
  type InviteRole,
  type OrgMember,
} from '@/features/organizations/api';
import { fetchIntegrations, upsertWebhookIntegration } from '@/features/integrations/api';
import { fetchScoreConfig, updateScoreRules, type ScoreRule } from '@/features/scoring/api';
import { setAppLocale } from '@/i18n';
import { compressAvatarFile, generateTemporaryPassword } from '@/lib/compress-avatar';
import { getApiErrorMessage } from '@/lib/api';
import type { AppLocale } from '@/lib/locale';
import { assignStripeRedirect } from '@/lib/safe-url';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';
const INVITE_ROLES: InviteRole[] = [Role.ADMIN, Role.SALES, Role.MEMBER, Role.VIEWER];

function canManageOrg(role: Role | string | undefined): boolean {
  return role === Role.OWNER || role === Role.ADMIN || role === 'OWNER' || role === 'ADMIN';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function ScoringSettingsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const emailVerified = Boolean(useAuthStore((s) => s.user?.emailVerifiedAt));
  const [draft, setDraft] = useState<ScoreRule[] | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ['scoring', 'config'],
    queryFn: fetchScoreConfig,
  });

  const rules = draft ?? configQuery.data?.rules ?? [];

  const saveMutation = useMutation({
    mutationFn: () =>
      updateScoreRules(
        rules.map((rule) => ({
          key: rule.key,
          enabled: rule.enabled,
          points: rule.points,
        })),
      ),
    onSuccess: async (data) => {
      setDraft(null);
      setSaveError(null);
      setSaveMessage(t('settings.scoringSaved'));
      await queryClient.setQueryData(['scoring', 'config'], data);
    },
    onError: (err) => {
      setSaveMessage(null);
      setSaveError(getApiErrorMessage(err) || t('settings.scoringError'));
    },
  });

  const updateRule = (key: string, patch: Partial<Pick<ScoreRule, 'enabled' | 'points'>>) => {
    const base = draft ?? configQuery.data?.rules ?? [];
    setDraft(base.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)));
  };

  return (
    <Card>
      <CardHeader title={t('settings.scoringTitle')} description={t('settings.scoringDesc')} />
      <CardContent className="space-y-4">
        {configQuery.isLoading ? (
          <Skeleton className="h-40" />
        ) : configQuery.isError ? (
          <p className="text-sm text-red-300" role="alert">
            {getApiErrorMessage(configQuery.error) || t('settings.scoringError')}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {rules.map((rule) => (
                <li key={rule.key} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <label className="flex min-w-0 flex-1 items-center gap-2.5 text-sm text-zinc-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-700 text-brand-400 focus:ring-brand-400"
                      checked={rule.enabled}
                      onChange={(event) => updateRule(rule.key, { enabled: event.target.checked })}
                    />
                    <span className="font-medium">
                      {t(`scoreRules.${rule.key}`, { defaultValue: rule.description || rule.key })}
                    </span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    className="w-24"
                    aria-label={t('settings.scoringPointsAria', {
                      rule: t(`scoreRules.${rule.key}`, { defaultValue: rule.key }),
                    })}
                    value={rule.points}
                    onChange={(event) =>
                      updateRule(rule.key, {
                        points: Math.max(0, Math.min(50, Number(event.target.value) || 0)),
                      })
                    }
                  />
                </li>
              ))}
            </ul>
            {saveError ? (
              <p className="text-sm text-red-300" role="alert">
                {saveError}
              </p>
            ) : null}
            {saveMessage ? <p className="text-sm text-brand-300">{saveMessage}</p> : null}
            {!emailVerified ? (
              <p className="text-xs text-amber-200/90">{t('settings.emailGateHint')}</p>
            ) : null}
            <Button
              type="button"
              loading={saveMutation.isPending}
              disabled={!draft || !emailVerified}
              onClick={() => saveMutation.mutate()}
            >
              {t('settings.scoringSave')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InviteMemberModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
          <p className="text-sm text-zinc-300">{t('settings.inviteSuccessBody')}</p>
          <div className="flex items-center gap-2 rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2">
            <code className="flex-1 truncate font-mono text-sm text-zinc-50">{revealedPassword}</code>
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
            label={t('settings.memberName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Select
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
          <p className="text-xs text-zinc-500">{t('settings.inviteHint')}</p>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
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

function IntegrationsSettingsCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const integrations = useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
    enabled: canManage,
  });

  const webhook = integrations.data?.find((row) => row.provider === 'WEBHOOK');

  useEffect(() => {
    if (!webhook) return;
    setUrl(webhook.url ?? '');
    setLabel(webhook.label ?? '');
    setEnabled(webhook.status === 'ENABLED');
  }, [webhook?.id, webhook?.url, webhook?.label, webhook?.status]);

  const save = useMutation({
    mutationFn: () =>
      upsertWebhookIntegration({
        url: url.trim(),
        label: label.trim() || undefined,
        enabled,
      }),
    onSuccess: async () => {
      setMessage(t('settings.webhookSaved'));
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (err) => {
      setMessage(null);
      setError(getApiErrorMessage(err) || t('settings.webhookError'));
    },
  });

  if (!canManage) return null;

  return (
    <Card>
      <CardHeader title={t('settings.integrationsTitle')} description={t('settings.integrationsDesc')} />
      <CardContent className="space-y-4">
        {integrations.isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            {!webhook && !url ? (
              <p className="text-sm text-zinc-500">{t('settings.webhookEmpty')}</p>
            ) : null}
            <Input
              label={t('settings.webhookUrl')}
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://hooks.example.com/prospectly"
              required
            />
            <Input
              label={t('settings.webhookLabel')}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={120}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-700 text-brand-400 focus:ring-brand-400"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              {enabled ? t('settings.webhookEnabled') : t('settings.webhookDisabled')}
            </label>
            {message ? <p className="text-sm text-brand-300">{message}</p> : null}
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              loading={save.isPending}
              disabled={!url.trim()}
              onClick={() => save.mutate()}
            >
              {t('settings.webhookSave')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearAuth = useAuthStore((state) => state.clear);
  const [searchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [locale, setLocale] = useState<AppLocale>((user?.locale as AppLocale) ?? 'pt');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState(user?.organizationName ?? '');
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'lifetime'>(() => {
    const plan = searchParams.get('plan');
    return plan === 'lifetime' || plan === 'monthly' ? plan : 'monthly';
  });
  const [currency, setCurrency] = useState<'BRL' | 'EUR' | 'USD'>(() => {
    const value = searchParams.get('currency');
    return value === 'BRL' || value === 'EUR' || value === 'USD' ? value : 'BRL';
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [dsrMessage, setDsrMessage] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const manage = canManageOrg(user?.role);
  const emailVerified = Boolean(user?.emailVerifiedAt);

  useEffect(() => {
    setName(user?.name ?? '');
    setLocale((user?.locale as AppLocale) ?? 'pt');
    setAvatarPreview(user?.avatarUrl ?? null);
    setOrgName(user?.organizationName ?? '');
  }, [user?.name, user?.locale, user?.avatarUrl, user?.organizationName]);

  useEffect(() => {
    void getProfile()
      .then((profile) => {
        updateUser({
          email: profile.email,
          emailVerifiedAt: profile.emailVerifiedAt ?? null,
          name: profile.name,
          locale: profile.locale,
          avatarUrl: profile.avatarUrl,
        });
      })
      .catch(() => undefined);
  }, [updateUser]);

  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: fetchCurrentOrganization,
  });

  useEffect(() => {
    if (orgQuery.data?.name) setOrgName(orgQuery.data.name);
  }, [orgQuery.data?.name]);

  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: fetchOrganizationMembers,
  });

  const billing = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
  });

  const saveProfile = useMutation({
    mutationFn: () =>
      updateProfile({
        name: name.trim(),
        locale,
        ...(avatarPreview && avatarPreview !== user?.avatarUrl
          ? { avatarUrl: avatarPreview }
          : {}),
      }),
    onSuccess: async (data) => {
      updateUser({
        name: data.name,
        locale: data.locale,
        avatarUrl: data.avatarUrl,
      });
      await setAppLocale(data.locale);
      setProfileMessage(t('settings.profileSaved'));
      setProfileError(null);
    },
    onError: (err) => {
      setProfileMessage(null);
      setProfileError(getApiErrorMessage(err) || t('settings.profileError'));
    },
  });

  const saveOrg = useMutation({
    mutationFn: () => updateOrganizationName(orgName.trim()),
    onSuccess: async (data) => {
      updateUser({ organizationName: data.name });
      setOrgMessage(t('settings.orgSaved'));
      setOrgError(null);
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err);
      setOrgMessage(null);
      setOrgError(
        msg === 'EMAIL_NOT_VERIFIED' ? t('settings.emailGateHint') : msg || t('settings.orgError'),
      );
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: () =>
      changeEmail({ newEmail: newEmail.trim(), currentPassword: emailPassword }),
    onSuccess: (data) => {
      setEmailMessage(data.message || t('settings.emailChangeSuccess'));
      setEmailError(null);
      setEmailPassword('');
      updateUser({ email: newEmail.trim().toLowerCase(), emailVerifiedAt: null });
    },
    onError: (err) => {
      setEmailMessage(null);
      setEmailError(getApiErrorMessage(err) || t('settings.emailChangeError'));
    },
  });

  const checkout = useMutation({
    mutationFn: () => createCheckoutSession({ interval: billingInterval, currency }),
    onSuccess: (data) => handleCheckoutResult(data),
    onError: (err) => setBillingError(getApiErrorMessage(err)),
  });

  const portal = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: (data) => assignStripeRedirect(data.url),
    onError: (err) => setBillingError(getApiErrorMessage(err)),
  });

  const cancelSub = useMutation({
    mutationFn: cancelBillingSubscription,
    onSuccess: async () => {
      setBillingError(null);
      await queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
    },
    onError: (err) => setBillingError(getApiErrorMessage(err)),
  });

  const exportData = useMutation({
    mutationFn: () =>
      requestDataExport('Solicitação via app — exportação de dados pessoais (LGPD)'),
    onSuccess: () => setDsrMessage(t('settings.exportSuccess')),
    onError: (err) => setDsrMessage(getApiErrorMessage(err)),
  });

  const deleteAccount = useMutation({
    mutationFn: () =>
      requestDataDeletion('Solicitação via app — exclusão de conta (LGPD)'),
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

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Role }) =>
      updateOrganizationMemberRole(memberId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'members'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeOrganizationMember(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'members'] });
    },
  });

  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await compressAvatarFile(file);
      setAvatarPreview(dataUrl);
      setProfileError(null);
    } catch {
      setProfileError(t('settings.avatarError'));
    }
  };

  const profileDirty =
    name.trim() !== (user?.name ?? '') ||
    locale !== (user?.locale ?? 'pt') ||
    (avatarPreview ?? null) !== (user?.avatarUrl ?? null);

  const orgDirty = orgName.trim() !== (orgQuery.data?.name ?? user?.organizationName ?? '');
  const isActive = billing.data?.planStatus === 'ACTIVE';
  const confirmWord = i18n.language.startsWith('en') ? 'DELETE' : 'EXCLUIR';

  const subscribeLabel =
    currency === 'BRL' && billingInterval === 'lifetime'
      ? t('settings.subscribeLifetimePix')
      : currency === 'BRL' && billingInterval === 'monthly'
        ? t('settings.subscribeMonthly')
        : t('settings.subscribe');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('settings.title')}</h1>
        <p className="text-sm text-zinc-500">{user?.organizationName}</p>
      </div>

      <Card>
        <CardHeader title={t('settings.profileTitle')} description={t('settings.profileDesc')} />
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <div
                className={cn(
                  'flex h-20 w-20 items-center justify-center overflow-hidden rounded-full',
                  'border border-zinc-700 bg-zinc-800 text-lg font-semibold text-zinc-100',
                )}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(name || user?.name || '?')
                )}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-500"
                aria-label={t('settings.changePhoto')}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void onPickAvatar(event.target.files?.[0])}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <Input
                label={t('settings.memberName')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
              />
              <Input label={t('auth.email')} value={user?.email ?? ''} disabled readOnly />
              <Select
                label={t('auth.language')}
                value={locale}
                onChange={(event) => setLocale(event.target.value as AppLocale)}
              >
                <option value="pt">{t('auth.languagePt')}</option>
                <option value="en">{t('auth.languageEn')}</option>
              </Select>
            </div>
          </div>
          {profileMessage ? <p className="text-sm text-brand-300">{profileMessage}</p> : null}
          {profileError ? (
            <p className="text-sm text-red-400" role="alert">
              {profileError}
            </p>
          ) : null}
          <Button
            loading={saveProfile.isPending}
            disabled={!profileDirty}
            onClick={() => saveProfile.mutate()}
          >
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.emailTitle')} description={t('settings.emailDesc')} />
        <CardContent className="space-y-3" id="email">
          <p className="text-sm text-zinc-400">
            {emailVerified ? t('settings.emailVerified') : t('settings.emailUnverified')}
            {user?.email ? ` · ${user.email}` : null}
          </p>
          <Input
            label={t('settings.emailNew')}
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            autoComplete="email"
          />
          <Input
            label={t('settings.emailCurrentPassword')}
            type="password"
            value={emailPassword}
            onChange={(event) => setEmailPassword(event.target.value)}
            autoComplete="current-password"
          />
          {emailMessage ? <p className="text-sm text-brand-300">{emailMessage}</p> : null}
          {emailError ? (
            <p className="text-sm text-red-400" role="alert">
              {emailError}
            </p>
          ) : null}
          <Button
            loading={changeEmailMutation.isPending}
            disabled={!newEmail.trim() || !emailPassword}
            onClick={() => changeEmailMutation.mutate()}
          >
            {t('settings.emailChangeSubmit')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.orgTitle')} description={t('settings.orgDesc')} />
        <CardContent className="space-y-3">
          {orgQuery.isLoading ? (
            <Skeleton className="h-10" />
          ) : (
            <Input
              label={t('settings.orgName')}
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              disabled={!manage}
              maxLength={120}
            />
          )}
          {orgMessage ? <p className="text-sm text-brand-300">{orgMessage}</p> : null}
          {orgError ? (
            <p className="text-sm text-red-400" role="alert">
              {orgError}
            </p>
          ) : null}
          {manage ? (
            <Button
              loading={saveOrg.isPending}
              disabled={!orgDirty || !orgName.trim() || !emailVerified}
              onClick={() => saveOrg.mutate()}
            >
              {t('common.save')}
            </Button>
          ) : (
            <p className="text-xs text-zinc-500">{t('settings.orgReadOnly')}</p>
          )}
          {manage && !emailVerified ? (
            <p className="text-xs text-amber-200/90">{t('settings.emailGateHint')}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.billingTitle')} description={t('settings.billingDesc')} />
        <CardContent className="space-y-4">
          {billing.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300">
              <span>
                <span className="text-zinc-500">{t('settings.planLabel')}: </span>
                <strong className="text-zinc-50">{billing.data?.plan ?? 'FREE'}</strong>
              </span>
              <Badge tone={isActive ? 'brand' : 'slate'}>
                {billing.data?.planStatus ?? 'INACTIVE'}
              </Badge>
              {billing.data?.planCurrency ? (
                <span className="text-zinc-400">{billing.data.planCurrency}</span>
              ) : null}
              {!isActive ? (
                <span className="text-zinc-500">
                  {t('settings.freeSearches', { count: billing.data?.freeSearchLimit ?? 3 })}
                </span>
              ) : null}
              {billing.data?.currentPeriodEnd ? (
                <span className="text-zinc-500">
                  {t('settings.periodEnd', {
                    date: formatDate(billing.data.currentPeriodEnd),
                  })}
                </span>
              ) : null}
            </div>
          )}

          {billingError ? (
            <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {billingError}
            </p>
          ) : null}

          {!isActive ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t('settings.interval')}
                value={billingInterval}
                onChange={(event) =>
                  setBillingInterval(event.target.value as 'monthly' | 'lifetime')
                }
              >
                <option value="monthly">{t('settings.intervalMonthly')}</option>
                <option value="lifetime">{t('settings.intervalLifetime')}</option>
              </Select>
              <Select
                label={t('settings.currency')}
                value={currency}
                onChange={(event) => setCurrency(event.target.value as 'BRL' | 'EUR' | 'USD')}
              >
                <option value="BRL">BRL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {!isActive ? (
              <Button
                type="button"
                loading={checkout.isPending}
                disabled={!emailVerified}
                onClick={() => checkout.mutate()}
              >
                {subscribeLabel}
              </Button>
            ) : null}
            {billing.data?.canOpenPortal ? (
              <Button
                type="button"
                variant="secondary"
                loading={portal.isPending}
                disabled={!emailVerified}
                onClick={() => portal.mutate()}
              >
                {t('settings.stripePortal')}
              </Button>
            ) : null}
            {billing.data?.canCancelSubscription ? (
              <Button
                type="button"
                variant="outline"
                loading={cancelSub.isPending}
                disabled={!emailVerified}
                onClick={() => cancelSub.mutate()}
              >
                {t('settings.cancelSubscription')}
              </Button>
            ) : null}
            <a
              className="inline-flex items-center text-sm font-medium text-brand-400 hover:text-brand-300"
              href={`${LANDING_URL}/pricing`}
              target="_blank"
              rel="noreferrer"
            >
              {t('settings.viewPricing')}
            </a>
          </div>
          {!emailVerified ? (
            <p className="text-xs text-amber-200/90">{t('settings.emailGateHint')}</p>
          ) : null}
        </CardContent>
      </Card>

      <IntegrationsSettingsCard canManage={manage} />

      <Card>
        <CardHeader
          title={t('settings.membersTitle')}
          description={t('settings.membersDesc')}
          action={
            manage ? (
              <Button
                type="button"
                size="sm"
                disabled={!emailVerified}
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                {t('settings.inviteButton')}
              </Button>
            ) : undefined
          }
        />
        <CardContent>
          {members.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-zinc-800">
              {(members.data ?? []).map((member: OrgMember) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-50">{member.user.name}</p>
                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {manage && member.user.id !== user?.id ? (
                      <>
                        <Select
                          value={member.role}
                          aria-label={t('settings.memberRole')}
                          className="w-36"
                          onChange={(event) =>
                            updateRole.mutate({
                              memberId: member.id,
                              role: event.target.value as Role,
                            })
                          }
                        >
                          {(['OWNER', ...INVITE_ROLES] as Role[]).map((value) => (
                            <option key={value} value={value}>
                              {t(`settings.roles.${value}`)}
                            </option>
                          ))}
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={t('settings.removeMember')}
                          onClick={() => {
                            if (window.confirm(t('settings.removeMemberConfirm'))) {
                              removeMember.mutate(member.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </>
                    ) : (
                      <Badge tone={member.role === 'OWNER' ? 'brand' : 'slate'}>
                        {t(`settings.roles.${member.role}`, { defaultValue: member.role })}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.privacyTitle')} description={t('settings.privacyDesc')} />
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300">{t('settings.privacyBody')}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/settings/privacy"
              className="inline-flex h-10 items-center justify-center rounded-control bg-zinc-800 px-4 text-sm font-medium text-zinc-50 hover:bg-zinc-700"
            >
              {t('settings.viewLgpd')}
            </Link>
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
          {!emailVerified ? (
            <p className="text-xs text-amber-200/90">{t('settings.emailGateHint')}</p>
          ) : null}
          {dsrMessage ? <p className="text-sm text-zinc-200">{dsrMessage}</p> : null}
        </CardContent>
      </Card>

      <ScoringSettingsCard />

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('settings.deleteAccountTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">{t('settings.deleteAccountBody')}</p>
          <Input
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
    </div>
  );
}
