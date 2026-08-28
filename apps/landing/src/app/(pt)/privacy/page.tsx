import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como o Prospectly trata dados pessoais sob LGPD e GDPR.',
};

export default function PrivacyPage() {
  return (
    <article className="legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
        Última atualização: 28 de agosto de 2026. Versão: 2026-08-28
      </p>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-[color:var(--ink-muted)]">
        <p>
          O Prospectly (&quot;nós&quot;) processa dados para oferecer um SaaS de prospecção de negócios
          locais a agências e freelancers. Controlador: operador do serviço Prospectly. Contato de
          privacidade: privacy@prospectly.dev.
        </p>
        <h2 className="pt-4 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Dados que coletamos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Conta: nome, e-mail, organização, consentimento de termos.</li>
          <li>Uso: buscas, leads importados, pipeline e tarefas da sua organização.</li>
          <li>
            Pagamento: processado pelo Asaas (PIX e cartão novos). Contratos históricos
            AbacatePay ou Stripe, quando existirem. Não armazenamos o número completo do cartão.
          </li>
          <li>
            Dados de negócios públicos obtidos via OpenStreetMap / Google Places - podem incluir
            telefone ou e-mail de MEI/pessoas físicas identificáveis.
          </li>
        </ul>
        <h2 className="pt-4 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Finalidades e bases legais (LGPD)
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Execução de contrato: provisão do SaaS e cobrança.</li>
          <li>Consentimento: aceite de termos no cadastro; cookies não essenciais (quando houver).</li>
          <li>
            Legítimo interesse: melhoria do produto e segurança, com avaliação de impacto quando
            aplicável.
          </li>
        </ul>
        <h2 className="pt-4 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Compartilhamento
        </h2>
        <p>
          Subprocessadores típicos: hospedagem (Render/Vercel), banco PostgreSQL, Redis,
          Asaas, AbacatePay (histórico), Stripe (legado), provedores de mapas. Não vendemos listas
          de leads.
        </p>
        <h2 className="pt-4 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Direitos do titular
        </h2>
        <p>
          Você pode solicitar acesso, correção, portabilidade ou exclusão dos dados da sua conta
          pelo e-mail privacy@prospectly.dev ou pela rota de solicitação no app (DELETE /me -
          fase 2). Responderemos em prazo razoável conforme a LGPD.
        </p>
        <h2 className="pt-4 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Retenção
        </h2>
        <p>
          Dados da conta enquanto a organização estiver ativa. Após cancelamento, retenção mínima
          para obrigações legais e depois exclusão/anonimização.
        </p>
        <h2 className="pt-4 text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Transferências internacionais
        </h2>
        <p>
          Dados podem ser processados fora do Brasil/EEE por subprocessadores; adotamos salvaguardas
          contratuais adequadas quando necessário.
        </p>
      </div>
    </article>
  );
}
