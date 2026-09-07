# Agents

O contexto de Agents fornece orientação operacional (Copiloto CRM) e ferramentas assistidas de contato comercial (Abordagem WhatsApp) para acelerar a qualificação e conversão de leads locais sem automatizar disparos indevidos.

## Language

**Copiloto CRM**:
O agente orientador que inspeciona o estado atual do lead (DNC, tarefas pendentes, tempo de inatividade, score, estágio do funil) e recomenda a próxima ação comercial com ações executáveis em 1 clique.
_Avoid_: Robô de vendas, disparador, regra cega

**Abordagem WhatsApp**:
O agente gerador de mensagens hiper-personalizadas para prospecção B2B ativa no WhatsApp, estruturado em variantes com diferentes ângulos psicológicos e estágios de sequência (1ª mensagem, follow-ups e encerramento).
_Avoid_: Disparo em massa, spammer, bot de atendimento, chatbot

**Variante**:
Uma alternativa textual de mensagem de abordagem gerada para um ângulo específico (direto, curiosidade, prova social, dor do site, oferta leve), respeitando o limite de brevidade (até 3 linhas), sem urgência artificial e com pergunta aberta de baixo atrito.
_Avoid_: Script genérico, template estático

**Estágio de Sequência**:
A fase do contato ativo com o lead:
- `FIRST_MESSAGE`: Primeira abordagem para abrir conversa.
- `FOLLOW_UP_1`: Lembrança suave após 48h sem resposta.
- `FOLLOW_UP_2`: Compartilhamento de dado ou valor do nicho após 96h.
- `BREAKUP`: Despedida educada que remove a pressão e costuma provocar resposta.
_Avoid_: Cadência de e-mail, spam sequence

**Sinais Técnicos de Auditoria**:
Evidências extraídas de `WebsiteAnalysis` (ausência de botão WhatsApp, site não-responsivo no celular, lentidão no carregamento, falta de SSL ou problemas de SEO) utilizadas como gancho persuasivo na mensagem.
_Avoid_: Vulnerabilidade, invasão, dados confidenciais

**Atividade de Contato**:
O registro durável em `LeadActivity` (tipo `WHATSAPP`) gerado quando o vendedor confirma a abertura do WhatsApp com a mensagem escolhida, garantindo rastreabilidade histórica e acionando avanços no pipeline.
_Avoid_: Webhook de envio, mensagem não confirmada

## Invariants

- **Nenhum envio automático**: O Prospectly nunca dispara mensagens de WhatsApp em segundo plano sem a ação expressa e manual do operador humano via `wa.me`.
- **DNC Absoluto**: Leads marcados como `doNotContact` bloqueiam imediatamente qualquer geração de mensagem e qualquer recomendação de contato comercial.
- **Transparência de Identidade**: O remetente da mensagem é sempre o usuário autenticado na sessão (`senderName`); a IA nunca inventa um codinome ou identidade fictícia.
- **Registro Auditável**: O registro de contato por WhatsApp grava quem enviou, para qual lead, a data e o conteúdo enviado, preservando histórico no CRM.
- **Tenancy Estrito**: Todas as operações de leitura e escrita pertencem exclusivamente à organização da sessão via JWT.
