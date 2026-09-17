import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { AuthShell } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { fetchAuthorizableOrgs, submitOauthConsent } from '@/features/oauth/api';
import { assignOauthClientRedirect } from '@/lib/safe-url';

function readQuery(params: URLSearchParams) {
  return {
    client_id: params.get('client_id') ?? '',
    redirect_uri: params.get('redirect_uri') ?? '',
    code_challenge: params.get('code_challenge') ?? '',
    code_challenge_method: params.get('code_challenge_method') ?? 'S256',
    resource: params.get('resource') ?? '',
    scope: params.get('scope') ?? undefined,
    state: params.get('state') ?? undefined,
  };
}

export function OauthConsentPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const query = useMemo(() => readQuery(params), [params]);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orgs = useQuery({
    queryKey: ['oauth-authorizable-orgs'],
    queryFn: fetchAuthorizableOrgs,
  });

  const selectedId = organizationId || orgs.data?.[0]?.id || '';

  const consent = useMutation({
    mutationFn: (decision: 'allow' | 'deny') =>
      submitOauthConsent({
        ...query,
        organizationId: selectedId || undefined,
        decision,
      }),
    onSuccess: (result) => {
      assignOauthClientRedirect(result.redirect, query.redirect_uri);
    },
    onError: () => setError(t('oauth.consentError')),
  });

  const missingParams = !query.client_id || !query.redirect_uri || !query.code_challenge;
  const canAllow = Boolean(selectedId) && !missingParams && !consent.isPending;

  return (
    <AuthShell title={t('oauth.consentTitle')} subtitle={t('oauth.consentSubtitle')}>
      {missingParams ? (
        <Alert tone="error">{t('oauth.missingParams')}</Alert>
      ) : (
        <div className="space-y-4">
          {orgs.isLoading ? <p className="text-sm text-[color:var(--ink-muted)]">{t('common.loading')}</p> : null}
          {orgs.data && orgs.data.length === 0 ? (
            <Alert tone="warning">{t('oauth.noOrgs')}</Alert>
          ) : null}
          {orgs.data && orgs.data.length > 0 ? (
            <Select
              id="oauth-org"
              name="organizationId"
              label={t('oauth.chooseOrg')}
              value={selectedId}
              onChange={(event) => setOrganizationId(event.target.value)}
            >
              {orgs.data.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!canAllow}
              loading={consent.isPending && consent.variables === 'allow'}
              onClick={() => consent.mutate('allow')}
            >
              {t('oauth.allow')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!query.redirect_uri || consent.isPending}
              loading={consent.isPending && consent.variables === 'deny'}
              onClick={() => consent.mutate('deny')}
            >
              {t('oauth.deny')}
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
