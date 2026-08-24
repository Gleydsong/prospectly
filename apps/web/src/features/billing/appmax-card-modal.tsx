import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { getApiErrorMessage } from '@/lib/api';
import type { AuthUser } from '@/types';

import { createAppmaxCardCheckout, getAppmaxCardConfig } from './api';
import { tokenizeWithAppmax } from './appmax-js';
import { handleCheckoutResult } from './handle-checkout';
import type { CreditOffer } from './types';

type CardOffer = CreditOffer | 'unlimited';

export function AppmaxCardModal({
  open,
  offer,
  user,
  baselineCreditBalance,
  onClose,
}: {
  open: boolean;
  offer: CardOffer | null;
  user: AuthUser;
  baselineCreditBalance: number;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [tokenizing, setTokenizing] = useState(false);
  const checkoutKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (open) checkoutKey.current = crypto.randomUUID();
  }, [open, offer]);
  const config = useQuery({
    queryKey: ['billing', 'appmax-config'],
    queryFn: getAppmaxCardConfig,
    enabled: open,
    staleTime: 30 * 60 * 1000,
  });
  const names = useMemo(() => {
    const [firstName = '', ...rest] = user.name.trim().split(/\s+/);
    return { firstName, lastName: rest.join(' ') };
  }, [user.name]);

  const checkout = useMutation({
    mutationFn: createAppmaxCardCheckout,
    onSuccess: (result) => {
      if (!offer) return;
      handleCheckoutResult(result, {
        purpose: offer === 'unlimited' ? 'plan' : 'credits',
        ...(offer === 'unlimited' ? { plan: 'monthly' as const } : { offer }),
        baselineCreditBalance,
      });
    },
    onError: (cause) => setError(getApiErrorMessage(cause)),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!offer || !config.data) return;
    if (tokenizing || checkout.isPending) return;
    setError(null);
    setTokenizing(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const card = await tokenizeWithAppmax(config.data.externalId, config.data.scriptUrl);
      checkout.mutate({
        checkoutKey: checkoutKey.current,
        purpose: offer === 'unlimited' ? 'monthly' : 'credits',
        ...(offer === 'unlimited' ? {} : { offer }),
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        phone: String(data.get('phone') ?? '').replace(/\D/g, ''),
        email: user.email,
        ip: card.ip,
        cardToken: card.token,
        documentNumber: String(data.get('documentNumber') ?? '').replace(/\D/g, ''),
        holderName: String(data.get('holderName') ?? ''),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível tokenizar o cartão.');
    } finally {
      setTokenizing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pagamento seguro com cartão">
      <form data-appmax-checkout onSubmit={submit} className="space-y-4" autoComplete="on">
        <p className="text-sm text-[color:var(--ink-muted)]">
          Os dados do cartão são enviados diretamente à Appmax e não passam pelos servidores da
          Prospectly.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            name="firstName"
            label="Nome"
            defaultValue={names.firstName}
            required
            maxLength={80}
          />
          <Input
            name="lastName"
            label="Sobrenome"
            defaultValue={names.lastName}
            required
            maxLength={120}
          />
        </div>
        <Input name="phone" label="Telefone com DDD" inputMode="tel" required maxLength={15} />
        <Input
          name="documentNumber"
          label="CPF/CNPJ do titular"
          inputMode="numeric"
          required
          maxLength={18}
        />
        <Input
          name="cardNumber"
          label="Número do cartão"
          inputMode="numeric"
          autoComplete="cc-number"
          appmax-form-element="number"
          required
        />
        <Input
          name="holderName"
          label="Nome impresso no cartão"
          autoComplete="cc-name"
          appmax-form-element="holder_name"
          required
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            name="expirationMonth"
            label="Mês"
            inputMode="numeric"
            autoComplete="cc-exp-month"
            appmax-form-element="expiration_month"
            required
            maxLength={2}
          />
          <Input
            name="expirationYear"
            label="Ano"
            inputMode="numeric"
            autoComplete="cc-exp-year"
            appmax-form-element="expiration_year"
            required
            maxLength={4}
          />
          <Input
            name="cvv"
            label="CVV"
            inputMode="numeric"
            autoComplete="cc-csc"
            appmax-form-element="cvv"
            required
            maxLength={4}
          />
        </div>
        {error || config.error ? (
          <p
            className="rounded-control border border-red-300 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error ?? 'Não foi possível carregar o checkout Appmax.'}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={tokenizing || checkout.isPending}
            disabled={!config.data || tokenizing || checkout.isPending}
          >
            Pagar com cartão
          </Button>
        </div>
      </form>
    </Modal>
  );
}
