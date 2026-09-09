# Pagamentos (billing)

## Roteamento atual

O Prospectly encaminha PIX novo e checkout de cartão hospedado pelo **Asaas**. `PIX_PROVIDER=ASAAS` e `ASAAS_ENABLED=true` são os defaults autorizados do cutover nesta branch. O AbacatePay permanece ativo só para eventos históricos e reconciliação. Contratos existentes AbacatePay e Stripe **não** são migrados nem cancelados automaticamente.

| Produto | Preço | Método | Provedor |
| ----------------- | -------: | --------------------- | --------------------- |
| 2.000 créditos | R$ 14,99 | PIX | Asaas |
| 2.000 créditos | R$ 14,99 | Cartão de crédito ou débito | Fatura hospedada Asaas |
| 5.000 créditos | R$ 23,99 | PIX | Asaas |
| 5.000 créditos | R$ 23,99 | Cartão de crédito ou débito | Fatura hospedada Asaas |
| Acesso mensal ilimitado | R$ 49,99 | PIX | Asaas |
| Acesso mensal ilimitado | R$ 49,99 | Cartão de crédito recorrente | Checkout hospedado Asaas |

A API guarda identificadores históricos de Stripe e AbacatePay. Contratos existentes não são migrados nem cancelados automaticamente. Não há runtime de checkout Stripe. Depois do cutover, PIX/cartão novos **não** podem ir para Stripe nem AbacatePay.

## Propriedades de segurança

- Benefícios só são concedidos depois de webhook autenticado do provedor **e** leitura autoritativa no provedor.
- Webhooks Asaas são persistidos no PostgreSQL (`BillingWebhookEvent`, `UNIQUE(provider, eventId)`) antes do acknowledgment. Apply financeiro (pagamento, créditos, assinatura) e marcação `PROCESSED` ocorrem na mesma transação Postgres. Replay duplicado é no-op durável — Redis nunca é a prova de idempotência.
- Criação de checkout Asaas ambígua vira `REVIEW_REQUIRED`; a organização não cria outro checkout e não há retry cego.
- O ID de pagamento Asaas persistido é reutilizado para recuperar o QR depois de falha transitória de resposta.
- PIX só concede benefício depois que a leitura autoritativa do pagamento Asaas reporta `RECEIVED`; `CONFIRMED` **não** basta para PIX.
- O Prospectly guarda um perfil de cobrança mínimo da organização e **nunca** recebe número, validade ou CVV do cartão.
- Estorno e chargeback de pacotes geram reversão total auditável e podem deixar saldo de créditos negativo.
- Estornos parciais **não** viram créditos parciais neste MVP. A inbox mantém o evento como falho para revisão de suporte, em vez de alterar o benefício em silêncio.
- Depois do cutover autorizado, `ASAAS_ENABLED` default é true e `PIX_PROVIDER` default é `ASAAS`. Credenciais de sandbox e produção ficam fora do repositório. Rollback é `PIX_PROVIDER=ABACATE` **sem** fallback silencioso.

## Assistente de sandbox

Roteiro completo (crédito, débito hospedado, recorrência, timeout, refund, chargeback) e wizard que **não persiste segredos**: [asaas-sandbox-homologation.md](./asaas-sandbox-homologation.md).

```bash
bash scripts/asaas-sandbox-homologation-wizard.sh
```

1. Conta e API Key só no Sandbox (`https://sandbox.asaas.com/`). Guarda `ASAAS_API_KEY` no Render, nunca no git.
2. Token de webhook gerado no Asaas (32–255 chars) = `ASAAS_WEBHOOK_TOKEN`. Header `asaas-access-token`.
3. URL: `https://prospectly-api.onrender.com/api/v1/billing/webhook/asaas`.
4. `ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3`. `ASAAS_ENABLED=true` neste Blueprint é o cutover PIX autorizado; unset no código continua `false`.
5. Produção (`https://api.asaas.com/v3`) exige autorização explícita e smoke. Rollback PIX: `PIX_PROVIDER=ABACATE`.

Ver [deploy na Render](../deploy/render.md) para ambiente e webhook.

## Runbook de suporte `REVIEW_REQUIRED`

O suporte **nunca** deve criar outra requisição no provedor para resolver um checkout incerto.

1. Localize a compra local ou a tentativa mensal pela organização e copie o `externalId`.
2. Busque no Sandbox/dashboard Asaas e na API de pagamentos com essa referência exata. No checkout PIX mensal, use o ID de pagamento persistido quando existir; no cartão recorrente, use o ID da sessão de checkout.
3. Se existir exatamente um pagamento correspondente, confira cliente, valor, método e status e reenvie o webhook Asaas autenticado original. O processador normal da inbox faz o GET autoritativo e resolve o lock.
4. Se o Asaas confirmar que não existe checkout/pagamento, um operador autorizado pode mudar a tentativa local para `FAILED` numa transação de suporte com bypass de tenant e **deve** inserir uma linha em `AuditLog` com action `billing.asaas_review_resolved`, o ID da entidade afetada, o ID do operador e a referência de evidência Asaas.
5. Se houver mais de um match, dados conflitantes ou estorno parcial, deixe o registro bloqueado e escale para Finanças/Engenharia. Não edite saldo de créditos nem entitlement direto.

Os reconciliadores de pacote e PIX mensal podem resolver um create perdido via `externalReference`; quando o ID de pagamento foi persistido, a reconciliação PIX mensal lê esse ID direto. Checkout mensal no cartão sem ID de checkout persistido ainda pode exigir dashboard Asaas ou replay de webhook. Este runbook é o fallback autorizado e **não** adiciona UI/API de estorno/disputa.
