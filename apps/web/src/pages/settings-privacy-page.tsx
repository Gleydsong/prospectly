import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SignalRing } from '@/components/ui/signal-ring';
import { Switch } from '@/components/ui/switch';
import { deletePrivacyAccount, downloadPrivacyExport, logout } from '@/features/auth/api';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { SettingsShell } from '@/features/settings/settings-shell';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function SettingsPrivacyPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const emailVerified = Boolean(user?.emailVerifiedAt);

  // AI Processor toggle states
  const [cloudflareEnabled, setCloudflareEnabled] = useState(true);
  const [groqEnabled, setGroqEnabled] = useState(false);
  const [layaEnabled, setLayaEnabled] = useState(true);

  // Modals & messages
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [lgpdOpen, setLgpdOpen] = useState(false);
  const [dsrMessage, setDsrMessage] = useState<string | null>(null);

  const confirmWord = i18n.language.startsWith('en') ? 'DELETE' : 'EXCLUIR';

  const exportData = useMutation({
    mutationFn: () => downloadPrivacyExport(),
    onSuccess: () => setDsrMessage(t('settings.exportSuccess', { defaultValue: 'Exportação gerada com sucesso.' })),
    onError: (err) => setDsrMessage(getApiErrorMessage(err)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => deletePrivacyAccount(),
    onSuccess: async () => {
      setDsrMessage(t('settings.deleteSuccess', { defaultValue: 'Conta excluída com sucesso.' }));
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
      if (msg === 'EMAIL_NOT_VERIFIED') {
        setDsrMessage(t('settings.emailGateHint'));
        return;
      }
      if (msg.includes('LAST_OWNER_CANNOT_SELF_DELETE')) {
        setDsrMessage(t('settings.deleteLastOwner'));
        return;
      }
      setDsrMessage(msg);
    },
  });

  return (
    <SettingsShell
      active="privacy"
      showIntegrations={canManageOrg(user?.role)}
      breadcrumb="CONFIGURAÇÕES / PRIVACIDADE"
      headerTitle="Privacidade"
      headerDescription="Quais dados saem do Prospectly, para onde e por quê."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left Column: Processadores de IA */}
        <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card">
          <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
            Processadores de IA
          </h2>

          <div className="mt-6 divide-y divide-[color:var(--border-default)]">
            {/* Processor 1: Cloudflare Workers AI */}
            <div className="py-6 first:pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-[color:var(--ink)]">
                    Cloudflare Workers AI
                  </span>
                  <Badge tone="brand" className="bg-[#B9D8EF]/40 text-[#2563EB] border-transparent font-medium text-xs">
                    Principal
                  </Badge>
                </div>
                <Switch
                  checked={cloudflareEnabled}
                  onCheckedChange={setCloudflareEnabled}
                  label=""
                  aria-label="Ativar Cloudflare Workers AI"
                  id="switch-cf-ai"
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
                Campos do cliente usados para gerar mensagens e sugestões. Treino e retenção: confirmar em DPA/contrato.
              </p>
            </div>

            {/* Processor 2: Groq */}
            <div className="py-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-[color:var(--ink)]">
                    Groq
                  </span>
                  <Badge tone="slate" className="bg-[#E0E7FF] text-[#4F46E5] border-transparent font-medium text-xs">
                    Reserva
                  </Badge>
                </div>
                <Switch
                  checked={groqEnabled}
                  onCheckedChange={setGroqEnabled}
                  label=""
                  aria-label="Ativar Groq"
                  id="switch-groq"
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
                Usado só quando o principal falha, com os mesmos campos.
              </p>
            </div>

            {/* Processor 3: Laya */}
            <div className="py-6 last:pb-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-[color:var(--ink)]">
                    Laya
                  </span>
                  <Badge tone="lima" className="bg-[#D4F56A]/30 text-[#4D660A] border-transparent font-medium text-xs">
                    Interno
                  </Badge>
                </div>
                <Switch
                  checked={layaEnabled}
                  onCheckedChange={setLayaEnabled}
                  label=""
                  aria-label="Ativar Laya"
                  id="switch-laya"
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
                Classificação do SDR. Roda no nosso servidor; nada sai para terceiros.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Seus dados & Banner */}
        <div className="space-y-6">
          {/* Card Seus dados */}
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card">
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              Seus dados
            </h2>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => exportData.mutate()}
                disabled={exportData.isPending || !emailVerified}
                className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--bg-subtle)] px-4 py-3.5 text-sm font-medium text-[color:var(--ink)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
              >
                <span>Exportar dados da organização</span>
                <span className="text-base font-normal text-[color:var(--ink-secondary)]">→</span>
              </button>

              <button
                type="button"
                onClick={() => setLgpdOpen(true)}
                className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--bg-subtle)] px-4 py-3.5 text-sm font-medium text-[color:var(--ink)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <span>Pedido de acesso (LGPD)</span>
                <span className="text-base font-normal text-[color:var(--ink-secondary)]">→</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={!emailVerified}
                className="flex w-full items-center justify-between rounded-2xl bg-red-500/10 px-4 py-3.5 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
              >
                <span>Apagar conta</span>
                <span className="text-base font-normal">→</span>
              </button>
            </div>

            {!emailVerified ? (
              <div className="mt-4">
                <Alert tone="warning">{t('settings.emailGateHint')}</Alert>
              </div>
            ) : null}
            {dsrMessage ? (
              <div className="mt-4">
                <Alert tone="info">{dsrMessage}</Alert>
              </div>
            ) : null}
          </section>

          {/* Dark Card Banner */}
          <section className="relative overflow-hidden rounded-panel bg-[#0B1220] p-6 sm:p-8 text-white shadow-card">
            <div className="mb-6 flex justify-center">
              <SignalRing size={110} glow />
            </div>
            <h3 className="font-display text-2xl font-extrabold tracking-tight text-white leading-snug">
              Nada é enviado sem o seu clique.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Mensagens, ligações e e-mails sempre passam por você.
            </p>
          </section>
        </div>
      </div>

      {/* LGPD Access Request Modal */}
      <Modal
        open={lgpdOpen}
        onClose={() => setLgpdOpen(false)}
        title="Pedido de acesso aos dados (LGPD)"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[color:var(--ink-secondary)]">
            Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você tem direito de acessar,
            confirmar e solicitar portabilidade de todos os dados pessoais mantidos pela sua organização.
          </p>
          <p className="text-sm leading-relaxed text-[color:var(--ink-secondary)]">
            Para solicitar o relatório completo ou exercer seus direitos de titular, utilize a exportação de dados acima ou entre em contato direto pelo suporte.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setLgpdOpen(false)}>
              {t('common.close', { defaultValue: 'Fechar' })}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('settings.deleteAccountTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--ink-secondary)]">{t('settings.deleteAccountBody')}</p>
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
    </SettingsShell>
  );
}
