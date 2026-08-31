# Handoff: migração PIX para Asaas

## Objetivo

Encaminhar todo checkout PIX novo do Prospectly para o Asaas, mantendo o AbacatePay só para eventos históricos de pagamento e reconciliação. Preservar o comportamento do checkout de cartão Asaas.

## Contrato de produto aprovado

| Produto | Meio de pagamento | Provedor | Benefício |
| ----------------- | -------------- | -------- | ----------------------------------------- |
| 2.000 créditos | PIX | Asaas | 2.000 créditos após recibo autoritativo |
| 5.000 créditos | PIX | Asaas | 5.000 créditos após recibo autoritativo |
| Acesso mensal ilimitado | PIX | Asaas | 30 dias pagos, sem renovação automática |
| Pacotes de crédito | Cartão | Asaas | Comportamento atual de pagamento hospedado |
| Acesso mensal ilimitado | Cartão de crédito | Asaas | Comportamento atual de checkout recorrente |

Pix Automático fica fora desta mudança. Contratos existentes AbacatePay e Stripe são registros históricos e **não** devem ser migrados, cancelados ou reclassificados automaticamente.

## Invariantes obrigatórias

1. Persistir uma tentativa de checkout local antes de criar o pagamento externo.
2. Usar `externalReference` estável e recuperar resultados incertos com lookup autoritativo no Asaas.
3. Nunca retentar às cegas um `POST` ambíguo do provedor.
4. Persistir eventos de webhook autenticados antes de devolver sucesso.
5. Processar eventos de webhook duplicados de forma idempotente.
6. Verificar cliente, valor, referência externa e `billingType=PIX` com leitura autenticada no Asaas antes de conceder benefício. Forçar BRL no contrato persistido do checkout e rejeitar moeda não-BRL do provedor quando o Asaas devolver esse campo opcional; a resposta documentada da cobrança não expõe campo de moeda obrigatório.
7. PIX só concede benefício no estado definitivo de recebido. Redirects do browser e renderização de QR nunca concedem benefício.
8. Reversões continuam auditáveis e podem gerar saldo de créditos negativo quando os créditos comprados já foram consumidos.
9. Falha do provedor novo nunca cai em silêncio para outro provedor.
10. Webhooks AbacatePay continuam operacionais para registros históricos.

## Forma da implementação

Manter a complexidade do provedor local ao módulo de Billing. Estender o client Asaas e a inbox de webhook existentes em vez de criar uma arquitetura paralela de billing.

- Adicionar `PIX_PROVIDER=ABACATE|ASAAS|DISABLED`, validado de forma explícita.
- Encaminhar a criação de checkout PIX novo pelo Asaas quando configurado.
- Estender o resultado discriminado de checkout PIX para permitir `provider: ASAAS`.
- Adicionar criação de pagamento Asaas com `billingType=PIX` e obtenção de QR via `/payments/{id}/pixQrCode`.
- Reutilizar registros duráveis `CreditPurchase` e `MonthlyCheckoutAttempt`; só adicionar schema quando os identificadores persistidos atuais não suportarem replay seguro.
- Generalizar claims de pacote e tentativa mensal Asaas entre PIX e cartão sem enfraquecer os índices unique parciais que impedem cobranças concorrentes não resolvidas.
- Estender matching de webhook e reconciliação para PIX não exigir ID de assinatura e para PIX mensal ativar exatamente 30 dias pagos.
- Preservar regras de assinatura só-cartão.

## Costuras de TDD

- Comportamento de `POST /api/v1/billing/credits/checkout` e `POST /api/v1/billing/checkout` via `BillingService`.
- Comportamento do adapter HTTP Asaas via `AsaasClient` com respostas externas mockadas.
- Comportamento de `POST /api/v1/billing/webhook/asaas` via `AsaasWebhookService`.
- Tratamento de checkout na web via contrato público `CheckoutResult`.

## Verificação

Rode testes focados depois de cada fatia vertical e depois:

```bash
pnpm --filter @prospectly/shared-types build
pnpm --filter @prospectly/api prisma:generate
pnpm --filter @prospectly/api test
pnpm --filter @prospectly/web test
pnpm --filter @prospectly/api typecheck
pnpm --filter @prospectly/web typecheck
pnpm lint
pnpm build
```

Rode testes RLS contra PostgreSQL real com `RUN_RLS_TEST=true` quando as credenciais existirem. A aceitação no Sandbox deve provar criação de QR, reuso de clique duplicado, autenticação de webhook, entrega duplicada, recibo de pagamento, ativação de 30 dias, crédito de pacote, reversão de estorno e não-regressão de cartão.

## Gates externos

Antes de produção:

- Conta Asaas totalmente aprovada e acesso à API de produção habilitado.
- Chave PIX estável registrada após prova de vida.
- Produção e Sandbox usam API keys e tokens de webhook diferentes.
- Webhook de produção é público, autenticado, ativo e devolve HTTP 200 depois da persistência durável.
- Registros AbacatePay históricos pendentes e reversíveis estão inventariados.
- Uma API/web/PostgreSQL/Redis de staging separados na Render usam **somente** credenciais Sandbox Asaas.
- Um smoke financeiro controlado prova liquidação, entrega de webhook, entitlement, tratamento de reversão e monitoramento.

## Limites operacionais

Implementação e commits locais **não** autorizam push, merge, mutação na Render, mutação de webhook, criação de pagamento ou ativação em produção. Nunca coloque credenciais em Git, chat, memória, logs ou documentação.

## Estado de continuação

- A branch `Gleydsong/integracao_asaas` contém a implementação PIX Asaas mais os defaults autorizados do cutover: `PIX_PROVIDER=ASAAS` e `ASAAS_ENABLED=true` em `render.yaml` / `.env.example`. Assinaturas de cartão ficam em aberto até cancelamento; `/billing/success` confirma planos Asaas; cancelamento de cartão Asaas sincroniza entitlement.
- `ASAAS_API_BASE_URL` permanece Sandbox até autorização de produção separada. O Dashboard da Render não foi mutado neste worktree (MCP unauthorized).
- O `.env` local não é commitado. Copiar `.env.example` recusa o boot da API até preencher secrets Asaas, ou até `ASAAS_ENABLED=false` / `PIX_PROVIDER=DISABLED` para trabalho local sem billing.
- Rollback continua explícito: `PIX_PROVIDER=ABACATE`. Sem fallback silencioso.
- O restante ainda é externo: setar secrets na Render, smoke de homologação Sandbox, inventário de registros históricos AbacatePay e depois Asaas de produção (`api.asaas.com`) com autorização separada. Não faça merge em `main`, não mute a Render e não crie pagamentos reais a menos que o operador peça.
