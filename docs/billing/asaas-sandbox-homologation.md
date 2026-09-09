# Homologação Asaas Sandbox (#81)

Roteiro humano. Não habilita `https://api.asaas.com/v3`. Não inventa credenciais.

Wizard (não persiste segredos):

```bash
bash scripts/asaas-sandbox-homologation-wizard.sh
```

Webhook da API live: `https://prospectly-api.onrender.com/api/v1/billing/webhook/asaas`  
Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN` (gerado no Asaas, 32–255 caracteres; nunca a API Key).

## Defaults

| Superfície | Comportamento |
| --- | --- |
| Código (`configuration.ts`) | `asaas.enabled` só se `ASAAS_ENABLED === 'true'`. Unset = false. |
| `.env.example` / `render.yaml` | Cutover PIX autorizado: `ASAAS_ENABLED=true`, `PIX_PROVIDER=ASAAS`, **base Sandbox**. |
| Produção financeira Asaas | Exige autorização explícita + smoke. Rollback: `PIX_PROVIDER=ABACATE`. |

## Cenários obrigatórios (#81)

Fontes: [Sandbox](https://docs.asaas.com/docs/sandbox-2), [cartão de teste](https://docs.asaas.com/docs/testando-pagamento-com-cartão-de-crédito), [débito só na Fatura](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito), [estorno Sandbox](https://docs.asaas.com/recipes/estorno-de-cobranças-em-sandbox), [o que se pode testar](https://docs.asaas.com/docs/what-can-be-tested).

| Cenário | Onde | Passa quando |
| --- | --- | --- |
| Crédito hospedado | Pacote 2k/5k → invoiceUrl | `PAYMENT_CONFIRMED` + créditos uma vez |
| Débito hospedado | Mesma Fatura; dados de débito **não** na API | Pagador escolhe débito na página Asaas, ou restrição Sandbox anotada |
| Recorrência | Mensal cartão, checkout hospedado `CREDIT_CARD` | Primeiro período após GET autoritativo; cancelar não corta o já pago |
| Timeout / incerto | Checkout ambíguo | `REVIEW_REQUIRED`, UI «Estamos confirmando seu checkout», sem retry cego |
| Estorno | `POST /v3/payments/{id}/refund` logo após pagar | `PAYMENT_REFUNDED`, reversão idempotente |
| Chargeback | Sandbox ✅; disputa pode precisar do sucesso Asaas | `PAYMENT_CHARGEBACK*` confirmado revoga/reverte |

Cartões de recusa (só Sandbox, fictícios): Mastercard `5184019740373151`, Visa `4916561358240741`. CCV de teste `123`.

## Produção

Não faz parte deste ticket. Smoke real e `ASAAS_API_BASE_URL=https://api.asaas.com/v3` só depois de autorização humana.

Ver também [payments.md](./payments.md) (runbook `REVIEW_REQUIRED`) e [render.md](../deploy/render.md).
