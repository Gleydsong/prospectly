import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, MessageSquare, Square, XCircle } from 'lucide-react';

import { useAssistantSpike } from '@/features/assistant/useAssistantSpike';

export function AssistantSpikePage() {
  const isEnabled = import.meta.env.VITE_ASSISTANT_SPIKE === 'true';
  const [input, setInput] = useState('');
  const {
    messages,
    status,
    error,
    pendingIntent,
    sendMessage,
    stop,
    decideAction,
    clearMessages,
  } = useAssistantSpike();

  if (!isEnabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Assistente experimental desativado
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O spike do Assistente está desativado neste ambiente (variável{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              VITE_ASSISTANT_SPIKE=false
            </code>
            ). Para habilitá-lo localmente, defina{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              VITE_ASSISTANT_SPIKE=true
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming') return;
    const text = input.trim();
    setInput('');
    void sendMessage(text);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Assistente de Clientes</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Spike experimental
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Demonstração de streaming autenticado e aprovação humana de ações comerciais para
            clientes.
          </p>
        </div>
        <button
          type="button"
          onClick={clearMessages}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Limpar conversa
        </button>
      </div>

      {/* Quick Tool Simulators */}
      <div className="flex flex-wrap gap-2 border-b border-border py-3">
        <span className="self-center text-xs font-medium text-muted-foreground">
          Ações de teste:
        </span>
        <button
          type="button"
          disabled={status === 'streaming'}
          onClick={() => void sendMessage('Quantos clientes temos?', { simulateTool: 'count_customers' })}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          📊 Consultar contagem de clientes (somente leitura)
        </button>
        <button
          type="button"
          disabled={status === 'streaming'}
          onClick={() =>
            void sendMessage('Agende contato com cliente', {
              simulateTool: 'propose_customer_action',
              simulateCustomerName: 'Padaria Central',
            })
          }
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          📝 Propor ação para cliente (requer aprovação)
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-md text-muted-foreground">
              <p className="text-sm">Nenhuma mensagem ainda.</p>
              <p className="mt-1 text-xs">
                Faça uma pergunta sobre seus clientes ou use um dos botões de ação rápida acima.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">
              {msg.role === 'user' ? 'Você' : 'Assistente'}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground shadow-sm'
              }`}
            >
              {msg.toolCall && (
                <div className="mb-2 rounded border border-border/50 bg-muted/50 p-2 text-xs font-mono text-muted-foreground">
                  🔧 Chamando ferramenta: <strong>{msg.toolCall.name}</strong>
                </div>
              )}
              {msg.toolResult && (
                <div className="mb-2 rounded border border-green-500/20 bg-green-500/10 p-2 text-xs font-mono text-green-700 dark:text-green-400">
                  ✔ Resultado: {JSON.stringify(msg.toolResult.result)}
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content || (status === 'streaming' ? '...' : '')}</div>
            </div>
          </div>
        ))}

        {/* Approval Card */}
        {pendingIntent && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Aprovação do operador necessária
                </h3>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  {pendingIntent.message}
                </p>
                <div className="mt-2 rounded bg-background/60 p-2 text-xs">
                  <p>
                    <strong>Cliente:</strong> {pendingIntent.customerName}
                  </p>
                  <p>
                    <strong>Ação:</strong> {pendingIntent.action}
                  </p>
                  <p>
                    <strong>Resumo:</strong> {pendingIntent.summary}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decideAction('approve')}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar ação
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideAction('reject')}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Rejeitar ação
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-2 flex gap-2 border-t border-border pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva sua pergunta sobre os clientes..."
          disabled={status === 'streaming'}
          className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        {status === 'streaming' ? (
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            <Square className="h-4 w-4" />
            Parar
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Enviar
          </button>
        )}
      </form>
    </div>
  );
}
