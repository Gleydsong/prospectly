import { Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { GlossSphere, type GlossSphereVariant } from '@/components/ui/gloss-sphere';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SignalRing } from '@/components/ui/signal-ring';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { updateOrganizationPersona } from '@/features/organizations/api';
import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '@/features/organizations/professional-persona';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface PersonaCardConfig {
  key: ProfessionalPersona;
  sphereVariant: GlossSphereVariant;
}

const PERSONA_CONFIGS: PersonaCardConfig[] = [
  { key: 'vendedor', sphereVariant: 'azul' },
  { key: 'desenvolvedor', sphereVariant: 'tinta' },
  { key: 'trafego_pago', sphereVariant: 'lima' },
  { key: 'marketing', sphereVariant: 'sinal' },
  { key: 'outro', sphereVariant: 'azul' },
];

/**
 * PersonaOnboardingPage — Tela de onboarding da persona da organização fiel a 03-acesso-onboarding-persona.png.
 */
export function PersonaOnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [defaultPersona, setDefaultPersona] = useState<ProfessionalPersona>(
    user?.defaultPersona ?? 'vendedor',
  );
  const [otherLabel, setOtherLabel] = useState(user?.personaOtherLabel ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateOrganizationPersona({
        defaultPersona,
        personaOtherLabel: defaultPersona === 'outro' ? otherLabel.trim() : null,
      }),
    onSuccess: (data) => {
      updateUser({
        defaultPersona: data.defaultPersona,
        personaOtherLabel: data.personaOtherLabel,
        effectivePersona: user?.personaOverride ?? data.defaultPersona,
        personaOnboardedAt: data.personaOnboardedAt,
      });
      navigate('/', { replace: true });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (user?.role !== 'OWNER' || user.personaOnboardedAt) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (defaultPersona === 'outro' && otherLabel.trim().length < 2) {
      setError(t('persona.otherLabelRequired'));
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <div className="relative min-h-[100dvh] bg-[color:var(--bg-app)] text-[color:var(--ink)] flex flex-col justify-between p-6 sm:p-10">
      {/* Barra superior de navegação do onboarding */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--ink)] text-sm font-black text-[color:var(--bg-app)] shadow-sm"
          >
            P.
          </span>
          <span className="font-display text-base font-bold tracking-tight text-[color:var(--ink)]">
            Prospectly
          </span>
        </div>

        <ThemeToggle />
      </header>

      {/* Conteúdo central */}
      <main className="my-auto py-8">
        <div className="mx-auto max-w-5xl text-center">
          <PageHeader
            title={t('persona.onboardingTitle')}
            description={t('persona.onboardingSubtitle')}
            className="mb-8 justify-center text-center [&>div]:mx-auto"
          />

          <form onSubmit={handleSubmit}>
            {/* Select oculto para acessibilidade e testes */}
            <select
              aria-label={t('persona.label')}
              value={defaultPersona}
              onChange={(e) => {
                const next = e.target.value as ProfessionalPersona;
                setDefaultPersona(next);
                if (next !== 'outro') setOtherLabel('');
              }}
              className="sr-only"
            >
              {PROFESSIONAL_PERSONAS.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>

            {/* Grid dos 5 cards de persona */}
            <div
              role="radiogroup"
              aria-label="Opções"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              {PERSONA_CONFIGS.map(({ key, sphereVariant }) => {
                const isSelected = defaultPersona === key;
                const isOutro = key === 'outro';

                return (
                  <div
                    key={key}
                    role="radio"
                    tabIndex={0}
                    aria-checked={isSelected}
                    onClick={() => {
                      setDefaultPersona(key);
                      if (!isOutro) setOtherLabel('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setDefaultPersona(key);
                        if (!isOutro) setOtherLabel('');
                      }
                    }}
                    className={cn(
                      'group flex flex-col justify-between rounded-[22px] border bg-[color:var(--bg-surface)] p-4 text-left transition-all duration-200 cursor-pointer select-none',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
                      isSelected
                        ? 'border-[color:var(--brand)] ring-2 ring-[color:var(--brand)] shadow-lg'
                        : 'border-[color:var(--border-default)] hover:border-[color:var(--border-strong)] shadow-sm hover:shadow-md',
                    )}
                  >
                    {/* Poço visual superior */}
                    <div className="relative mb-4 flex h-32 items-center justify-center rounded-[16px] bg-[color:var(--bg-subtle)] p-2 overflow-hidden border border-[color:var(--border-default)]/60">
                      {!isOutro ? (
                        <div className="relative inline-flex items-center justify-center">
                          <SignalRing size={72} glow={isSelected} />
                          <div className="absolute -bottom-1 -right-1">
                            <GlossSphere variant={sphereVariant} size={28} />
                          </div>
                        </div>
                      ) : isSelected ? (
                        <div className="w-full px-2">
                          <Input
                            id="persona-other-input"
                            label={t('persona.otherLabel')}
                            placeholder={t('persona.otherLabelPlaceholder')}
                            value={otherLabel}
                            maxLength={40}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => setOtherLabel(e.target.value)}
                            className="text-xs h-9"
                          />
                        </div>
                      ) : (
                        <div className="w-full px-2">
                          <div className="flex h-9 w-full items-center rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-3 text-xs text-[color:var(--ink-muted)] shadow-inner">
                            {t('persona.otherLabelPlaceholder')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rótulo e descrição */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-bold text-[color:var(--ink)]">
                          {t(`persona.${key}`)}
                        </span>
                        {isSelected ? (
                          <span
                            aria-hidden="true"
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--brand)] text-white"
                          >
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[color:var(--ink-secondary)] leading-relaxed">
                        {t(`persona.${key}Desc`)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {error ? (
              <p
                className="mx-auto mt-4 max-w-md rounded-control bg-[color:var(--status-danger-bg)] p-3 text-sm text-[color:var(--status-danger-ink)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex justify-center">
              <Button
                type="submit"
                variant="primary-tinta"
                size="lg"
                className="px-10 text-base font-semibold shadow-xl"
                loading={save.isPending}
              >
                {t('persona.continue')}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <footer className="text-center text-xs text-[color:var(--ink-muted)]">
        Prospectly © 2026
      </footer>
    </div>
  );
}
