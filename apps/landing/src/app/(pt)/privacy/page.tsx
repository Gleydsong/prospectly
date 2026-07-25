import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como o Prospectly trata dados pessoais sob LGPD e GDPR.',
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-16">
      <h1>Política de Privacidade</h1>
      <p>Última atualização: 25 de julho de 2026 · Versão: 2026-07-25</p>
      <p>
        O Prospectly (&quot;nós&quot;) processa dados para oferecer um SaaS de prospecção de negócios
        locais a agências e freelancers. Controlador: operador do serviço Prospectly. Contato de
        privacidade: privacy@prospectly.dev.
      </p>
      <h2>Dados que coletamos</h2>
      <ul>
        <li>Conta: nome, e-mail, organização, consentimento de termos.</li>
        <li>Uso: buscas, leads importados, pipeline e tarefas da sua organização.</li>
        <li>Pagamento: processado pela Stripe (não armazenamos cartão completo).</li>
        <li>
          Dados de negócios públicos obtidos via OpenStreetMap / Google Places — podem incluir
          telefone ou e-mail de MEI/pessoas físicas identificáveis.
        </li>
      </ul>
      <h2>Finalidades e bases legais (LGPD)</h2>
      <ul>
        <li>Execução de contrato: provisão do SaaS e cobrança.</li>
        <li>Consentimento: aceite de termos no cadastro; cookies não essenciais (quando houver).</li>
        <li>
          Legítimo interesse: melhoria do produto e segurança, com avaliação de impacto quando
          aplicável.
        </li>
      </ul>
      <h2>Compartilhamento</h2>
      <p>
        Subprocessadores típicos: hospedagem (Render/Vercel), banco PostgreSQL, Redis, Stripe,
        provedores de mapas. Não vendemos listas de leads.
      </p>
      <h2>Direitos do titular</h2>
      <p>
        Você pode solicitar acesso, correção, portabilidade ou exclusão dos dados da sua conta
        pelo e-mail privacy@prospectly.dev ou pela rota de solicitação no app (DELETE /me —
        fase 2). Responderemos em prazo razoável conforme a LGPD.
      </p>
      <h2>Retenção</h2>
      <p>
        Dados da conta enquanto a organização estiver ativa. Após cancelamento, retenção mínima
        para obrigações legais e depois exclusão/anonimização.
      </p>
      <h2>Transferências internacionais</h2>
      <p>
        Dados podem ser processados fora do Brasil/EEE por subprocessadores; adotamos salvaguardas
        contratuais adequadas quando necessário.
      </p>
    </article>
  );
}
