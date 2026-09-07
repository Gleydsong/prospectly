import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Camera, Globe, Lock, Mail, Trash2, User, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { changeEmail, getProfile, updateProfile } from '@/features/auth/api';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { IntegrationsSettingsCard } from '@/features/settings/integrations-settings-card';
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
  type OrgMember,
} from '@/features/organizations/api';
import { setAppLocale } from '@/i18n';
import { compressAvatarFile } from '@/lib/compress-avatar';
import { getApiErrorMessage } from '@/lib/api';
import type { AppLocale } from '@/lib/locale';
import { sanitizeAvatarSrc } from '@/lib/safe-url';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

const MEMBER_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.SALES, Role.MEMBER, Role.VIEWER];

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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState(user?.organizationName ?? '');
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const manage = canManageOrg(user?.role);
  const emailVerified = Boolean(user?.emailVerifiedAt);
  const requestedTab = parseSettingsTab(searchParams.get('tab'));
  const tab = requestedTab === 'integrations' && !manage ? 'account' : requestedTab;

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
      setOrgError(msg === 'EMAIL_NOT_VERIFIED' ? t('settings.emailGateHint') : msg || t('settings.orgError'));
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
  const safeAvatarPreview = sanitizeAvatarSrc(avatarPreview);

  return (
    <SettingsShell active={tab} showIntegrations={manage}>
      <div className="space-y-6" hidden={tab !== 'account'}>
        <Card>
          <CardHeader
            className="px-6 py-5 sm:px-8"
            title={t('settings.profileTitle')}
            description={t('settings.profileDesc')}
          />
          <CardContent className="space-y-6 px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3 sm:w-40">
                <div
                  className={cn(
                    'flex h-24 w-24 items-center justify-center overflow-hidden rounded-full',
                    'border border-[color:var(--border)] bg-[color:var(--surface-hover)] text-xl font-semibold text-[color:var(--ink)]',
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
                  variant="glass"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
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
                  className="h-11"
                  label={t('settings.memberName')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  leadingIcon={<User className="h-4 w-4" />}
                />
                <Input
                  id="profile-email"
                  name="profile-email"
                  className="h-11"
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
            <div className="flex justify-end">
              <Button
                loading={saveProfile.isPending}
                disabled={!profileDirty}
                onClick={() => saveProfile.mutate()}
              >
                {t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            className="px-6 py-5 sm:px-8"
            title={t('settings.preferencesTitle')}
            description={t('settings.preferencesDesc')}
          />
          <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
            <Select
              id="profile-locale"
              name="profile-locale"
              className="h-11 max-w-md"
              label={t('auth.language')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as AppLocale)}
              leadingIcon={<Globe className="h-4 w-4" />}
            >
              <option value="pt">{t('auth.languagePt')}</option>
              <option value="en">{t('auth.languageEn')}</option>
            </Select>
            <div className="flex justify-end">
              <Button
                loading={saveProfile.isPending}
                disabled={!profileDirty}
                onClick={() => saveProfile.mutate()}
              >
                {t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            className="px-6 py-5 sm:px-8"
            title={t('settings.orgTitle')}
            description={t('settings.orgDesc')}
          />
          <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
            {orgQuery.isLoading ? (
              <Skeleton className="h-11" />
            ) : (
              <Input
                id="org-name"
                name="org-name"
                className="h-11 max-w-md"
                label={t('settings.orgName')}
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                disabled={!manage}
                maxLength={120}
                leadingIcon={<Building2 className="h-4 w-4" />}
              />
            )}
            {orgMessage ? <Alert tone="success">{orgMessage}</Alert> : null}
            {orgError ? <Alert tone="error">{orgError}</Alert> : null}
            {manage ? (
              <div className="flex justify-end">
                <Button
                  loading={saveOrg.isPending}
                  disabled={!orgDirty || !orgName.trim() || !emailVerified}
                  onClick={() => saveOrg.mutate()}
                >
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[color:var(--ink-muted)]">{t('settings.orgReadOnly')}</p>
            )}
            {manage && !emailVerified ? (
              <Alert tone="warning">{t('settings.emailGateHint')}</Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            className="px-6 py-5 sm:px-8"
            title={t('settings.emailTitle')}
            description={t('settings.emailDesc')}
          />
          <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8" id="email">
            <p className="text-sm text-[color:var(--ink-muted)]">
              {emailVerified ? t('settings.emailVerified') : t('settings.emailUnverified')}
              {user?.email ? ` · ${user.email}` : null}
            </p>
            <Input
              id="new-email"
              name="new-email"
              className="h-11"
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
              className="h-11"
              label={t('settings.emailCurrentPassword')}
              type="password"
              value={emailPassword}
              onChange={(event) => setEmailPassword(event.target.value)}
              autoComplete="current-password"
              leadingIcon={<Lock className="h-4 w-4" />}
            />
            {emailMessage ? <Alert tone="success">{emailMessage}</Alert> : null}
            {emailError ? <Alert tone="error">{emailError}</Alert> : null}
            <div className="flex justify-end">
              <Button
                loading={changeEmailMutation.isPending}
                disabled={!newEmail.trim() || !emailPassword}
                onClick={() => changeEmailMutation.mutate()}
              >
                {t('settings.emailChangeSubmit')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <GoogleConnectionSettingsCard role={user?.role} />
      </div>

      <div className="space-y-6" hidden={tab !== 'team'}>
        <Card>
          <CardHeader
            className="px-6 py-5 sm:px-8"
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
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
            {members.isLoading ? (
              <Skeleton className="h-32" />
            ) : (members.data ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-[color:var(--ink-muted)]">
                {t('settings.membersEmpty')}
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--border)]">
                {(members.data ?? []).map((member: OrgMember) => (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-hover)] text-xs font-semibold text-[color:var(--ink)]">
                        {initials(member.user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[color:var(--ink)]">
                          {member.user.name}
                        </p>
                        <p className="truncate text-xs text-[color:var(--ink-muted)]">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                            className="w-36"
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
      </div>

      <div hidden={tab !== 'integrations'}>
        <IntegrationsSettingsCard canManage={manage} />
      </div>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </SettingsShell>
  );
}
