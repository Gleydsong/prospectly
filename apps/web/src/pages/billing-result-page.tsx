import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">Pagamento confirmado</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Seu plano ou créditos serão liberados em instantes após a confirmação do pagamento.
          {sessionId ? ` Sessão: ${sessionId.slice(0, 16)}…` : null}
        </p>
        <Link to="/credits" className="mt-6 inline-block">
          <Button type="button">Ir para créditos</Button>
        </Link>
      </div>
    </div>
  );
}

export function BillingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-50">Pagamento cancelado</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/credits">
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
