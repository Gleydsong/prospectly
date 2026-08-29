# Spec: troca de meio de pagamento em tentativa de checkout Asaas

> **Status:** IMPLEMENTED — `feat/asaas-checkout-method-switch`  
> **Data:** 2026-08-29  
> **Branch:** `feat/asaas-checkout-method-switch`  
> **Contexto:** [Billing](../../domain/billing/CONTEXT.md)  
> **ADR:** [0005](../../adr/0005-abandon-unpaid-checkout-on-method-switch.md)

## 1. Objetivo

O pagador pode desistir de um PIX (ou cartão) ainda não confirmado e pagar com o outro meio, ou escolher outro produto, sem ver `503 Estamos confirmando seu checkout` / `409 Another Asaas checkout is already in progress`.

A cobrança abandonada some no Asaas. A organização não fica com duas cobranças vivas. Benefício só entra após confirmação autoritativa.

## 2. Decisões

| # | Decisão |
|---|---------|
| D1 | Vale para **pacote de créditos** e **acesso mensal ilimitado**. |
| D2 | Abandono = GET autoritativo → se já pago, conceder e **não** criar o novo checkout → senão DELETE/cancel no Asaas → tentativa local `FAILED` → criar o checkout clicado. |
| D3 | **Revisão necessária** continua bloqueando qualquer criação nova (ADR 0003). |
| D4 | Qualquer checkout **novo** (outro meio, outro pacote ou mensal) abandona o ativo. Mesmo produto + mesmo meio **retoma**. |
| D5 | Sem modal. `Voltar` na tela PIX **não** abandona. |

## 3. Fora de escopo

- Estorno, chargeback ou cancelamento de pagamento já confirmado.
- Retry cego de checkout em revisão necessária.
- Troca de conta Asaas / `ensureCustomer` com customer inválido.
- Cancelar cobrança ao clicar `Voltar`.
- UI nova além de deixar os botões existentes funcionarem.
- AbacatePay (somente contratos históricos).

## 4. Invariantes

1. No máximo **uma** tentativa Asaas não terminal por organização, somando pacote e mensal.
2. Estados não terminais:
   - Pacote: `PENDING`.
   - Mensal: `PROCESSING` ou `READY`.
   - `REVIEW_REQUIRED` em qualquer um dos dois: bloqueio total, sem abandono.
3. Mesmo produto + mesmo meio + tentativa `PENDING`/`READY` com id externo → retomar QR ou URL. Não chamar DELETE.
4. Produto, para esta spec:
   - `credits-2000`
   - `credits-5000`
   - `monthly` (acesso mensal ilimitado, PIX 30 dias ou cartão recorrente)
5. `FAILED` não recebe entitlement. Webhook de pagamento da cobrança abandonada não completa compra `FAILED`.
6. DELETE/cancel **antes** de marcar `FAILED`. Se o Asaas recusar porque já recebeu, GET de novo, conceder, abortar a troca.
7. Erro ambíguo no GET/DELETE/cancel → `REVIEW_REQUIRED` + `503 Estamos confirmando seu checkout`. Não criar o checkout novo.

## 5. Fluxo

Entrada: `POST` de checkout de créditos ou mensal, já autenticado, com `offer`/`interval` + `paymentMethod`.

```
assertNoAsaasReviewRequired
carregar tentativa Asaas ativa (pacote PENDING ou mensal PROCESSING/READY)

se ativa casa com produto+meio e tem id externo
  retomar (QR PIX ou redirect cartão)
  fim

se ativa existe e NÃO casa
  abandonar(ativa)
  se abandono.jáPago
    devolver sucesso da compra/período já concedido (não criar o clicado)
    fim
  // ativa agora é FAILED; índice único liberado

criar tentativa nova + cobrança/checkout Asaas (fluxo atual)
```

### 5.1 Abandonar

```
se não há id externo
  marcar FAILED
  retornar { jáPago: false }

GET autoritativo no Asaas (pagamento ou checkout, conforme o tipo)

se 404 ou deleted
  marcar FAILED
  retornar { jáPago: false }

se benefício já confirmado (contrato vigente: PIX RECEIVED; cartão CONFIRMED/RECEIVED)
  completar entitlement da tentativa ativa
  retornar { jáPago: true }

DELETE /v3/payments/{id}     // PIX pacote, cartão pacote, PIX mensal
POST /v3/checkouts/{id}/cancel  // cartão mensal (checkout recorrente)

se 200 / deleted / já cancelado
  marcar FAILED
  retornar { jáPago: false }

se 400/409 “já recebido” (ou equivalente)
  GET de novo → se pago, completar e { jáPago: true }
  senão: REVIEW_REQUIRED + 503

se erro ambíguo (rede, 5xx, timeout)
  REVIEW_REQUIRED + 503
```

Ids:

- Pacote PIX/cartão e PIX mensal: `externalPaymentId` / `externalCheckoutId` é `pay_…`.
- Cartão mensal: `externalCheckoutId` é o id do Checkout Asaas (`POST /checkouts`).

### 5.2 Já pago no meio da troca

O pagador pediu cartão, mas o PIX já tinha sido pago. A API **não** abre cartão e **não** adiciona `mode` novo em `CheckoutResult`.

Resposta: `mode: 'redirect'` para `${frontendUrl}/billing/success` (a mesma URL de sucesso do cartão hospedado). O front grava o intent e redireciona; o saldo/período já foram concedidos na conclusão da tentativa ativa.

## 6. Superfície

Sem endpoint novo. Os `POST` atuais passam a abandonar em vez de `503`/`409` quando a ativa é `PENDING`/`READY` de outro produto ou meio.

Índices parciais atuais (`CreditPurchase_asaas_active_organization_key`, `MonthlyCheckoutAttempt_asaas_active_organization_key`) permanecem. A invariante **cruzada** (pacote + mensal) é regra de aplicação: ao criar um, abandonar o outro se estiver ativo.

## 7. UI

Página `/credits`: botões PIX/cartão dos pacotes e do ilimitado inalterados na aparência.

- Clique no mesmo produto+meio: retoma (hoje já funciona para PIX com id).
- Clique em outro botão: o `POST` abandona e segue; sem modal.
- `/billing/pix` → `Voltar`: só navega; cobrança PIX continua até outro checkout ou pagamento.

Sem copy nova obrigatória. Toast opcional não faz parte do aceite.

## 8. Testes de aceite

API (comportamento, sem mock de regra interna além do cliente Asaas):

- PIX `credits-2000` PENDING → `POST` cartão `credits-2000`: DELETE `pay_…`, compra antiga `FAILED`, nova `PENDING` com checkout URL.
- PIX `credits-2000` PENDING → `POST` PIX `credits-2000`: nenhum DELETE; retorna o mesmo QR.
- PIX `credits-2000` PENDING → `POST` cartão `credits-5000` ou mensal: abandona o 2.000 e cria o clicado.
- GET do PIX já `RECEIVED` no momento da troca: completa créditos; **não** cria cartão.
- `REVIEW_REQUIRED`: `503`, zero DELETE.
- DELETE ambíguo: `REVIEW_REQUIRED` + `503`; índice único ainda ocupado; segundo `POST` continua bloqueado.
- Webhook `PAYMENT_RECEIVED` depois de `FAILED` (cobrança deletada ou órfã): não credita de novo.
- Mensal PIX READY → mensal cartão: DELETE do `pay_…`, depois `POST /checkouts`.
- Mensal cartão READY → mensal PIX: `POST /checkouts/{id}/cancel`, depois PIX.

Web:

- Troca PIX → cartão no pacote 2.000 não mostra “Estamos confirmando seu checkout”.
- `Voltar` no QR não dispara checkout novo.

## 9. Riscos

- Corrida pagamento vs abandono: resolvida por GET → DELETE → GET de novo se o DELETE recusar recebimento. Não marcar `FAILED` sem evidência de delete/404.
- Pagador paga o QR antigo **depois** do DELETE: o QR deve falhar no PSP; se o Asaas ainda aceitar, o webhook não completa `FAILED` — suporte manual. DELETE precisa ser o caminho feliz.
- Checkout mensal cartão sem pagamento ainda: cancel do Checkout, não DELETE de `pay_…`.

## 10. Implementação (orientação, não código)

- Um colaborador de domínio (ex. `abandonUnpaidAsaasCheckout`) usado pelos begins de pacote e mensal.
- `asaas.client`: `getPayment`, `deletePayment`, `cancelCheckout`.
- Specs em `billing.service` / `monthly-checkout-attempt` / `credit-purchase` / `asaas-webhook`.
- Não relaxar RLS nem `runWithBypass` fora do reconciliador existente.
