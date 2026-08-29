import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api';
import { getBillingProfile, updateBillingProfile } from './api';

const KEY = ['billing-profile'] as const;
const BILLING_PHONE_DIGITS = /^\d{10,11}$/;

function billingPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function isCompleteBillingPhone(value: string): boolean {
  return BILLING_PHONE_DIGITS.test(billingPhoneDigits(value));
}

function isBillingPhoneValidationMessage(message: string): boolean {
  return /phone must match/i.test(message) || /telefone com DDD/i.test(message);
}

export function BillingProfileForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: KEY, queryFn: getBillingProfile });
  const [form, setForm] = useState({ name: '', cpfCnpj: '', phone: '', email: '' });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) {
      setForm({
        name: profile.data.name,
        cpfCnpj: profile.data.cpfCnpj,
        phone: profile.data.phone,
        email: profile.data.email,
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: updateBillingProfile,
    onSuccess: (data) => {
      setPhoneError(null);
      queryClient.setQueryData(KEY, data);
    },
  });

  const apiMessage = save.isError ? getApiErrorMessage(save.error) : '';
  const phoneFieldError =
    phoneError ??
    (apiMessage && isBillingPhoneValidationMessage(apiMessage)
      ? t('settings.billingPhoneInvalid')
      : null);
  const formError = apiMessage && !phoneFieldError ? apiMessage : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isCompleteBillingPhone(form.phone)) {
      setPhoneError(t('settings.billingPhoneInvalid'));
      return;
    }
    setPhoneError(null);
    save.mutate(form);
  };

  return (
    <form className="rounded-panel border border-[color:var(--border)] p-4" onSubmit={submit}>
      <h2 className="text-base font-semibold text-[color:var(--ink)]">
        {t('settings.billingProfileTitle')}
      </h2>
      <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
        {t('settings.billingProfileDescription')}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input
          name="billingName"
          label={t('settings.billingName')}
          value={form.name}
          onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
          required
        />
        <Input
          name="billingDocument"
          label={t('settings.billingDocument')}
          value={form.cpfCnpj}
          onChange={(event) => setForm((value) => ({ ...value, cpfCnpj: event.target.value }))}
          required
        />
        <Input
          name="billingPhone"
          label={t('settings.billingPhone')}
          value={form.phone}
          inputMode="tel"
          autoComplete="tel"
          error={phoneFieldError ?? undefined}
          onChange={(event) => {
            setPhoneError(null);
            setForm((value) => ({ ...value, phone: event.target.value }));
          }}
          required
        />
        <Input
          name="billingEmail"
          type="email"
          label={t('settings.billingContactEmail')}
          value={form.email}
          onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
          required
        />
      </div>
      {formError ? (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {formError}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p className="mt-3 text-sm text-emerald-600" role="status">
          {t('settings.billingProfileSaved')}
        </p>
      ) : null}
      <Button className="mt-4" type="submit" loading={save.isPending}>
        {t('settings.billingProfileSave')}
      </Button>
    </form>
  );
}
