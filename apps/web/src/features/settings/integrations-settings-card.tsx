import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  createPluginToken,
  fetchPluginTokens,
  revokePluginToken,
  upsertWebhookIntegration,
} from '@/features/integrations/api';
import { getApiErrorMessage } from '@/lib/api';

export function IntegrationsSettingsCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pluginName, setPluginName] = useState('Meu agente de prospecção');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const tokens = useQuery({
    queryKey: ['plugin-tokens'],
    queryFn: fetchPluginTokens,
    enabled: canManage,
  });

  const createToken = useMutation({
    mutationFn: () => createPluginToken(pluginName),
    onSuccess: async (data) => {
      setGeneratedToken(data.token);
      setPluginError(null);
      await queryClient.invalidateQueries({ queryKey: ['plugin-tokens'] });
    },
    onError: () => setPluginError(t('settings.pluginKeyError')),
  });

  useEffect(() => {
    if (!generatedToken) return undefined;
    const timeout = window.setTimeout(() => {
      setGeneratedToken(null);
      setCopied(false);
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [generatedToken]);

  const revokeToken = useMutation({
    mutationFn: revokePluginToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugin-tokens'] }),
  });

  const saveWebhook = useMutation({
    mutationFn: () =>
      upsertWebhookIntegration({ url: url.trim(), label: label.trim() || undefined, enabled }),
    onSuccess: () => {
      setWebhookMessage(t('settings.webhookSaved'));
      setWebhookError(null);
    },
    onError: (err) => {
      setWebhookMessage(null);
      setWebhookError(getApiErrorMessage(err) || t('settings.webhookError'));
    },
  });

  if (!canManage) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          className="px-6 py-5 sm:px-8"
          title={t('settings.pluginsTitle')}
          description={t('settings.pluginsDesc')}
        />
        <CardContent className="space-y-5 px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Cursor', t('settings.pluginCursor')],
              ['Codex', t('settings.pluginCodex')],
              ['Notion', t('settings.pluginNotion')],
              [t('settings.pluginAgents'), t('settings.pluginAgentsDesc')],
            ].map(([name, description]) => (
              <div
                key={name}
                className="rounded-panel border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4"
              >
                <p className="text-sm font-semibold text-[color:var(--ink)]">{name}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--ink-muted)]">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-panel border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                id="plugin-name"
                name="plugin-name"
                className="min-w-[min(100%,22rem)] flex-1"
                label={t('settings.pluginName')}
                value={pluginName}
                onChange={(event) => setPluginName(event.target.value)}
                maxLength={80}
              />
              <Button
                type="button"
                loading={createToken.isPending}
                disabled={!pluginName.trim()}
                onClick={() => createToken.mutate()}
              >
                {t('settings.generatePluginKey')}
              </Button>
            </div>
            {pluginError ? (
              <Alert tone="error" className="mt-3">
                {pluginError}
              </Alert>
            ) : null}
            {generatedToken ? (
              <Alert tone="warning" title={t('settings.pluginKeyCreated')} className="mt-4">
                <p>{t('settings.pluginKeyWarning')}</p>
                <div className="mt-3 flex gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-control bg-[color:var(--surface-card)] px-3 py-2 text-xs text-[color:var(--ink)]">
                    {generatedToken}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard.writeText(generatedToken).then(() => setCopied(true))
                    }
                  >
                    {copied ? t('settings.copied') : t('settings.copyPluginKey')}
                  </Button>
                </div>
              </Alert>
            ) : null}
            {!tokens.isLoading && tokens.data?.length ? (
              <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-[color:var(--border)] pt-2">
                {tokens.data.map((token) => (
                  <li
                    key={token.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span className="text-[color:var(--ink)]">
                      {token.name}{' '}
                      <code className="text-xs text-[color:var(--ink-muted)]">
                        {token.tokenPrefix}
                      </code>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeToken.mutate(token.id)}
                    >
                      {t('settings.revokePluginKey')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="px-6 py-5 sm:px-8"
          title={t('settings.webhookSection')}
          description={t('settings.integrationsDesc')}
        />
        <CardContent className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
          <Input
            id="webhook-url"
            name="webhook-url"
            label={t('settings.webhookUrl')}
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://hooks.example.com/prospectly"
          />
          <Input
            id="webhook-label"
            name="webhook-label"
            label={t('settings.webhookLabel')}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
          />
          <Switch
            id="webhook-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            label={enabled ? t('settings.webhookEnabled') : t('settings.webhookDisabled')}
          />
          {webhookMessage ? <Alert tone="success">{webhookMessage}</Alert> : null}
          {webhookError ? <Alert tone="error">{webhookError}</Alert> : null}
          <Button
            type="button"
            loading={saveWebhook.isPending}
            disabled={!url.trim()}
            onClick={() => saveWebhook.mutate()}
          >
            {t('settings.webhookSave')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
