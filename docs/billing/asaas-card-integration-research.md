# Pesquisa de integração: Asaas para cartões na Prospectly

**Data da pesquisa:** 25/08/2026

**Classificação:** research; nenhuma implementação foi realizada.

**Escopo desejado:** Asaas para cartão de crédito e débito; AbacatePay continua sendo o único provedor de PIX.

**Fontes do gateway:** documentação e OpenAPI oficiais consultados pelo MCP do Asaas.

## 1. Conclusão executiva

A adição do Asaas ao baseline PIX-only da Prospectly é viável para **cartão de crédito avulso e recorrente**. O Asaas oferece cobrança avulsa, assinatura e Checkout hospedado. Para a Prospectly, o caminho de menor risco é usar páginas hospedadas pelo Asaas: `invoiceUrl` nas compras avulsas e Checkout recorrente para o plano mensal. Assim PAN, validade e CVV não passam pela API, logs ou banco da Prospectly, reduzindo o escopo PCI, embora não elimine automaticamente as responsabilidades da Prospectly. Fontes: [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito), [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas) e [PCI DSS](https://docs.asaas.com/docs/pci-dss-1).

Há uma restrição importante: **os dados de cartão de débito não podem ser enviados diretamente pela API**. A documentação manda criar uma cobrança com `billingType: "CREDIT_CARD"` ou `"UNDEFINED"` e redirecionar o pagador para a `invoiceUrl`, onde a opção de débito pode ser apresentada. Já `POST /v3/checkouts` aceita em `billingTypes` somente `CREDIT_CARD` e `PIX`; não existe `DEBIT_CARD` nesse contrato. A recorrência documentada também é de crédito. Portanto, o escopo tecnicamente comprovado é **débito hospedado e avulso**, não débito transparente, tokenizado ou recorrente. Fontes: [Cobranças via cartão de crédito — cartão de débito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito) e [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas).

O OpenAPI também não oferece uma rota alternativa para contornar essa limitação: `POST /v3/payments/{id}/payWithCard` enumera `CREDIT` e `VOUCHER`, não débito. Isso reforça que `DEBIT_CARD` visto nas respostas/eventos identifica o meio efetivamente usado na Fatura, e não uma captura de débito que a Prospectly possa iniciar pela API.

### Matriz de responsabilidade proposta

| Produto/meio                   | Provedor   | Experiência                     | Suporte comprovado                             | Decisão recomendada                                                   |
| ------------------------------ | ---------- | ------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Pacote de créditos via PIX     | AbacatePay | PIX in-app existente            | Já implementado localmente                     | Manter sem alteração                                                  |
| Plano mensal via PIX           | AbacatePay | Fluxo existente                 | Já implementado localmente                     | Manter sem alteração                                                  |
| Pacote de créditos via crédito | Asaas      | Fatura hospedada (`invoiceUrl`) | Sim                                            | Usar a mesma cobrança hospedada oferecida ao débito                   |
| Pacote de créditos via débito  | Asaas      | Fatura hospedada (`invoiceUrl`) | Sim, somente hospedado                         | Disponibilizar apenas como avulso e explicar o redirecionamento na UI |
| Plano mensal via crédito       | Asaas      | Checkout hospedado recorrente   | Sim (`CREDIT_CARD` + `RECURRENT`)              | Usar `POST /v3/checkouts`                                             |
| Plano mensal via débito        | —          | —                               | **Não documentado/suportado como recorrência** | Não oferecer até confirmação formal do Asaas                          |

## 2. Estado atual da Prospectly

Estes são achados locais, não afirmações da documentação Asaas:

- `domain/payment-router.ts` envia `pix` para `ABACATE` e rejeita cartão porque nenhum provedor está configurado.
- `PaymentProviderId`, o enum Prisma `PaymentProvider`, a UI, os DTOs e o fluxo de retorno conhecem `ABACATE` e o histórico `STRIPE`, mas não `ASAAS` nem a distinção crédito/débito.
- O domínio já possui bons pontos de extensão: `PaymentProviderAdapter`, `CheckoutResult` com `mode: 'redirect'`, `BillingWebhookEvent` com chave única `(provider, eventId)`, `CreditPurchase.externalId` e serviços idempotentes de ativação/reversão.
- A Appmax foi removida do runtime e do schema atual por migration compensatória depois de um preflight sem dados. Suas migrations aplicadas permanecem como histórico imutável e não devem ser editadas.

Consequência arquitetural: esta é uma expansão da fronteira de providers para cartão, não uma reescrita do domínio de entitlements nem do PIX AbacatePay.

## 3. Autenticação, ambientes e segurança da chave

### Fatos verificados

- Toda requisição autenticada usa a API key no header `access_token`; `Content-Type: application/json` e um `User-Agent` identificável também devem ser enviados. O `User-Agent` é obrigatório para novas contas raiz criadas desde 13/06/2024. Fonte: [Autenticação](https://docs.asaas.com/docs/autenticação-1).
- Bases: Sandbox `https://api-sandbox.asaas.com/v3`; Produção `https://api.asaas.com/v3`. Contas, dados, configurações e chaves são independentes entre ambientes. Chave de Sandbox começa com `$aact_hmlg_`; Produção, `$aact_prod_`. Fontes: [Autenticação](https://docs.asaas.com/docs/autenticação-1) e [Sandbox](https://docs.asaas.com/docs/sandbox).
- A chave nunca deve ser exposta no frontend, código público, imagens, logs ou repositórios. O Asaas aceita TLS 1.2 e 1.3. Fonte: [Autenticação](https://docs.asaas.com/docs/autenticação-1).
- O Asaas permite limitar a chave a IPs de saída autorizados; chamadas de outros IPs retornam `403`. Infraestrutura com saída dinâmica precisa de IP fixo/NAT antes de ativar essa proteção. Fonte: [Whitelist de IPs](https://docs.asaas.com/docs/whitelist-de-ips).

### Recomendação para a Prospectly

Configurar `ASAAS_ENABLED=false`, `ASAAS_API_KEY`, `ASAAS_API_BASE_URL`, `ASAAS_USER_AGENT`, `ASAAS_WEBHOOK_TOKEN`, URLs de callback e timeouts apenas no backend/secret manager. Manter o feature flag desligado até terminar homologação. A whitelist só deve ser ativada depois de confirmar os IPs de saída do Render; não presumir que são fixos.

## 4. Clientes

### Contrato verificado

| Operação         | Rota                                      | Uso                                                                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Criar            | `POST /v3/customers`                      | Requer `name` e `cpfCnpj`; aceita `email`, telefones, endereço, `externalReference` e `notificationDisabled` |
| Listar/localizar | `GET /v3/customers?externalReference=...` | Também filtra por `cpfCnpj`, e-mail e nome                                                                   |
| Recuperar        | `GET /v3/customers/{id}`                  | Retorna o cadastro pelo ID Asaas                                                                             |

O Asaas permite clientes duplicados. A aplicação deve armazenar o `id` `cus_...`, reutilizá-lo e consultar antes de recriar quando houver timeout. `externalReference` relaciona o cadastro ao identificador interno, mas o vínculo persistido continua sendo a fonte principal. Fonte: [Cadastro de clientes](https://docs.asaas.com/docs/criando-um-cliente).

Payload mínimo recomendado:

```json
{
  "name": "Nome do responsável",
  "cpfCnpj": "CPF_OU_CNPJ",
  "email": "responsavel@example.com",
  "externalReference": "prospectly-org:UUID",
  "notificationDisabled": true
}
```

`notificationDisabled` é uma decisão de comunicação: `true` evita duplicar e-mails se a Prospectly já notifica o cliente. Deve ser validado com Produto antes do rollout.

## 5. Cobrança avulsa: crédito e débito hospedados

### Fato verificado

Crie a cobrança sem dados de cartão:

```http
POST /v3/payments
```

```json
{
  "customer": "cus_000005219613",
  "billingType": "CREDIT_CARD",
  "value": 14.99,
  "dueDate": "2026-08-25",
  "description": "2.000 créditos Prospectly",
  "externalReference": "credit-purchase:UUID"
}
```

A resposta contém `id` (`pay_...`), `invoiceUrl`, `status` e `externalReference`. O pagador é redirecionado à `invoiceUrl` para informar o cartão. Para disponibilizar débito, a documentação determina esse fluxo hospedado com `billingType` `CREDIT_CARD` ou `UNDEFINED`; os dados de débito não podem ser enviados pela API. Fonte: [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito).

### Recomendação para a Prospectly

Criar primeiro o `CreditPurchase` local `PENDING` e usar seu UUID em `externalReference`. Persistir `pay_...` e `invoiceUrl` antes de responder ao navegador. O retorno deve reutilizar `CheckoutResult.mode = 'redirect'`; a URL de callback nunca confirma pagamento. O benefício só é liberado após evento/consulta autenticada compatível com `customer`, `value`, `externalReference`, `billingType` e status esperado.

Não criar botões que prometam “somente débito” sem homologar a tela real da Fatura: o contrato comprova que a opção pode ser disponibilizada ali, mas não oferece um parâmetro API `DEBIT_CARD` para forçá-la na criação.

## 6. Crédito recorrente: Checkout hospedado

### Fato verificado

O Asaas Checkout é uma página hospedada. `billingTypes` aceita somente `CREDIT_CARD` e `PIX`; `chargeTypes` aceita `DETACHED`, `RECURRENT` e `INSTALLMENT`. Para o plano mensal da Prospectly, enviar apenas crédito evita deslocar PIX do AbacatePay. Fonte: [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas).

```http
POST /v3/checkouts
```

```json
{
  "billingTypes": ["CREDIT_CARD"],
  "chargeTypes": ["RECURRENT"],
  "minutesToExpire": 60,
  "externalReference": "monthly-checkout:UUID",
  "callback": {
    "successUrl": "https://app.prospectly.example/billing/success",
    "cancelUrl": "https://app.prospectly.example/billing/cancel",
    "expiredUrl": "https://app.prospectly.example/billing/cancel"
  },
  "items": [
    {
      "externalReference": "starter-monthly",
      "name": "Prospectly mensal",
      "description": "Plano mensal",
      "quantity": 1,
      "value": 49.99
    }
  ],
  "customerData": {
    "name": "Nome do responsável",
    "cpfCnpj": "CPF_OU_CNPJ",
    "email": "responsavel@example.com",
    "phone": "TELEFONE"
  },
  "subscription": {
    "cycle": "MONTHLY",
    "nextDueDate": "2026-08-25"
  }
}
```

A resposta inclui `id`, `link`, `status: "ACTIVE"` e `externalReference`; criar o Checkout não significa pagamento. Estados documentados do Checkout: `ACTIVE`, `CANCELED`, `EXPIRED`, `PAID`. A callback melhora a navegação, mas Webhooks confirmam o resultado financeiro. Fontes: [Checkout recorrente](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente) e [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas).

Alternativamente, `POST /v3/subscriptions` cria assinatura de crédito diretamente com `customer`, `billingType: "CREDIT_CARD"`, `nextDueDate`, `value`, `cycle`, `creditCard` e `creditCardHolderInfo`. Se `nextDueDate` for hoje, a primeira cobrança é imediata; caso contrário, a criação valida o cartão e as cobranças ocorrem nos vencimentos. Esse caminho põe a infraestrutura da Prospectly no escopo PCI e não é recomendado para o MVP. Fonte: [Criando assinatura com cartão de crédito](https://docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito).

## 7. Captura direta e tokenização

### Fatos verificados

Para cobrança transparente de crédito, `POST /v3/payments` aceita:

- `creditCard`: `holderName`, `number`, `expiryMonth`, `expiryYear`, `ccv`;
- `creditCardHolderInfo`: nome, e-mail, CPF/CNPJ, CEP, número e telefones;
- `remoteIp`: IP do dispositivo do pagador, não do servidor.

Cartão autorizado cria/processa a cobrança e retorna HTTP 200; cartão recusado não persiste a cobrança e retorna HTTP 400. Uma resposta aprovada pode trazer `creditCardToken`; chamadas seguintes do mesmo cliente podem usar `creditCardToken`. Também existe `POST /v3/creditCard/tokenizeCreditCard`. Tokenização funciona no Sandbox, mas exige habilitação do gerente de contas em Produção, e o token só pode ser usado pelo cliente que o originou. Fonte: [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito).

O Asaas informa que API direta e tokenização server-side fazem os dados passarem pelo backend do integrador, mantendo a infraestrutura no escopo PCI. CVV, trilha completa e PIN não podem ser armazenados após autorização, nem criptografados. Fonte: [PCI DSS](https://docs.asaas.com/docs/pci-dss-1).

### Recomendação

Não transportar PAN/CVV pela Prospectly nem introduzir captura server-side Asaas. Usar `invoiceUrl`/Checkout hospedado. Se Produto exigir checkout transparente no futuro, tratar como iniciativa separada com avaliação PCI/QSA, revisão de logs, analytics, session replay, observabilidade e habilitação formal de tokenização.

## 8. Webhooks, autenticação e processamento

### Configuração verificada

`POST /v3/webhooks` cria um Webhook. O contrato exige `name`, `url`, `email`, `enabled`, `interrupted`, `apiVersion`, `authToken`, `sendType` e `events`. `authToken` deve ter 32–255 caracteres e é enviado pelo Asaas em `asaas-access-token`. A entrega é **at least once**; o mesmo `id` de evento se repete nas duplicatas. Após 15 falhas consecutivas, a fila pode ser interrompida; eventos parados por mais de 14 dias são excluídos. Fontes: [Introdução — Webhooks](https://docs.asaas.com/docs/sobre-os-webhooks) e [Receba eventos do Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

```json
{
  "name": "Prospectly billing",
  "url": "https://api.prospectly.example/api/v1/billing/webhook/asaas",
  "email": "ops@prospectly.example",
  "enabled": true,
  "interrupted": false,
  "apiVersion": 3,
  "authToken": "SEGREDO_ALEATORIO_COM_32_OU_MAIS_CARACTERES",
  "sendType": "SEQUENTIALLY",
  "events": [
    "PAYMENT_CREATED",
    "PAYMENT_AWAITING_RISK_ANALYSIS",
    "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
    "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
    "PAYMENT_OVERDUE",
    "PAYMENT_REFUNDED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
    "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    "CHECKOUT_PAID",
    "CHECKOUT_CANCELED",
    "CHECKOUT_EXPIRED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED"
  ]
}
```

### Regra recomendada para a Prospectly

1. Validar `asaas-access-token` com comparação constante e rejeitar segredo ausente/incorreto.
2. Validar tamanho/schema do JSON sem rejeitar campos novos desconhecidos.
3. Persistir `event.id` em `BillingWebhookEvent` com índice único `(ASAAS, eventId)`.
4. Responder 2xx somente depois da persistência; processar de forma assíncrona.
5. Antes de conceder/revogar benefício, consultar `GET /v3/payments/{id}` com a chave do backend e validar `customer`, `value`, `externalReference`, `billingType`, `subscription` e status atual. Isso torna reenvio, atraso e ordem fora do esperado seguros.
6. Monitorar fila interrompida e eventos `FAILED`; possuir reconciliador periódico por cobranças/assinaturas pendentes.

O próprio Asaas recomenda chave única por `event.id`, persistência antes do HTTP 200 e worker posterior. Fonte: [Como implementar idempotência em Webhooks](https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks).

### Eventos e efeitos de domínio

O OpenAPI da cobrança enumera os estados `PENDING`, `RECEIVED`, `CONFIRMED`, `OVERDUE`, `REFUNDED`, `RECEIVED_IN_CASH`, `REFUND_REQUESTED`, `REFUND_IN_PROGRESS`, `CHARGEBACK_REQUESTED`, `CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL`, `DUNNING_REQUESTED`, `DUNNING_RECEIVED` e `AWAITING_RISK_ANALYSIS`. A aplicação deve preservar valores futuros desconhecidos e mapear efeitos de negócio explicitamente.

| Evento/estado                                              | Efeito recomendado                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `PAYMENT_CREATED`, `PENDING`, `AWAITING_RISK_ANALYSIS`     | Manter pendente; não conceder benefício                                        |
| `PAYMENT_CONFIRMED`                                        | Após GET e validações, concluir compra/ativar ciclo idempotentemente           |
| `PAYMENT_RECEIVED`                                         | Conciliar disponibilidade financeira; não conceder benefício novamente         |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, reprovação de risco | Falhar tentativa; nenhum benefício                                             |
| `PAYMENT_OVERDUE` em ciclo mensal                          | Marcar `PAST_DUE` conforme política de tolerância                              |
| `PAYMENT_REFUND_IN_PROGRESS`                               | Marcar reversão pendente; não considerar concluída                             |
| `PAYMENT_REFUNDED`/`PAYMENT_PARTIALLY_REFUNDED`            | Reverter benefício de forma proporcional/idempotente conforme regra de produto |
| chargeback solicitado/em disputa                           | Bloquear nova concessão e abrir tratamento operacional                         |
| chargeback perdido/refund concluído                        | Revogar benefício e registrar dívida/saldo segundo política aprovada           |

Para cartão de crédito, o fluxo oficial típico é `PAYMENT_CREATED → PAYMENT_CONFIRMED → PAYMENT_RECEIVED`; débito segue a mesma sequência, mas o recebimento é informado como três dias após a confirmação, enquanto crédito é informado como 32 dias. Fonte: [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas).

## 9. Idempotência das mutações e recuperação

### Fato/documentação disponível

A documentação consultada ensina idempotência para **Webhooks**, mas não publicou um header de idempotência para `POST /customers`, `/payments`, `/checkouts` ou `/subscriptions`. Em caso de timeout no cartão ou resultado inconclusivo, ela orienta consultar antes de repetir, pois uma nova tentativa pode duplicar a cobrança. `GET /v3/payments` aceita filtro `externalReference`; `GET /v3/customers` também. Fontes: [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito), [Cadastro de clientes](https://docs.asaas.com/docs/criando-um-cliente) e [Introdução — Cobranças](https://docs.asaas.com/docs/guia-de-cobrancas).

### Recomendação

- Criar uma tentativa local durável com chave única antes de qualquer `POST` externo.
- Usar `externalReference` único e semanticamente estável (`credit-purchase:<uuid>` ou `monthly-checkout:<uuid>`).
- Timeout após `POST /payments`: consultar `GET /v3/payments?externalReference=...` antes de repetir.
- Timeout após cliente: consultar por `externalReference` e reutilizar `cus_...`.
- Timeout após `POST /checkouts`: marcar `REVIEW_REQUIRED`, bloquear nova criação e aguardar Webhook ou suporte; o OpenAPI público não oferece `GET /v3/checkouts` nem busca por `externalReference`, portanto nunca repetir cegamente.
- Timeout após assinatura criada diretamente: consultar `GET /v3/subscriptions?externalReference=...`; a referência auxilia a recuperação, mas não é documentada como única.
- Se a consulta retornar mais de um recurso para a mesma referência, interromper ativação automática e alertar operação.

Pergunta obrigatória ao Asaas antes da implementação: existe um header/chave de idempotência de criação ainda não exposto na documentação pública, especialmente para Checkout e assinatura?

## 10. Estornos e chargebacks

`POST /v3/payments/{id}/refund` solicita estorno e aceita `value` (parcial), `description` e, quando aplicável, `splitRefunds`. A cobrança pode retornar vários itens em `refunds`; somente itens com `status: "DONE"` contam como valor efetivamente devolvido. Estados documentados no guia: `PENDING`, `CANCELLED`, `DONE`; o OpenAPI também prevê estados de autorizações críticas. Fonte: [Estornos](https://docs.asaas.com/docs/estornos).

O objeto `chargeback` retorna `status` (`REQUESTED`, `IN_DISPUTE`, `DISPUTE_LOST`, `REVERSED`, `DONE`) e `reason`. A integração deve preservar enums desconhecidos e histórico; não transformar um estado intermediário em estorno concluído. Fonte: [Chargeback](https://docs.asaas.com/docs/chargeback).

O OpenAPI também expõe `GET /v3/payments/{id}/chargeback`, `GET /v3/chargebacks` e `POST /v3/chargebacks/{id}/dispute`. A disputa é multipart, recebe documentos e limita o envio a 11 arquivos; deve respeitar `deadlineToSendDisputeDocuments`. Esse é um fluxo operacional/humano e não deve ser automatizado sem política e autorização específicas.

Recomendação: manter o ledger append-only. Para créditos já consumidos, a política entre saldo negativo, bloqueio ou absorção da perda é decisão de Produto/Financeiro. Para plano mensal, chargeback/refund não deve apagar histórico; deve encerrar ou suspender entitlement idempotentemente após confirmação pela API.

## 11. Arquitetura-alvo sugerida

Esta é uma recomendação, não contrato do Asaas:

```text
billing/domain
  PaymentProviderAdapter       (continua como fronteira)
  payment-router               (pix -> ABACATE; credit/debit -> ASAAS)

billing/infrastructure/asaas
  asaas.client                 (API key, User-Agent, timeout, schemas)
  asaas.payment-provider       (invoice, checkout, cancelamento)
  asaas-webhook                (token, parse, persist/claim)
  asaas-reconciliation         (GET autoritativo e pendências)
```

Mudanças de modelo a considerar na futura especificação:

- `PaymentProvider.ASAAS` e suporte em `BillingWebhookEvent`;
- separar `PaymentMethod` em `pix | credit_card | debit_card`, evitando que `card` esconda capacidades diferentes;
- `asaasCustomerId`, `asaasSubscriptionId` e IDs externos de pagamento/Checkout;
- tentativa durável provider-neutral ou `AsaasCheckoutAttempt` com `externalReference`, estado e recuperação;
- preservar migrations Appmax já aplicadas como histórico imutável; nunca reclassificar registros de providers anteriores como Asaas;
- reutilizar `CheckoutResult.redirect`, `CreditPurchase`, `BillingActivationService` e ledger, em vez de duplicar o domínio.

Fluxo de roteamento pretendido:

```text
PIX ------------------------------> AbacatePay existente
crédito avulso --┐
débito avulso ---┴--> Asaas payment -> invoiceUrl -> Webhook + GET -> entitlement
crédito mensal ------> Asaas Checkout RECURRENT -> Webhook + GET -> entitlement
débito mensal -------> indisponível até confirmação oficial
```

## 12. Sandbox e rollout

### Fatos verificados

O Sandbox não movimenta valores reais, usa conta e chave próprias e permite clientes, cobranças, pagamentos e Webhooks, mas nem todo comportamento é idêntico à Produção. A documentação recomenda homologar erros, reprocessamentos e mudanças assíncronas, não apenas a criação. Fonte: [Sandbox](https://docs.asaas.com/docs/sandbox).

Para captura direta de crédito, o Sandbox documenta `4444 4444 4444 4444`, CVV `123` e validade futura para sucesso; `5184019740373151` e `4916561358240741` forçam erro/recusa. Fonte: [Testar pagamento com cartão no Sandbox](https://docs.asaas.com/recipes/testar-pagamento-com-cartão-de-crédito-no-sandbox). Esses cartões testam a API direta e não provam, por si só, a experiência de débito na Fatura hospedada.

### Checklist de rollout

- [ ] Criar/aprovar conta Sandbox e gerar chave exclusiva.
- [ ] Confirmar com o Asaas que crédito, débito hospedado e assinatura de crédito estão habilitados para o cadastro comercial da Prospectly.
- [ ] Homologar Fatura avulsa: crédito aprovado/recusado, débito real/simulado disponível, abandono e expiração.
- [ ] Homologar Checkout mensal: criação, callback, primeira confirmação, renovação, recusa, risco, atraso e cancelamento.
- [ ] Validar que `billingTypes` no Checkout contém somente `CREDIT_CARD`; PIX continua exclusivamente no AbacatePay.
- [ ] Validar Webhook com token correto/incorreto, duplicata, evento fora de ordem, timeout, retry e fila reativada.
- [ ] Validar recuperação de cliente/cobrança por `externalReference` e `REVIEW_REQUIRED` sem retry para resposta perdida de Checkout.
- [ ] Validar estorno total/parcial e chargeback com reversão idempotente de entitlement.
- [ ] Confirmar CSP/redirecionamentos e impedir segredos Asaas no bundle, logs e analytics.
- [ ] Confirmar IP de saída antes de ativar whitelist.
- [ ] Criar conta/chave/configuração de Produção separadas; nunca copiar dados de Sandbox.
- [ ] Auditar contratos Stripe e AbacatePay históricos ativos/past-due antes de permitir uma nova assinatura Asaas.
- [ ] Implantar com `ASAAS_ENABLED=false`, configurar Webhook e smoke controlado, então habilitar gradualmente.
- [ ] Manter AbacatePay PIX operacional durante todo o rollout e ter rollback do roteamento de cartão.

## 13. Lacunas e perguntas abertas

1. O Asaas habilitará cartão de débito na `invoiceUrl` da conta Prospectly em Sandbox e Produção? Quais bandeiras/bancos e condições são aceitos?
2. Débito pode ser explicitamente selecionado ou identificado antes do pagamento, ou a Fatura sempre apresenta crédito e débito juntos?
3. Existe chave/header de idempotência para criação de cliente, cobrança, Checkout e assinatura?
4. O Checkout recorrente retorna/vincula diretamente `customer` e `subscription` em todos os eventos necessários à conciliação?
5. Quais recursos precisam de habilitação contratual em Produção além da tokenização? Quais limites, tarifas, prazos de repasse e reservas se aplicam a crédito e débito?
6. O fluxo usa antifraude/3DS no Checkout/Fatura hospedados e quais eventos/estados adicionais podem ocorrer? A documentação primária consultada não forneceu um contrato de 3DS.

### Inconsistências encontradas entre guias e OpenAPI

- Na criação de assinatura, o OpenAPI marca `remoteIp` e objetos de cartão como obrigatórios, enquanto exemplos narrativos omitem `remoteIp` e descrevem o token como substituto. A futura implementação deve enviar `remoteIp` e homologar especificamente o payload com token.
- Na criação de Webhook, o OpenAPI exige `authToken`; o guia também descreve cenários em que ele pode ser gerado. A Prospectly deve fornecê-lo explicitamente, armazená-lo como segredo e validar o header.
- Uma receita de Sandbox menciona `/v3/creditCard/tokenize`, mas o OpenAPI e a referência usam `/v3/creditCard/tokenizeCreditCard`. Usar a rota do OpenAPI.
- `externalReference` é pesquisável, porém não foi documentado como único. Ele auxilia recuperação, mas não substitui idempotência transacional.

## 14. Fontes oficiais consultadas via MCP Asaas

- [Autenticação](https://docs.asaas.com/docs/autenticação-1)
- [Sandbox](https://docs.asaas.com/docs/sandbox)
- [Cadastro de clientes](https://docs.asaas.com/docs/criando-um-cliente)
- [Introdução — Cobranças](https://docs.asaas.com/docs/guia-de-cobrancas)
- [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas)
- [Checkout para cartão de crédito](https://docs.asaas.com/docs/checkout-para-cartão-de-crédito)
- [Checkout recorrente](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente)
- [Introdução — Assinaturas](https://docs.asaas.com/docs/assinaturas)
- [Criando assinatura com cartão de crédito](https://docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito)
- [PCI DSS](https://docs.asaas.com/docs/pci-dss-1)
- [Introdução — Webhooks](https://docs.asaas.com/docs/sobre-os-webhooks)
- [Receba eventos do Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook)
- [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Idempotência em Webhooks](https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks)
- [Estornos](https://docs.asaas.com/docs/estornos)
- [Chargeback](https://docs.asaas.com/docs/chargeback)
- [Whitelist de IPs](https://docs.asaas.com/docs/whitelist-de-ips)
- [Teste de cartão no Sandbox](https://docs.asaas.com/recipes/testar-pagamento-com-cartão-de-crédito-no-sandbox)

Além dessas páginas, o MCP foi usado para conferir os contratos OpenAPI de `POST/GET /v3/customers`, `POST/GET /v3/payments`, `POST /v3/checkouts`, `POST /v3/subscriptions`, `POST /v3/creditCard/tokenizeCreditCard`, `POST /v3/webhooks` e `POST /v3/payments/{id}/refund`.
