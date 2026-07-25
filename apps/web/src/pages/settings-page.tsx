import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { updateProfile } from '@/features/auth/api';
import { setAppLocale } from '@/i18n';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AppLocale } from '@/lib/locale';
import { useAuthStore } from '@/stores/auth.store';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}

export function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [locale, setLocale] = useState<AppLocale>((user?.locale as AppLocale) ?? 'pt');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: async () => {
      const { data } = await api.get<Member[]>('/organizations/members');
      return data;
    },
  });

  const saveLocale = useMutation({
    mutationFn: (next: AppLocale) => updateProfile({ locale: next }),
    onSuccess: async (data) => {
      updateUser({ locale: data.locale });
      await setAppLocale(data.locale);
      setMessage(t('settings.languageSaved'));
      setError(null);
    },
    onError: (err) => {
      setMessage(null);
      setError(getApiErrorMessage(err) || t('settings.languageError'));
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('settings.title')}</h1>
        <p className="text-sm text-zinc-500">{user?.organizationName}</p>
      </div>

      <Card>
        <CardHeader title={t('settings.languageTitle')} description={t('settings.languageDesc')} />
        <CardContent className="space-y-3">
          <Select
            label={t('auth.language')}
            value={locale}
            onChange={(event) => setLocale(event.target.value as AppLocale)}
          >
            <option value="pt">{t('auth.languagePt')}</option>
            <option value="en">{t('auth.languageEn')}</option>
          </Select>
          {message ? <p className="text-sm text-brand-700">{message}</p> : null}
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            loading={saveLocale.isPending}
            disabled={locale === (user?.locale ?? 'pt')}
            onClick={() => saveLocale.mutate(locale)}
          >
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.membersTitle')} description={t('settings.membersDesc')} />
        <CardContent>
          {members.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(members.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{member.user.name}</p>
                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                  <Badge tone={member.role === 'OWNER' ? 'brand' : 'slate'}>{member.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.scoringTitle')} description={t('settings.scoringDesc')} />
        <CardContent>
          <p className="text-sm text-zinc-500">{t('settings.scoringSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
