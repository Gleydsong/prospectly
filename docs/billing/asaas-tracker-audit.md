# Auditoria tracker Asaas vs `main` (#75)

Os tracers [#76](https://github.com/Gleydsong/prospectly/issues/76)–[#80](https://github.com/Gleydsong/prospectly/issues/80) ficaram abertos depois da implementação. Este ficheiro é a prova para fechar o tracker. Homologação humana: [#81](https://github.com/Gleydsong/prospectly/issues/81).

## #76 Perfil de cobrança

| Critério | Evidência |
| --- | --- |
| OWNER/ADMIN lê e edita perfil | `BillingController` `@Roles('OWNER', 'ADMIN')` GET/PUT `billing/profile` |
| Outros papéis não alteram | Mesmo decorator; SALES/VIEWER fora |
| `asaasCustomerId` persistido e reutilizado | `BillingProfileService.updateProfile` + `AsaasClient.ensureCustomer` |
| Sem PAN/CVV | DTO de perfil; checkout usa `invoiceUrl` / checkout hospedado |
| `ASAAS_ENABLED=false` não chama Asaas | `billing-profile.service.spec.ts` «without calling Asaas while disabled» |
| RLS | `rls.integration.spec.ts` filtra `BillingProfile` por org |
| Contratos históricos intactos | Adaptadores Abacate/Stripe não reclassificam no update de perfil |

## #77 Pacote cartão hospedado

| Critério | Evidência |
| --- | --- |
| 2.000 / 5.000 com Pix e cartão | `credits-page.tsx` `paymentMethod: 'pix' \| 'card'` |
| Pix não sai do provedor de PIX configurado | `PIX_PROVIDER`; Abacate só histórico |
| Tentativa persistida antes do POST | `CreditPurchaseService` / `BillingService` |
| Checkout hospedado, sem cartão no Prospectly | `AsaasClient` `billingType: 'CREDIT_CARD'` + `invoiceUrl` |
| Ambiguidade → `REVIEW_REQUIRED` | `ServiceUnavailableException('Estamos confirmando seu checkout')` |
| Sem retry cego / parcelamento | Spec + cliente Asaas sem `installmentCount` no MVP |
| Allowlist de redirect | fluxo de success/cancel existente |

## #78 Inbox, confirmar e reverter

| Critério | Evidência |
| --- | --- |
| Token Asaas independente do Abacate | `AsaasWebhookService.authenticate` header `asaas-access-token` |
| Persistência antes do 2xx | `billingWebhookEvent.create` em `ingest` |
| Dedupe `provider + eventId` | unique + replay no-op |
| GET `/v3/payments/{id}` antes do efeito | `AsaasWebhookService` + `AsaasClient.getPayment` |
| Concessão: `PAYMENT_CONFIRMED` (Pix: `RECEIVED`) | `grantEvent` + regras PIX em `payments.md` |
| Refund / chargeback uma vez | `PAYMENT_REFUNDED` / `PAYMENT_CHARGEBACK*` |
| Saldo negativo se créditos já gastos | ledger de reversão + testes webhook |

## #79 Mensal recorrente

| Critério | Evidência |
| --- | --- |
| UI Pix 30d + cartão recorrente | `credits-page.tsx` intervalo monthly |
| Checkout hospedado crédito | `billingTypes: ['CREDIT_CARD']` no cliente de checkout |
| Concessão só após confirmação autoritativa | webhook + GET payment |
| Cancelar preserva período pago | `BillingActivationService` + cancel sync |
| Sem carência após falha de renovação | spec + activation |
| Refund/chargeback revoga o período associado | webhook chargeback/refund paths |
| Lifetime / histórico protegidos | `does not overwrite lifetime`; contratos Stripe/Abacate |

## #80 Reclaim e reconciliação

| Critério | Evidência |
| --- | --- |
| Lease + reclaim | `reclaimWebhookEvent`, `MONTHLY_CHECKOUT_PROCESSING_LEASE_MS` |
| Erro sanitizado, evento não perdido | `sanitizeError` nos catches de reconciliação |
| Reconciliador periódico | `setInterval` em `onModuleInit` quando enabled; `reconcilePayments` |
| Não cria cobrança nova | testes «without creating a retry» |
| `REVIEW_REQUIRED` só com evidência ou suporte | runbook em `payments.md` |
| Evento fora de ordem / provedor histórico | mismatch de cliente/valor/método recusa apply |
| Lifetime protegido | activation specs |
| Concorrência | specs de lease e reclaim |

## Fora deste fecho

- Habilitar `api.asaas.com` (produção).
- Wizard/homologação humana: `docs/billing/asaas-sandbox-homologation.md`.
