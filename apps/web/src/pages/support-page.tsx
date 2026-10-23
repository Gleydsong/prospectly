import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SignalRing } from '@/components/ui/signal-ring';
import { Textarea } from '@/components/ui/textarea';
import { buildSupportMailto } from '@/lib/support-email';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

const SUBJECT_OPTIONS = ['Busca', 'Créditos e PIX', 'Conta', 'Outro'] as const;
type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

const FAQ_ITEMS = [
  {
    question: 'Quanto custa uma busca?',
    answer:
      'Cada busca de clientes consome 14 créditos após o uso das buscas gratuitas incluídas no seu plano.',
  },
  {
    question: 'O PIX não confirmou. E agora?',
    answer:
      'A confirmação via PIX costuma levar até 2 minutos. Se os créditos não aparecerem, abra um pedido informando o horário da transferência.',
  },
  {
    question: 'Posso cancelar o ilimitado?',
    answer:
      'Sim, você pode cancelar a assinatura mensal quando quiser na página de créditos, sem taxas de cancelamento.',
  },
  {
    question: 'Como convidar alguém?',
    answer:
      'Acesse Configurações > Organização e digite o e-mail do membro no formulário de convite.',
  },
  {
    question: 'O Prospectly envia mensagens sozinho?',
    answer:
      'Não. Nada é enviado sem o seu clique. Mensagens, ligações e e-mails sempre dependem da sua revisão e aprovação.',
  },
];

export function SupportPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  const [selectedTopic, setSelectedTopic] = useState<SubjectOption>('Créditos e PIX');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaqIndices, setOpenFaqIndices] = useState<number[]>([]);

  const toggleFaq = (index: number) => {
    setOpenFaqIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalSubject = subject.trim() ? `[${selectedTopic}] ${subject.trim()}` : `[${selectedTopic}] Suporte Prospectly`;
    const href = buildSupportMailto({
      subject: finalSubject,
      details: details.trim(),
      fromName: user?.name,
      fromEmail: user?.email,
    });
    if (!href) {
      setError(t('support.sendError', { defaultValue: 'Preencha o resumo e os detalhes para abrir o e-mail.' }));
      return;
    }
    setError(null);
    window.location.assign(href);
    setSent(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Como podemos ajudar?"
        description="Conte o que aconteceu. O pedido abre o e-mail para a equipe de suporte."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_1fr]">
        {/* Left Column: Abrir pedido */}
        <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-6">
          <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
            Abrir pedido
          </h2>

          {sent ? (
            <div className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-6 text-center space-y-2">
              <p className="font-semibold text-base text-[color:var(--ink)]">
                Seu aplicativo de e-mail foi aberto!
              </p>
              <p className="text-sm text-[color:var(--ink-secondary)]">
                Basta enviar a mensagem diretamente para nossa equipe.
              </p>
              <div className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setSent(false)}
                >
                  Escrever outro pedido
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Assunto pill selector */}
              <div className="space-y-2">
                <span className="block text-sm font-semibold text-[color:var(--ink)]">
                  Assunto
                </span>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((topic) => {
                    const isSelected = selectedTopic === topic;
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setSelectedTopic(topic)}
                        className={cn(
                          'rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-150',
                          isSelected
                            ? 'bg-[color:var(--ink)] text-white shadow-soft'
                            : 'border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]',
                        )}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumo input */}
              <Input
                id="support-subject"
                label="Resumo"
                placeholder="Ex: Paguei o PIX e os créditos não apareceram"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />

              {/* Detalhes textarea */}
              <Textarea
                id="support-details"
                label="Detalhes"
                placeholder="Ex: Paguei às 14h10 o pacote de 5.000 créditos. O app mostra “Ainda estamos confirmando”."
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                required
                className="min-h-[120px]"
              />

              {/* Info note */}
              <div className="rounded-xl bg-[color:var(--bg-subtle)] p-3 text-xs text-[color:var(--ink-secondary)] leading-relaxed">
                Não inclua senhas nem dados completos de cartão no texto.
              </div>

              {error ? (
                <p className="text-sm text-red-500" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="pt-1">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full py-3 shadow-soft font-semibold"
                >
                  Abrir e-mail de suporte
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* Right Column: FAQs & Dark Banner */}
        <div className="space-y-6">
          {/* Perguntas frequentes */}
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              Perguntas frequentes
            </h2>

            <div className="divide-y divide-[color:var(--border-default)]">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndices.includes(index);
                return (
                  <div key={index} className="py-3.5 first:pt-1 last:pb-1">
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[color:var(--ink)] hover:text-[color:var(--brand-blue)] transition-colors"
                    >
                      <span>{item.question}</span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-[color:var(--ink-secondary)]" />
                      ) : (
                        <span className="text-base font-normal text-[color:var(--ink-secondary)]">+</span>
                      )}
                    </button>
                    {isOpen ? (
                      <p className="mt-2 text-xs leading-relaxed text-[color:var(--ink-secondary)]">
                        {item.answer}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Dark Banner Card */}
          <section className="relative overflow-hidden rounded-panel bg-[#0B1220] p-6 sm:p-8 text-white shadow-card space-y-4">
            <div className="flex justify-center">
              <SignalRing size={100} glow />
            </div>
            <h3 className="font-display text-2xl font-extrabold tracking-tight text-white leading-tight">
              Respondemos pelo seu e-mail.
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Nosso time analisa cada caso e responde diretamente no endereço da sua conta.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
