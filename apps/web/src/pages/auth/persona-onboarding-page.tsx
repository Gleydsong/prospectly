import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { updateOrganizationPersona } from '@/features/organizations/api';
import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '@/features/organizations/professional-persona';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

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

  return (
    <AuthShell title={t('persona.onboardingTitle')} subtitle={t('persona.onboardingSubtitle')}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (defaultPersona === 'outro' && otherLabel.trim().length < 2) {
            setError(t('persona.otherLabelRequired'));
            return;
          }
          setError(null);
          save.mutate();
        }}
      >
        <Select
          label={t('persona.label')}
          value={defaultPersona}
          onChange={(event) => {
            const next = event.target.value as ProfessionalPersona;
            setDefaultPersona(next);
            if (next !== 'outro') setOtherLabel('');
          }}
        >
          {PROFESSIONAL_PERSONAS.map((value) => (
            <option key={value} value={value}>
              {t(`persona.${value}`)}
            </option>
          ))}
        </Select>
        {defaultPersona === 'outro' ? (
          <Input
            label={t('persona.otherLabel')}
            placeholder={t('persona.otherLabelPlaceholder')}
            value={otherLabel}
            maxLength={40}
            onChange={(event) => setOtherLabel(event.target.value)}
          />
        ) : null}
        {error ? (
          <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={save.isPending}>
          {t('persona.continue')}
        </Button>
      </form>
    </AuthShell>
  );
}
