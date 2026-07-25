import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Pagamento confirmado</h1>
        <p className="mt-3 text-sm text-slate-600">
          Seu plano será ativado em instantes via webhook Stripe.
          {sessionId ? ` Sessão: ${sessionId.slice(0, 16)}…` : null}
        </p>
        <Link to="/settings" className="mt-6 inline-block">
          <Button type="button">Ir para configurações</Button>
        </Link>
      </div>
    </div>
  );
}

export function BillingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Checkout cancelado</h1>
        <p className="mt-3 text-sm text-slate-600">
          Nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/settings?upgrade=1">
            <Button type="button">Tentar novamente</Button>
          </Link>
          <Link to="/">
            <Button type="button" variant="secondary">
              Voltar ao app
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
