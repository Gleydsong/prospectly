import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Globe, Lock, Mail, Trash2, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MonoLabel } from '@/components/ui/mono-label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { changeEmail, getProfile, updateProfile } from '@/features/auth/api';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { IntegrationsSettingsCard } from '@/features/settings/integrations-settings-card';
import { OrganizationFlagsCard } from '@/features/settings/organization-flags-card';
import { GoogleConnectionSettingsCard } from '@/features/google-connections/google-connection-settings-card';
import {
  fetchOrgGoogleConnections,
  revokeGoogleConnection,
} from '@/features/google-connections/api';
import { InviteMemberModal } from '@/features/settings/invite-member-modal';
import { SettingsShell } from '@/features/settings/settings-shell';
import { parseSettingsTab } from '@/features/settings/settings-tabs';
import {
  fetchCurrentOrganization,
  fetchOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  updateOrganizationName,
  updateOrganizationPersona,
  updatePersonaOverride,
  type OrgMember,
} from '@/features/organizations/api';
import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '@/features/organizations/professional-persona';
import { setAppLocale } from '@/i18n';
import { compressAvatarFile } from '@/lib/compress-avatar';
import { getApiErrorMessage } from '@/lib/api';
import type { AppLocale } from '@/lib/locale';
import { sanitizeAvatarSrc } from '@/lib/safe-url';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

const MEMBER_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.SALES, Role.MEMBER, Role.VIEWER];

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (UTC-3)' },
  { value: 'America/Manaus', label: 'America/Manaus (UTC-4)' },
  { value: 'America/Recife', label: 'America/Recife (UTC-3)' },
  { value: 'America/Belem', label: 'America/Belem (UTC-3)' },
  { value: 'America/Cuiaba', label: 'America/Cuiaba (UTC-4)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (UTC+0)' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [locale, setLocale] = useState<AppLocale>((user?.locale as AppLocale) ?? 'pt');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState(user?.organizationName ?? '');
  const [orgPersona, setOrgPersona] = useState<ProfessionalPersona>(
    user?.defaultPersona ?? 'vendedor',
  );
  const [orgOtherLabel, setOrgOtherLabel] = useState(user?.personaOtherLabel ?? '');
  const [overrideValue, setOverrideValue] = useState(user?.personaOverride ?? '');
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [quickInviteEmail, setQuickInviteEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const manage = canManageOrg(user?.role);
  const canMutatePersona = user?.role !== Role.VIEWER;
  const emailVerified = Boolean(user?.emailVerifiedAt);
  const requestedTab = parseSettingsTab(searchParams.get('tab'));
  const tab = requestedTab === 'integrations' && !manage ? 'organization' : requestedTab;

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
          role: (profile as { role?: Role }).role,
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
    if (orgQuery.data?.defaultPersona) setOrgPersona(orgQuery.data.defaultPersona);
    if (orgQuery.data && 'personaOtherLabel' in orgQuery.data) {
      setOrgOtherLabel(orgQuery.data.personaOtherLabel ?? '');
    }
  }, [orgQuery.data]);

  useEffect(() => {
    setOverrideValue(user?.personaOverride ?? '');
  }, [user?.personaOverride]);

  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: fetchOrganizationMembers,
    enabled: manage,
  });

  const orgGoogleConnections = useQuery({
    queryKey: ['google-connections', 'org'],
    queryFn: fetchOrgGoogleConnections,
    enabled: manage,
  });

  const googleConnectedUserIds = new Set(
    (orgGoogleConnections.data ?? []).map((row) => row.userId),
  );

  const revokeGoogle = useMutation({
    mutationFn: revokeGoogleConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['google-connections'] }),
  });

  const saveProfile = useMutation({
    mutationFn: () =>
      updateProfile({
        name: name.trim(),
        locale,
        ...(avatarPreview && avatarPreview !== user?.avatarUrl ? { avatarUrl: avatarPreview } : {}),
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
    mutationFn: async () => {
      if (orgDirty && orgName.trim()) {
        await updateOrganizationName(orgName.trim());
        updateUser({ organizationName: orgName.trim() });
      }
      if (orgPersonaDirty && !orgPersonaInvalid) {
        const data = await updateOrganizationPersona({
          defaultPersona: orgPersona,
          personaOtherLabel: orgPersona === 'outro' ? orgOtherLabel.trim() : null,
        });
        updateUser({
          defaultPersona: data.defaultPersona,
          personaOtherLabel: data.personaOtherLabel,
          effectivePersona: user?.personaOverride ?? data.defaultPersona,
          personaOnboardedAt: data.personaOnboardedAt,
        });
      }
      if (locale !== user?.locale) {
        await updateProfile({ locale });
        await setAppLocale(locale);
      }
    },
    onSuccess: async () => {
      setOrgMessage(t('settings.orgSaved'));
      setOrgError(null);
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err);
      setOrgMessage(null);
      setOrgError(msg === 'EMAIL_NOT_VERIFIED' ? t('settings.emailGateHint') : msg || t('settings.orgError'));
    },
  });

  const saveOrgPersona = useMutation({
    mutationFn: () =>
      updateOrganizationPersona({
        defaultPersona: orgPersona,
        personaOtherLabel: orgPersona === 'outro' ? orgOtherLabel.trim() : null,
      }),
    onSuccess: async (data) => {
      updateUser({
        defaultPersona: data.defaultPersona,
        personaOtherLabel: data.personaOtherLabel,
        effectivePersona: user?.personaOverride ?? data.defaultPersona,
        personaOnboardedAt: data.personaOnboardedAt,
      });
      setOrgMessage(t('settings.orgSaved'));
      setOrgError(null);
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
    onError: (err) => {
      setOrgMessage(null);
      setOrgError(getApiErrorMessage(err) || t('settings.orgError'));
    },
  });

  const saveOverride = useMutation({
    mutationFn: () =>
      updatePersonaOverride(overrideValue === '' ? null : (overrideValue as ProfessionalPersona)),
    onSuccess: (data) => {
      updateUser({
        defaultPersona: data.defaultPersona,
        personaOverride: data.personaOverride,
        effectivePersona: data.effectivePersona,
      });
      setProfileMessage(t('settings.profileSaved'));
      setProfileError(null);
    },
    onError: (err) => {
      setProfileMessage(null);
      setProfileError(getApiErrorMessage(err) || t('settings.profileError'));
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: () => changeEmail({ newEmail: newEmail.trim(), currentPassword: emailPassword }),
    onSuccess: (data) => {
      setEmailMessage(data.message || t('settings.emailChangeSuccess'));
      setEmailError(null);
      setEmailPassword('');
      setNewEmail('');
    },
    onError: (err) => {
      setEmailMessage(null);
      setEmailError(getApiErrorMessage(err) || t('settings.emailChangeError'));
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
  const savedOrgPersona = orgQuery.data?.defaultPersona ?? user?.defaultPersona;
  const savedOrgOtherLabel = orgQuery.data?.personaOtherLabel ?? user?.personaOtherLabel ?? '';
  const orgPersonaDirty =
    orgPersona !== savedOrgPersona ||
    (orgPersona === 'outro' ? orgOtherLabel.trim() !== savedOrgOtherLabel : Boolean(savedOrgOtherLabel));
  const orgPersonaInvalid = orgPersona === 'outro' && orgOtherLabel.trim().length < 2;
  const safeAvatarPreview = sanitizeAvatarSrc(avatarPreview);

  const memberList = members.data ?? [];
  const memberCount = memberList.length;

  // Render organization card
  const renderOrganizationCard = () => (
    <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-6">
      <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
        {t('settings.orgTitle', { defaultValue: 'Organização' })}
      </h2>

      {orgQuery.isLoading ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="org-name"
            name="org-name"
            label="Nome"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            disabled={!manage}
            maxLength={120}
          />

          <Select
            id="org-persona"
            name="org-persona"
            label="Persona padrão"
            value={orgPersona}
            disabled={!manage}
            onChange={(event) => {
              const next = event.target.value as ProfessionalPersona;
              setOrgPersona(next);
              if (next !== 'outro') setOrgOtherLabel('');
            }}
          >
            {PROFESSIONAL_PERSONAS.map((value) => (
              <option key={value} value={value}>
                {t(`persona.${value}`)}
              </option>
            ))}
          </Select>

          <Select
            id="org-timezone"
            name="org-timezone"
            label={t('settings.timezone', { defaultValue: 'Fuso horário' })}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>

          <Select
            id="org-locale"
            name="org-locale"
            label={t('auth.language', { defaultValue: 'Idioma' })}
            value={locale}
            onChange={(event) => setLocale(event.target.value as AppLocale)}
          >
            <option value="pt">Português (Brasil)</option>
            <option value="en">English (US)</option>
          </Select>
        </div>
      )}

      {orgPersona === 'outro' ? (
        <Input
          id="org-persona-other-label"
          name="org-persona-other-label"
          label={t('persona.otherLabel')}
          placeholder={t('persona.otherLabelPlaceholder')}
          value={orgOtherLabel}
          maxLength={40}
          disabled={!manage}
          onChange={(event) => setOrgOtherLabel(event.target.value)}
        />
      ) : null}

      {orgMessage ? <Alert tone="success">{orgMessage}</Alert> : null}
      {orgError ? <Alert tone="error">{orgError}</Alert> : null}

      {manage ? (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            className="rounded-full px-6 py-2.5 shadow-soft"
            loading={saveOrg.isPending || saveOrgPersona.isPending}
            disabled={!emailVerified}
            onClick={() => saveOrg.mutate()}
          >
            Salvar alterações
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[color:var(--ink-secondary)]">{t('settings.orgReadOnly')}</p>
      )}
    </section>
  );

  // Render users & permissions card
  const renderTeamCard = () => (
    <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
          {t('settings.membersTitle', { defaultValue: 'Usuários e permissões' })}
        </h2>
        <MonoLabel>
          {`${memberCount} ${memberCount === 1 ? 'MEMBRO' : 'MEMBROS'}`}
        </MonoLabel>
      </div>

      {members.isLoading ? (
        <Skeleton className="h-32" />
      ) : memberList.length === 0 ? (
        <p className="py-8 text-center text-sm text-[color:var(--ink-secondary)]">
          {t('settings.membersEmpty')}
        </p>
      ) : (
        <div className="divide-y divide-[color:var(--border-default)]">
          {memberList.map((member: OrgMember, index) => {
            const isOwner = member.role === Role.OWNER;
            return (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                      isOwner || index === 0 ? 'bg-[#2563EB]' : 'bg-[#E2EDF7] text-[#263541] dark:bg-slate-700 dark:text-slate-100',
                    )}
                  >
                    {initials(member.user.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                      {member.user.name}
                    </p>
                    <p className="truncate text-xs text-[color:var(--ink-secondary)]">{member.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {manage && googleConnectedUserIds.has(member.user.id) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(t('googleConnection.revokeConfirm'))) {
                          revokeGoogle.mutate(member.user.id);
                        }
                      }}
                    >
                      {t('googleConnection.revoke')}
                    </Button>
                  ) : null}

                  {manage && member.user.id !== user?.id ? (
                    <>
                      <Select
                        value={member.role}
                        aria-label={t('settings.memberRole')}
                        className="w-36 rounded-xl"
                        onChange={(event) =>
                          updateRole.mutate({
                            memberId: member.id,
                            role: event.target.value as Role,
                          })
                        }
                      >
                        {MEMBER_ROLES.map((value) => (
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
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  ) : (
                    <Badge tone={member.role === 'OWNER' ? 'brand' : 'slate'} className="rounded-xl px-3 py-1">
                      {t(`settings.roles.${member.role}`, { defaultValue: member.role })}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline invite section matching 06-configuracoes.png */}
      {manage ? (
        <div className="pt-4 border-t border-[color:var(--border-default)] space-y-2">
          <MonoLabel>CONVIDAR MEMBRO</MonoLabel>
          <form
            className="flex flex-col sm:flex-row gap-3 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              setInviteOpen(true);
            }}
          >
            <input
              type="email"
              placeholder="email@empresa.com.br"
              value={quickInviteEmail}
              onChange={(e) => setQuickInviteEmail(e.target.value)}
              className="flex-1 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            />
            <Button
              type="submit"
              disabled={!emailVerified}
              className="rounded-full px-7 py-2.5 shadow-soft"
            >
              Convidar
            </Button>
          </form>
        </div>
      ) : null}
    </section>
  );

  return (
    <SettingsShell
      active={tab}
      showIntegrations={manage}
      headerTitle="Configurações"
      headerDescription="Perfil, organização, equipe e preferências."
    >
      {/* Tab: Organização (Default Hub View matching 06-configuracoes.png) */}
      {tab === 'organization' && (
        <div className="space-y-6">
          {renderOrganizationCard()}
          {renderTeamCard()}
        </div>
      )}

      {/* Tab: Usuários e permissões (Direct Team Tab) */}
      {tab === 'team' && (
        <div className="space-y-6">
          {renderTeamCard()}
        </div>
      )}

      {/* Tab: Perfil (Account Tab) */}
      {tab === 'account' && (
        <div className="space-y-6">
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-6">
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              {t('settings.profileTitle')}
            </h2>
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3 sm:w-40">
                <div
                  className={cn(
                    'flex h-24 w-24 items-center justify-center overflow-hidden rounded-full',
                    'border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] text-xl font-semibold text-[color:var(--ink)]',
                  )}
                >
                  {safeAvatarPreview ? (
                    <img src={safeAvatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(name || user?.name || '?')
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-1.5" />
                  {t('settings.changePhoto')}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void onPickAvatar(event.target.files?.[0])}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <Input
                  id="profile-name"
                  name="profile-name"
                  label={t('settings.memberName')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  leadingIcon={<User className="h-4 w-4" />}
                />
                <Input
                  id="profile-email"
                  name="profile-email"
                  label={t('auth.email')}
                  value={user?.email ?? ''}
                  disabled
                  readOnly
                  leadingIcon={<Mail className="h-4 w-4" />}
                />
              </div>
            </div>
            {profileMessage ? <Alert tone="success">{profileMessage}</Alert> : null}
            {profileError ? <Alert tone="error">{profileError}</Alert> : null}
            <div className="flex justify-end pt-2">
              <Button
                className="rounded-full px-6 py-2.5 shadow-soft"
                loading={saveProfile.isPending}
                disabled={!profileDirty}
                onClick={() => saveProfile.mutate()}
              >
                {t('common.save')}
              </Button>
            </div>
          </section>

          {/* Change email section */}
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              {t('settings.emailTitle')}
            </h2>
            <p className="text-sm text-[color:var(--ink-secondary)]">
              {emailVerified ? t('settings.emailVerified') : t('settings.emailUnverified')}
              {user?.email ? ` · ${user.email}` : null}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="new-email"
                name="new-email"
                label={t('settings.emailNew')}
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                autoComplete="email"
                leadingIcon={<Mail className="h-4 w-4" />}
              />
              <Input
                id="email-password"
                name="email-password"
                label={t('settings.emailCurrentPassword')}
                type="password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
                autoComplete="current-password"
                leadingIcon={<Lock className="h-4 w-4" />}
              />
            </div>
            {emailMessage ? <Alert tone="success">{emailMessage}</Alert> : null}
            {emailError ? <Alert tone="error">{emailError}</Alert> : null}
            <div className="flex justify-end pt-2">
              <Button
                className="rounded-full px-6 py-2.5 shadow-soft"
                loading={changeEmailMutation.isPending}
                disabled={!newEmail.trim() || !emailPassword}
                onClick={() => changeEmailMutation.mutate()}
              >
                {t('settings.emailChangeSubmit')}
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Preferências */}
      {tab === 'preferences' && (
        <div className="space-y-6">
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              {t('settings.preferencesTitle')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="pref-locale"
                name="pref-locale"
                label={t('auth.language')}
                value={locale}
                onChange={(event) => setLocale(event.target.value as AppLocale)}
                leadingIcon={<Globe className="h-4 w-4" />}
              >
                <option value="pt">{t('auth.languagePt')}</option>
                <option value="en">{t('auth.languageEn')}</option>
              </Select>
              <Select
                id="persona-override"
                name="persona-override"
                label={t('persona.override')}
                value={overrideValue}
                disabled={!canMutatePersona}
                onChange={(event) => setOverrideValue(event.target.value)}
              >
                <option value="">{t('persona.followOrg')}</option>
                {PROFESSIONAL_PERSONAS.map((value) => (
                  <option key={value} value={value}>
                    {t(`persona.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            {canMutatePersona ? (
              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-full px-6 py-2.5 shadow-soft"
                  loading={saveOverride.isPending}
                  disabled={overrideValue === (user?.personaOverride ?? '')}
                  onClick={() => saveOverride.mutate()}
                >
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[color:var(--ink-secondary)]">{t('persona.readOnly')}</p>
            )}
          </section>
        </div>
      )}

      {/* Tab: Pontuação */}
      {tab === 'scoring' && (
        <div className="space-y-6">
          <OrganizationFlagsCard canManage={manage} emailVerified={emailVerified} />
        </div>
      )}

      {/* Tab: Integrações */}
      {tab === 'integrations' && (
        <div className="space-y-6">
          <IntegrationsSettingsCard canManage={manage} />
          <GoogleConnectionSettingsCard role={user?.role} />
        </div>
      )}

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </SettingsShell>
  );
}
