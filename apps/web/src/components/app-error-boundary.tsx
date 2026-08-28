import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getOrCreateCorrelationId, readCorrelationIdFromError } from '@/lib/correlation-id';
import { captureClientError } from '@/lib/observability';

type Props = {
  children: ReactNode;
  /** Optional override for tests */
  correlationId?: string;
};

type State = {
  error: Error | null;
  correlationId: string | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, correlationId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const fromError = readCorrelationIdFromError(error);
    const correlationId =
      this.props.correlationId ?? fromError ?? getOrCreateCorrelationId();

    this.setState({ correlationId });
    captureClientError(error, {
      correlationId,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ error: null, correlationId: null });
  };

  private handleReload = () => {
    window.location.assign('/');
  };

  render() {
    const { error, correlationId } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <Card className="w-full max-w-md" role="alert">
          <CardHeader
            title="Algo deu errado"
            description="Uma falha inesperada impediu o carregamento desta tela. Os outros fluxos devem continuar acessíveis depois de recuperar."
          />
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-400">
              {error.message || 'Erro desconhecido no cliente.'}
            </p>
            {correlationId ? (
              <p className="rounded-control border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-400">
                ID de correlação: <span className="text-zinc-200">{correlationId}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={this.handleRetry}>
                Tentar novamente
              </Button>
              <Button type="button" variant="secondary" onClick={this.handleReload}>
                Ir para o início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
