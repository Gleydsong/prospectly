import { ArrowLeftRight, Check, X } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { AuthShell } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MonoLabel } from '@/components/ui/mono-label';
import { fetchAuthorizableOrgs, submitOauthConsent } from '@/features/oauth/api';
import { assignOauthClientRedirect } from '@/lib/safe-url';
import { cn } from '@/lib/utils';

function readQuery(params: URLSearchParams) {
  return {
    client_id: params.get('client_id') ?? '',
    client_name: params.get('client_name') ?? '',
    redirect_uri: params.get('redirect_uri') ?? '',
    code_challenge: params.get('code_challenge') ?? '',
    code_challenge_method: params.get('code_challenge_method') ?? 'S256',
    resource: params.get('resource') ?? '',
    scope: params.get('scope') ?? undefined,
    state: params.get('state') ?? undefined,
  };
}

/**
 * OauthConsentPage — Tela de consentimento de ligação MCP fiel a 03-acesso-oauth-mcp.png.
 */
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

  const clientDisplayName = useMemo(() => {
    if (query.client_name && query.client_id) {
      return `${query.client_name} (${query.client_id}) ${t('oauth.mcpClientSuffix')}`;
    }
    if (query.client_name) {
      return `${query.client_name} ${t('oauth.mcpClientSuffix')}`;
    }
    if (query.client_id) {
      return `${query.client_id} ${t('oauth.mcpClientSuffix')}`;
    }
    return t('oauth.defaultClientName');
  }, [query.client_name, query.client_id, t]);

  return (
    <AuthShell
      title={t('oauth.consentTitle')}
      subtitle={t('oauth.consentSubtitle')}
      panelTitle={t('auth.panelTitleOauth', 'Conecte sua IA com segurança.')}
      panelEyebrow={t('auth.panelEyebrow')}
      panelDescription={t(
        'auth.panelDescriptionOauth',
        'Autorize agentes externos a consultarem seus dados com escopos restritos e somente leitura.',
      )}
      leftSphereVariant="sinal"
      rightSphereVariant="lima"
    >
      {/* Conexão visual: P. ⇄ MCP */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-base font-black text-[color:var(--ink)] shadow-sm"
        >
          P<span className="text-[color:var(--brand)]">.</span>
        </div>
        <ArrowLeftRight className="h-4 w-4 text-[color:var(--ink-muted)]" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="flex h-10 px-3 items-center justify-center rounded-[14px] border border-[#1c2a42] bg-[#0b1220] font-mono text-xs font-bold text-[#d4f56a] shadow-sm tracking-wider"
        >
          MCP
        </div>
      </div>

      {missingParams ? (
        <Alert tone="error">{t('oauth.missingParams')}</Alert>
      ) : (
        <div className="space-y-6">
          {/* Bloco Agente */}
          <div className="space-y-1">
            <MonoLabel>{t('oauth.agentLabel')}</MonoLabel>
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {clientDisplayName}
            </p>
          </div>

          {/* Bloco Organização */}
          <div className="space-y-2">
            <MonoLabel>{t('oauth.orgLabel')}</MonoLabel>

            {orgs.isLoading ? (
              <p className="text-sm text-[color:var(--ink-muted)]">{t('common.loading')}</p>
            ) : null}

            {orgs.data && orgs.data.length === 0 ? (
              <Alert tone="warning">{t('oauth.noOrgs')}</Alert>
            ) : null}

            {/* Seletor nativo acessível/para testes */}
            {orgs.data && orgs.data.length > 0 ? (
              <>
                <select
                  id="oauth-org"
                  name="organizationId"
                  aria-label={t('oauth.chooseOrg')}
                  value={selectedId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  className="sr-only"
                >
                  {orgs.data.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                {/* Cartões visuais das organizações */}
                <div className="space-y-2.5" role="radiogroup" aria-label={t('oauth.chooseOrg')}>
                  {orgs.data.map((org) => {
                    const isSelected = org.id === selectedId;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setOrganizationId(org.id)}
                        className={cn(
                          'flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-all duration-150',
                          isSelected
                            ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)]/10 ring-2 ring-[color:var(--brand)] shadow-sm'
                            : 'border-[color:var(--border-default)] bg-[color:var(--bg-surface)] hover:border-[color:var(--border-strong)]',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                            isSelected
                              ? 'border-[color:var(--brand)] bg-transparent'
                              : 'border-[color:var(--border-strong)] bg-transparent',
                          )}
                        >
                          {isSelected ? (
                            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand)]" />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[color:var(--ink)] truncate">
                            {org.name}
                          </p>
                          <p className="text-xs text-[color:var(--ink-secondary)]">
                            {org.role === 'OWNER' ? t('oauth.roleOwner') : t('oauth.roleAdmin')}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          {/* Bloco Permissões */}
          <div className="space-y-2.5 border-t border-[color:var(--border-default)] pt-5">
            <MonoLabel>{t('oauth.agentCanLabel')}</MonoLabel>
            {/* Espelha as ferramentas somente leitura do servidor MCP (apps/api/src/modules/mcp) */}
            <ul className="space-y-2 text-xs text-[color:var(--ink-secondary)]">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[color:var(--brand)] shrink-0" aria-hidden="true" />
                <span>{t('oauth.scopeSummary')}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[color:var(--brand)] shrink-0" aria-hidden="true" />
                <span>{t('oauth.scopeLeads')}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[color:var(--brand)] shrink-0" aria-hidden="true" />
                <span>{t('oauth.scopeSearches')}</span>
              </li>
              <li className="flex items-center gap-2 text-[color:var(--status-danger-ink)]">
                <X className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                <span>{t('oauth.scopeRestriction')}</span>
              </li>
              <li className="flex items-center gap-2 text-[color:var(--status-danger-ink)]">
                <X className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                <span>{t('oauth.scopeContacts')}</span>
              </li>
            </ul>
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary-outline"
              className="flex-1 text-sm font-semibold"
              disabled={!query.redirect_uri || consent.isPending}
              loading={consent.isPending && consent.variables === 'deny'}
              onClick={() => consent.mutate('deny')}
            >
              {t('oauth.deny')}
            </Button>
            <Button
              type="button"
              variant="primary-tinta"
              className="flex-1 text-sm font-semibold shadow-md"
              disabled={!canAllow}
              loading={consent.isPending && consent.variables === 'allow'}
              onClick={() => consent.mutate('allow')}
            >
              {t('oauth.allow')}
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
