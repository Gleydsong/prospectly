import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createBillingPortal,
  createCheckoutSession,
  getBillingStatus,
  requestDataDeletion,
} from '@/features/auth/api';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const [billingError, setBillingError] = useState<string | null>(null);
  const [dsrMessage, setDsrMessage] = useState<string | null>(null);

  const planParam = searchParams.get('plan');
  const currencyParam = searchParams.get('currency');
  const defaultInterval =
    planParam === 'lifetime' || planParam === 'monthly' ? planParam : 'monthly';
  const defaultCurrency =
    currencyParam === 'BRL' || currencyParam === 'EUR' || currencyParam === 'USD'
      ? currencyParam
      : 'BRL';

  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: async () => {
      const { data } = await api.get<Member[]>('/organizations/members');
      return data;
    },
  });

  const billing = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
  });

  const checkout = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
    onError: (error) => setBillingError(getApiErrorMessage(error)),
  });

  const portal = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
    onError: (error) => setBillingError(getApiErrorMessage(error)),
  });

  const dsr = useMutation({
    mutationFn: () =>
      requestDataDeletion('Solicitação via app — exclusão de dados pessoais (LGPD)'),
    onSuccess: () => {
      setDsrMessage(
        'Solicitação registrada. Entraremos em contato em privacy@prospectly.dev para concluir a exclusão.',
      );
    },
    onError: (error) => setDsrMessage(getApiErrorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">{user?.organizationName}</p>
      </div>

      <Card>
        <CardHeader title="Plano e cobrança" description="Starter mensal ou vitalício via Stripe" />
        <CardContent className="space-y-4">
          {billing.isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                Plano: <strong>{billing.data?.plan ?? 'FREE'}</strong>
              </span>
              <Badge tone={billing.data?.planStatus === 'ACTIVE' ? 'brand' : 'slate'}>
                {billing.data?.planStatus ?? 'INACTIVE'}
              </Badge>
              {billing.data?.planCurrency ? <span>{billing.data.planCurrency}</span> : null}
              <span className="text-slate-500">
                Demo grátis: {billing.data?.freeSearchLimit ?? 3} buscas
              </span>
            </div>
          )}

          {billingError ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {billingError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={checkout.isPending}
              onClick={() =>
                checkout.mutate({ interval: defaultInterval, currency: defaultCurrency })
              }
            >
              Assinar / comprar
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={portal.isPending}
              onClick={() => portal.mutate()}
            >
              Portal Stripe
            </Button>
            <a
              className="inline-flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
              href={`${LANDING_URL}/pricing`}
              target="_blank"
              rel="noreferrer"
            >
              Ver preços
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Usuários e permissões" description="Membros da organização" />
        <CardContent>
          {members.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(members.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.user.name}</p>
                    <p className="text-xs text-slate-500">{member.user.email}</p>
                  </div>
                  <Badge tone={member.role === 'OWNER' ? 'brand' : 'slate'}>{member.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Privacidade (LGPD)"
          description="Solicitar exclusão ou exportação de dados pessoais"
        />
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            A exclusão completa é processada manualmente na fase MVP. Registrar a solicitação cria um
            ticket interno (DELETE /users/me/data-requests).
          </p>
          <Button type="button" variant="secondary" loading={dsr.isPending} onClick={() => dsr.mutate()}>
            Solicitar exclusão dos meus dados
          </Button>
          {dsrMessage ? <p className="text-sm text-slate-700">{dsrMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Scoring" description="Configuração de pontuação por organização" />
        <CardContent>
          <p className="text-sm text-slate-500">
            Regras de scoring configuráveis disponíveis na Fase 4, junto com a análise automática
            de websites.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
