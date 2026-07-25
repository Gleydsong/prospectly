import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de uso do SaaS Prospectly.',
};

export default function TermsPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-16">
      <h1>Termos de Uso</h1>
      <p>Última atualização: 25 de julho de 2026 · Versão: 2026-07-25</p>
      <h2>1. Serviço</h2>
      <p>
        O Prospectly é uma ferramenta de prospecção e organização de leads B2B locais. Ao criar
        conta, você aceita estes termos e a Política de Privacidade.
      </p>
      <h2>2. Conta e organização</h2>
      <p>
        Você é responsável por credenciais e pelo uso dos dados importados/pesquisados na sua
        organização multi-tenant.
      </p>
      <h2>3. Planos e pagamento</h2>
      <p>
        O plano Starter pode ser mensal (assinatura) ou vitalício (pagamento único). Cobranças via
        Stripe. Cancelamento da assinatura mensal pelo Customer Portal. Plano vitalício não gera
        renovação automática.
      </p>
      <h2>4. Uso aceitável</h2>
      <p>
        É proibido usar o serviço para spam ilegal, engenharia social abusiva ou violar direitos de
        titulares. Dados públicos de mapas não isentam compliance com LGPD/GDPR no seu outreach.
      </p>
      <h2>5. Limitação</h2>
      <p>
        O serviço é fornecido &quot;como está&quot;. Não garantimos cobertura completa de mapas nem
        taxa de conversão de leads.
      </p>
      <h2>6. Contato</h2>
      <p>support@prospectly.dev</p>
    </article>
  );
}
