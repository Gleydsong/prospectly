# Pesquisa de integração: Appmax para cartão na Prospectly

**Data da pesquisa:** 24 de agosto de 2026  
**Escopo:** Appmax para cartão avulso e assinatura mensal; AbacatePay permanece responsável por PIX; remoção do Stripe do runtime da Prospectly.  
**Fontes:** somente documentação, políticas e páginas oficiais da Appmax.

## Resumo executivo

A integração é tecnicamente possível, mas não é uma troca direta do adapter de cartão. A Appmax exige que a Prospectly implemente o ciclo completo de instalação de um aplicativo, credenciais de merchant, coleta obrigatória de IP no navegador, tokenização com Appmax JS, criação de cliente, criação de pedido, pagamento e, para o plano ilimitado, transformação do pedido aprovado em assinatura.

Os dois riscos que determinam a arquitetura são:

1. Os webhooks não possuem assinatura HMAC, token de autenticação nem `event_id`. A própria Appmax orienta confirmar o estado atual pela API. Portanto, o webhook deve ser tratado somente como uma notificação não confiável; nenhum crédito ou plano pode ser ativado diretamente pelo payload recebido.
2. A documentação pública não apresenta `Idempotency-Key`, `X-Idempotency-Key` ou outro mecanismo equivalente nas rotas de criação. Isso é especialmente crítico porque a documentação afirma que um mesmo pedido pode gerar mais de uma assinatura.

Decisão recomendada para a Prospectly:

| Meio e produto | Gateway | Modelo |
| --- | --- | --- |
| PIX dos pacotes e do ilimitado | AbacatePay | Fluxo transparente existente |
| Cartão dos pacotes de créditos | Appmax | Cobrança única |
| Cartão do plano ilimitado | Appmax | Primeira cobrança seguida da criação de assinatura mensal |
| Stripe | Removido do runtime | Não criar novas cobranças nem manter webhook/portal ativos depois do corte seguro |

Preços definidos pelo produto para esta mudança:

| Produto | Valor novo |
| --- | ---: |
| 2.000 créditos | R$ 14,99 (`1499` centavos) |
| 5.000 créditos | R$ 23,99 (`2399` centavos) |
| Ilimitado mensal | R$ 49,99 (`4999` centavos, sem alteração) |

## 1. Aplicativo privado e credenciais

Para uma integração usada apenas pela própria Prospectly, o tipo adequado é **aplicativo privado**. A Appmax descreve esse tipo como apropriado para integração interna ou cliente único e informa que ele não passa pela homologação exigida para aplicativos públicos. Ainda são necessários CNPJ ativo, checklist técnico, publicação, instalação na loja e credenciais separadas para sandbox e produção. Fontes: [Criar aplicativo](https://docs.appmax.com.br/guides/criar-aplicativo) e [Publicação em produção](https://docs.appmax.com.br/guides/publicacao-producao).

A autenticação possui dois pares de credenciais, com responsabilidades diferentes:

| Credencial | Uso |
| --- | --- |
| Credenciais do app | Instalação: `/app/authorize` e `/app/client/generate` |
| Credenciais do merchant | Operações `/v1/*`: clientes, pedidos, pagamentos, assinaturas e estornos |

O fluxo documentado é:

1. `POST {AUTH_BASE}/oauth2/token` com as credenciais do app e `grant_type=client_credentials`.
2. `POST {API_BASE}/app/authorize` com `app_id` UUID, `external_key` e `url_callback`.
3. Redirecionar o merchant à URL de autorização da Appmax.
4. Receber o token de uso único no callback.
5. `POST {API_BASE}/app/client/generate` com esse token.
6. Durante essa chamada, a Appmax executa um health check contra a URL de validação da Prospectly.
7. A URL de validação deve responder em menos de cinco segundos com HTTP 200 e `{ "external_id": "<UUID>" }`.
8. Persistir o `external_id`, o `client_id` e o `client_secret` do merchant.
9. Obter tokens transacionais em `POST {AUTH_BASE}/oauth2/token` usando as credenciais do merchant.

O access token dura uma hora e não existe refresh token. As credenciais do merchant permanecem válidas até a desinstalação. O token deve ser armazenado em cache com expiração antecipada e renovação single-flight, para evitar múltiplas autenticações concorrentes. Fontes: [Fluxo de instalação](https://docs.appmax.com.br/guides/instalacao), [Autenticação](https://docs.appmax.com.br/guides/autenticacao) e [Introdução à API](https://docs.appmax.com.br/api-reference/introduction).

### Particularidades que precisam virar modelo persistente

- O `app_id` de `/app/authorize` é UUID, mas o health check recebe o ID numérico do aplicativo.
- O hash de autorização é de uso único.
- Cada reinstalação gera um novo `external_id`; o anterior deixa de funcionar.
- O `external_id` é usado somente no navegador pelo Appmax JS. As chamadas do backend usam Bearer token do merchant.
- Mesmo com um único merchant, credenciais e `external_id` devem ser modelados como uma instalação, e não espalhados pelo domínio de assinatura.

Fonte: [Identificador de instalação](https://docs.appmax.com.br/guides/external-id).

## 2. Ambientes

| Ambiente | Autenticação | API | Autorização do merchant |
| --- | --- | --- | --- |
| Sandbox | `https://auth.sandboxappmax.com.br` | `https://api.sandboxappmax.com.br` | `https://breakingcode.sandboxappmax.com.br/appstore/integration/HASH` |
| Produção | `https://auth.appmax.com.br` | `https://api.appmax.com.br` | `https://admin.appmax.com.br/appstore/integration/HASH` |

As credenciais são distintas entre ambientes. O sandbox pode retornar 503/504 temporários; a documentação orienta aguardar e repetir quando a instabilidade persistir por poucos minutos. Para as rotas mutáveis sem idempotência documentada, entretanto, uma repetição só é segura depois de reconciliar se a primeira operação foi ou não criada. Fonte: [Ambientes e sandbox](https://docs.appmax.com.br/guides/ambientes).

Cartões de teste oficiais:

| Número | Resultado |
| --- | --- |
| `4000000000000010` | Sucesso |
| `4000000000000028` | Não autorizado |
| Qualquer outro | Não autorizado |

Fonte: [Pagamento com cartão](https://docs.appmax.com.br/api-reference/payments/cartao-credito).

## 3. Appmax JS, IP e PCI DSS

A Appmax exige coleta de IP via Appmax JS em todas as integrações, inclusive em arquiteturas que já estejam no escopo PCI DSS. O script oficial é carregado de `https://scripts.appmax.com.br/appmax.min.js` e inicializado com:

```javascript
window.AppmaxScripts.init(onSuccess, onError, externalId);
```

O `externalId` é obrigatório para tokenização. O formulário de cliente usa `data-appmax-customer`; o formulário de cartão usa `data-appmax-checkout` e identifica seus campos com `appmax-form-element`. O callback de sucesso devolve `{ ip, token }`. Fonte: [Appmax JS](https://docs.appmax.com.br/guides/appmax-js).

O frontend da Prospectly deve enviar ao backend somente:

- token do cartão;
- IP coletado pela Appmax;
- nome e CPF/CNPJ do titular;
- dados cadastrais necessários;
- número de parcelas escolhido.

PAN, validade e CVV não devem passar pelo controller, logs, observabilidade, analytics ou banco da Prospectly. A tokenização server-side expõe número e CVV ao backend e, segundo a Appmax, exige que essa arquitetura esteja no escopo PCI DSS; por isso, ela não deve ser usada. Fonte: [Tokenização e pagamento com cartão](https://docs.appmax.com.br/api-reference/payments/cartao-credito).

A CSP do frontend precisará permitir o script oficial. Os domínios efetivos de `connect-src` devem ser levantados por captura de rede no sandbox, em vez de serem presumidos. Também será necessário bloquear gravação de sessão, replay e telemetria nos campos do cartão.

## 4. Dados do cliente

`POST /v1/customers` cria ou atualiza o cliente. Os campos obrigatórios são:

```json
{
  "first_name": "Maria",
  "last_name": "Silva",
  "email": "maria@example.com",
  "phone": "11999999999",
  "ip": "IP_COLETADO_PELO_APPMAX_JS"
}
```

`document_number`, endereço, produtos e UTMs são opcionais nessa rota. Entretanto, o CPF/CNPJ do titular é obrigatório na posterior cobrança por cartão como `holder_document_number`. Para produtos digitais, o endereço não aparece como obrigatório na referência pública. Fonte: [Criar ou atualizar cliente](https://docs.appmax.com.br/api-reference/customers/criar-atualizar).

A Appmax identifica atualização pela combinação `first_name + last_name + email + phone + ip`. Essa combinação não é uma chave de negócio estável para a Prospectly, porque IP, telefone ou nome podem mudar. O `customer_id` retornado deve ser persistido por organização/usuário e por instalação Appmax.

## 5. Pedido e pagamento por cartão

### 5.1 Criar pedido

Endpoint: `POST /v1/orders`.

Payload mínimo recomendado para os produtos digitais da Prospectly:

```json
{
  "customer_id": 29,
  "products": [
    {
      "sku": "prospectly-credits-2000",
      "name": "Prospectly 2.000 créditos",
      "quantity": 1,
      "unit_value": 1499,
      "type": "digital"
    }
  ],
  "products_value": 1499,
  "discount_value": 0,
  "shipping_value": 0
}
```

O pedido nasce com status `pendente`. O `order_id` retornado é necessário para cobrar e consultar seu estado em `GET /v1/orders/{order_id}`. Fontes: [Criar pedido](https://docs.appmax.com.br/api-reference/orders/criar-pedido) e [Consultar pedido](https://docs.appmax.com.br/api-reference/orders/consultar-pedido).

### 5.2 Tokenizar cartão

O Appmax JS tokeniza o cartão no navegador. A referência também documenta `POST /v1/payments/tokenize`, mas o uso direto pelo backend não é indicado para a Prospectly por ampliar o escopo PCI DSS.

O token é descrito como de uso único. Ele deve existir somente durante a tentativa de checkout e nunca ser tratado como cartão reutilizável da Prospectly.

### 5.3 Cobrar o pedido

Endpoint: `POST /v1/payments/credit-card`.

```json
{
  "order_id": 12345,
  "customer_id": 407,
  "payment_data": {
    "credit_card": {
      "token": "TOKEN_DO_APPMAX_JS",
      "holder_document_number": "19100000000",
      "holder_name": "Maria Silva",
      "installments": 1,
      "soft_descriptor": "PROSPECTLY"
    }
  }
}
```

Fonte: [Pagamento com cartão de crédito](https://docs.appmax.com.br/api-reference/payments/cartao-credito).

Para o MVP, a recomendação é restringir a uma parcela. Caso o produto passe a aceitar parcelamento, os valores devem ser consultados em `POST /v1/payments/installments`; não devem ser calculados localmente. Fonte: [Parcelas](https://docs.appmax.com.br/api-reference/payments/parcelas).

### 5.4 Estado autoritativo

O frontend nunca concede créditos ou plano com base no retorno do pagamento. O backend consulta `GET /v1/orders/{order_id}` e valida:

- pedido pertencente à instalação/merchant esperado;
- `order_id` persistido na tentativa local;
- método `creditcard`;
- valor total esperado;
- cliente esperado;
- SKU/produto esperado, quando disponível;
- status atual.

Estados relevantes documentados:

| Status | Significado para a Prospectly |
| --- | --- |
| `pendente` | Não conceder entitlement |
| `autorizado` | Ainda em antifraude; não conceder entitlement |
| `aprovado` | Pagamento confirmado; pode concluir depois das validações locais |
| `integrado` | Estado final aprovado; pode concluir depois das validações locais |
| `cancelado` | Não conceder |
| `recusado_por_risco` | Não conceder/revogar se necessário |
| `estornado` | Aplicar política de estorno |
| `chargeback_em_tratativa` / `chargeback_em_disputa` / `chargeback_perdido` | Bloquear benefício futuro e abrir tratamento financeiro conforme regra de negócio |
| `chargeback_vencido` | Disputa recuperada pelo merchant; reconciliar antes de restaurar qualquer benefício |

Fonte: [Status de pedidos](https://docs.appmax.com.br/guides/status-pedidos).

## 6. Assinatura do plano ilimitado

A assinatura não é criada diretamente a partir do cartão. Primeiro, a Prospectly cria cliente e pedido, processa a cobrança inicial e espera o pedido ficar `aprovado` ou `integrado`. Depois chama:

`POST /v1/subscriptions`

```json
{
  "order_id": 12345,
  "interval": "month",
  "interval_count": 1,
  "products": [
    {
      "product_id": 55,
      "quantity": 1
    }
  ],
  "freight_value": 0,
  "discount": 0
}
```

Para recorrência sem limite de ciclos, `max_cycles` deve ser omitido, conforme a referência. A mesma rota aceita `fail_max_tries`, `fail_interval_hours` e `next_charge_at`; os valores adequados precisam ser definidos como decisão de produto e validados em sandbox. Fonte: [Criar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/criar-assinatura).

Risco crítico: a documentação informa explicitamente que **um mesmo pedido pode originar mais de uma assinatura**. Portanto, nunca repetir automaticamente `POST /v1/subscriptions` após timeout.

Rotas necessárias ao ciclo de vida:

| Operação | Endpoint |
| --- | --- |
| Criar | `POST /v1/subscriptions` |
| Listar por e-mail | `GET /v1/subscriptions?email=...&status=...&page=...` |
| Consultar detalhe e cobranças | `GET /v1/subscriptions/{id}` |
| Cancelar definitivamente | `PATCH /v1/subscriptions/{id}/cancel` |

Fontes: [Listar assinaturas](https://docs.appmax.com.br/api-reference/subscriptions/listar-assinaturas), [Consultar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/consultar-assinatura) e [Cancelar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/cancelar-assinatura).

O detalhe de assinatura inclui `current_cycle`, `completed_cycles`, `next_charge_at` e `charges[]`. Cada cobrança pode incluir `cycle`, `order_id`, `charged_at`, `value` e `status`. Esses campos, especialmente `order_id` e `cycle`, devem formar a identidade de cada renovação na Prospectly.

### Eventos de assinatura

- `subscription_created`
- `subscription_cancelation` (grafia oficial com um único `l`)
- `subscription_delayed`
- `subscription_charge_success`
- `subscription_charge_failed`

O payload documentado do webhook de assinatura contém apenas `subscription_id`, nome, total, `customer_id`, `created_at` e `updated_at`; não contém o `order_id` nem o ciclo daquela cobrança. Portanto, `subscription_id + event` não é uma chave idempotente válida para renovações mensais. Ao receber um evento, a Prospectly precisa consultar `GET /v1/subscriptions/{id}`, localizar a cobrança/ciclo novo e deduplicar por `subscription_id + cycle + order_id + status`. Fonte: [Webhooks](https://docs.appmax.com.br/guides/webhooks).

## 7. Webhooks: confirmação obrigatória pela API

O envelope oficial contém `event`, `event_type`, `site_id`, `app_id`, `client_key`, `external_key`, `data` e `partner_merchant`, mas não apresenta `event_id`, timestamp de entrega ou assinatura criptográfica.

A Appmax informa que os webhooks possuem somente os headers `Content-Type: application/json` e `User-Agent: GuzzleHttp/7`. Ela declara que não envia HMAC nem token e recomenda validar schema, filtrar IP ou confirmar o evento pela API. Como a documentação pública não apresenta faixas oficiais de IP, a confirmação autenticada pela API deve ser o controle autoritativo. `User-Agent` nunca deve ser usado como autenticação. Fonte: [Webhooks](https://docs.appmax.com.br/guides/webhooks).

### Pipeline obrigatório

```text
POST /api/v1/billing/webhook/appmax
        |
        |-- limitar tamanho do body
        |-- validar JSON e schema
        |-- validar app_id/site_id conhecidos
        |-- persistir notificação recebida com acesso restrito
        |-- enfileirar trabalho
        `-- responder 2xx em menos de 5 s
                    |
                    `-- worker obtém Bearer do merchant
                        |-- GET pedido ou assinatura
                        |-- valida IDs, valor, produto, cliente e estado
                        |-- deduplica pela identidade remota confirmada
                        `-- concede/revoga entitlement em transação local
```

Eventos mínimos para cartão e assinatura:

| Evento | Ação após confirmação por API |
| --- | --- |
| `order_approved` / `order_paid` / `order_integrated` | Concluir compra única ou confirmar primeira cobrança |
| `payment_not_authorized` | Marcar tentativa como recusada, sem benefício |
| `order_refused_by_risk` | Marcar recusada/estornada, sem benefício |
| `order_refund` / `order_partial_refund` | Aplicar política de estorno confirmada |
| `order_chargeback_in_treatment` | Suspender/abrir tratamento conforme regra do produto |
| `order_charge_back_gain` | Reconciliar resultado da disputa |
| `subscription_created` | Vincular assinatura somente após consulta |
| `subscription_charge_success` | Identificar nova cobrança em `charges[]` e estender período uma vez |
| `subscription_charge_failed` / `subscription_delayed` | Não estender; atualizar estado de cobrança |
| `subscription_cancelation` | Confirmar `CANCELLED` e impedir novas renovações |

A ordem dos eventos não é garantida. A política de entrega é uma tentativa original e novas tentativas em aproximadamente 30 minutos, 2 horas e 4 horas. Depois da quarta falha, o evento é descartado sem notificação ao desenvolvedor. O timeout do endpoint é de cinco segundos e qualquer resposta 2xx documentada é considerada sucesso. Isso torna o reconciliador periódico obrigatório, não apenas desejável. Fonte: [Webhooks](https://docs.appmax.com.br/guides/webhooks).

## 8. Idempotência de comandos e recuperação de incerteza

Na documentação oficial completa consultada em 24/08/2026, não há ocorrência de `Idempotency-Key` nem `X-Idempotency-Key`. As menções a idempotência tratam do callback de instalação e do consumo de webhook, não das rotas transacionais de criação.

### Estado local recomendado

Cada checkout precisa de uma tentativa persistente com chave única criada antes da primeira chamada externa:

```text
CREATED
CUSTOMER_CONFIRMED
ORDER_CREATING
ORDER_CREATED
PAYMENT_SUBMITTING
PAYMENT_PENDING
PAYMENT_APPROVED
SUBSCRIPTION_CREATING
SUBSCRIPTION_CREATED
COMPLETED
FAILED
NEEDS_RECONCILIATION
NEEDS_MANUAL_REVIEW
```

Dados mínimos:

- `checkoutAttemptId`/chave idempotente da Prospectly;
- organização, usuário, finalidade e valor esperado;
- SKU e snapshot do preço;
- `appmaxCustomerId`;
- `appmaxOrderId`;
- `appmaxSubscriptionId` quando aplicável;
- estado, número de tentativas, última falha e timestamps;
- hash seguro dos campos usados para criar cliente/pedido, sem dados de cartão;
- versão da política/preço aplicada.

### Matriz de recuperação

| Falha | Conduta segura |
| --- | --- |
| Timeout antes de obter `customer_id` | Repetição é potencialmente tolerável somente com a mesma combinação de nome, e-mail, telefone e IP; ainda assim, registrar a incerteza |
| Timeout em `POST /v1/orders` sem `order_id` | Não há busca por chave externa documentada. Não repetir cegamente; marcar revisão/reconciliação e pedir à Appmax um mecanismo oficial |
| Timeout em pagamento com `order_id` salvo | Consultar `GET /v1/orders/{order_id}` antes de qualquer nova tentativa |
| Timeout em `POST /v1/subscriptions` | Consultar assinaturas por e-mail e comparar `charges[].order_id` com o pedido inicial; nunca repetir até provar ausência |
| Webhook duplicado | Deduplicar pelo recurso/estado remoto confirmado, não apenas pelo payload |
| Webhook ausente | Reconciliador consulta tentativas pendentes, pedidos e assinaturas ativas |
| `401` | Invalidar cache do token, obter um novo uma vez e repetir conforme segurança do método |
| `429` | Respeitar `Retry-After`; usar backoff e fila |
| `5xx` em GET | Backoff exponencial com jitter |
| `5xx`/timeout em POST | Estado incerto; reconciliar antes de repetir |

Pergunta bloqueadora para o suporte Appmax: existe uma chave de idempotência não publicada ou uma busca por referência externa para `POST /v1/orders`, `POST /v1/payments/credit-card` e `POST /v1/subscriptions`? Sem isso, o caso de pedido criado cujo `201` se perde exige tratamento manual ou suporte do gateway.

## 9. Reconciliador

O reconciliador deve executar fora do request do usuário e respeitar os limites da API.

### Filas sugeridas

1. **Tentativas recentes:** pedidos e pagamentos em estado incerto, com intervalos curtos e backoff.
2. **Assinaturas próximas da cobrança:** verificar cobranças novas, falhas e cancelamentos.
3. **Reconciliação diária:** conferir assinaturas ativas e tentativas não terminais.
4. **Revisão manual:** registros cujo recurso remoto não pode ser localizado com segurança.

O job deve comparar estado remoto com o ledger local, aplicar transições monotônicas e emitir métricas para:

- idade das tentativas pendentes;
- webhook recebido versus confirmado;
- eventos descartados/sem correlação;
- divergência de valor, produto ou cliente;
- renovações não processadas;
- respostas 401, 429 e 5xx;
- assinaturas duplicadas por pedido inicial.

## 10. Rate limits

Limites documentados por `client_id` do merchant:

| Limite | Valor |
| --- | ---: |
| Burst simultâneo | 50 requisições |
| Taxa sustentada | 5 requisições por segundo |
| Quota mensal | 100.000 requisições |
| Rotas transacionais por e-mail + IP | 60 por minuto |
| Operações sensíveis por e-mail + IP | 5 por minuto |

Respostas 429 incluem `Retry-After`. A Appmax recomenda cachear o Bearer token, usar backoff exponencial e fila para operações em lote. Fonte: [Rate limit](https://docs.appmax.com.br/guides/rate-limit).

## 11. Estornos e chargebacks

Estorno total ou parcial é solicitado por `POST /v1/orders/refund-request`:

```json
{
  "order_id": 12345,
  "type": "partial",
  "value": 500
}
```

O `201` informa que a solicitação foi aceita, não que o estorno terminou. A conclusão deve ser confirmada pelo estado do pedido e eventos `order_refund`/`order_partial_refund`. Fonte: [Criar estorno](https://docs.appmax.com.br/api-reference/refunds/criar-estorno).

A API pública consultada não documenta endpoint para abrir ou responder uma disputa de chargeback. Ela documenta estados e eventos de acompanhamento. A Prospectly precisa definir uma política explícita para créditos já consumidos e período ilimitado quando ocorrer estorno ou chargeback; esse comportamento não deve ser inferido do gateway.

## 12. LGPD e segurança de dados

A política oficial da Appmax descreve a Appmax como operadora quando trata dados por instrução do lojista para pagamentos e CRM, e como controladora autônoma ou conjunta em antifraude, segurança, obrigações regulatórias e outras finalidades próprias. A Prospectly continua responsável por seu próprio ambiente e pelo tratamento que realiza em seus sistemas. Fonte: [Política de Privacidade e Cookies](https://appmax.com.br/politica-de-privacidade/).

Dados envolvidos nesta integração:

- nome e sobrenome;
- e-mail e telefone;
- CPF/CNPJ;
- IP e dados de navegação/fingerprint coletados pelo Appmax JS;
- pedidos, valores, status e histórico;
- token e dados truncados do cartão;
- payloads de webhook, que também incluem dados do merchant.

Antes do go-live, a Prospectly precisa:

- atualizar política de privacidade, ROPA e inventário de suboperadores;
- documentar base legal, finalidade, compartilhamento e retenção;
- definir prazo de retenção para payloads brutos de webhook e tentativas;
- criptografar credenciais do merchant e restringir acesso;
- mascarar CPF, telefone, e-mail, tokens e payloads em logs;
- impedir ferramentas de analytics/session replay nos campos do checkout;
- implementar atendimento a acesso, correção e eliminação quando juridicamente aplicável;
- validar contrato/DPA e responsabilidades com jurídico antes de produção.

A política da Appmax informa, como referência própria, retenção de dados transacionais e de pagamento por até cinco anos e uso de medidas como tokenização, criptografia, menor privilégio e PCI DSS. Isso não substitui uma política de retenção própria da Prospectly. Fonte: [Política de Privacidade e Cookies](https://appmax.com.br/politica-de-privacidade/).

## 13. Inconsistências encontradas na documentação

O adapter deve usar validação de schema em runtime e normalização defensiva porque a documentação apresenta diferenças entre rotas:

1. A introdução afirma que todos os valores monetários são inteiros em centavos, mas respostas e campos de assinatura exibem valores decimais como `199.9` e `freight_value: 19.9`.
2. A criação da assinatura retorna `status: "active"`; consulta e listagem usam `status: "ACTIVE"`.
3. Datas variam entre `yyyy-mm-dd hh:mm:ss` e `dd/mm/yyyy`, inclusive entre listagem e detalhe.
4. O início da página de webhooks informa 29 eventos; a tabela comparativa da mesma página informa 28 eventos.
5. O evento oficial é escrito `subscription_cancelation`.
6. O webhook de assinatura não inclui ciclo nem `order_id`, embora o detalhe da assinatura exponha esses campos.
7. A documentação recomenda `order_id + event` como exemplo de idempotência de webhook, mas essa chave não distingue ciclos repetidos de assinatura.

Fontes: [Introdução à API](https://docs.appmax.com.br/api-reference/introduction), [Criar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/criar-assinatura), [Listar assinaturas](https://docs.appmax.com.br/api-reference/subscriptions/listar-assinaturas), [Consultar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/consultar-assinatura) e [Webhooks](https://docs.appmax.com.br/guides/webhooks).

## 14. Impacto arquitetural na Prospectly

A implementação deve preservar o domínio de billing e isolar peculiaridades do gateway. Módulos recomendados:

```text
billing/
  domain/
    payment-provider.ts
    payment-attempt.ts
    entitlement-policy.ts
  infrastructure/appmax/
    appmax-auth-token.provider.ts
    appmax.client.ts
    appmax.payment-provider.ts
    appmax.schemas.ts
    appmax-webhook.parser.ts
    appmax-payment-verifier.ts
    appmax-reconciliation.service.ts
  application/
    create-card-checkout.use-case.ts
    confirm-card-payment.use-case.ts
    create-monthly-subscription.use-case.ts
    reconcile-appmax-payment.use-case.ts
```

A interface atual de gateway não deve fingir que o webhook Appmax pode ser autenticado localmente. É melhor separar duas responsabilidades:

```typescript
interface PaymentNotificationParser {
  parseUntrustedNotification(rawBody: Buffer): ParsedNotification;
}

interface PaymentResourceVerifier {
  confirmOrder(orderId: number): Promise<ConfirmedOrder>;
  confirmSubscription(subscriptionId: number): Promise<ConfirmedSubscription>;
}
```

O `BillingWebhookEvent` existente pode ser reaproveitado para claim/CAS, mas a identidade do evento Appmax precisa ser derivada do recurso confirmado. Para ciclos recorrentes, usar pedido/ciclo da consulta, não apenas `subscription_id + event`.

### Remoção do Stripe

A remoção deve eliminar SDK, adapter, configuração, env vars, webhook, portal, rotas e testes do Stripe. Antes de apagar schema/enum ou desligar o webhook externo, é necessário confirmar em produção que não existem assinaturas Stripe ativas ou pendentes. Não se deve reescrever histórico financeiro Stripe como Appmax; registros históricos precisam ser preservados ou arquivados com identidade neutra/legada para auditoria, mesmo que o runtime Stripe desapareça.

## 15. Critérios mínimos de aceite

### Checkout avulso

- preço de 2.000 créditos igual a `1499` em backend, frontend e payload Appmax;
- preço de 5.000 créditos igual a `2399`;
- cartão tokenizado exclusivamente pelo Appmax JS;
- sucesso só concede créditos depois de `GET /v1/orders/{id}` confirmado;
- replay, clique duplo e timeout não criam crédito duplicado;
- cartão recusado não concede crédito;
- estorno/chargeback segue política explícita e auditável.

### Assinatura mensal

- pedido inicial de `4999` aprovado antes de criar assinatura;
- no máximo uma assinatura local por tentativa/pedido;
- timeout na criação entra em reconciliação, sem retry cego;
- renovação usa ciclo/`order_id` remoto para deduplicação;
- evento falho/atrasado não estende período;
- cancelamento é confirmado por `GET /v1/subscriptions/{id}` ou resposta atualizada da API;
- webhook forjado não altera entitlement.

### Resiliência

- tokens OAuth cacheados e renovados após 401;
- 429 respeita `Retry-After`;
- webhooks respondem 2xx em menos de cinco segundos;
- payload bruto protegido e reprocessável;
- eventos fora de ordem convergem ao estado remoto;
- webhook totalmente perdido é recuperado pelo reconciliador;
- jobs respeitam 5 req/s e quota mensal.

### Sandbox e produção

- cartão oficial de sucesso e cartão oficial de falha validados;
- pedido aprovado, recusado, estornado e chargeback simulados/validados conforme disponibilidade do sandbox;
- cobrança recorrente bem-sucedida, falha, atraso e cancelamento validados;
- URLs de validação e webhook públicas, HTTPS e monitoradas;
- credenciais de sandbox e produção totalmente separadas;
- app privado publicado e instalado na loja de produção;
- checklist de segurança, LGPD e observabilidade concluído.

## 16. Perguntas que precisam de resposta formal da Appmax

1. Existe suporte não documentado a idempotency key em cliente, pedido, pagamento e assinatura?
2. Existe campo de referência externa por pedido ou endpoint para localizar um pedido criado quando o `201` se perde?
3. Qual é a recuperação oficial após timeout em `POST /v1/subscriptions`, considerando que um pedido pode originar múltiplas assinaturas?
4. Existem faixas fixas de IP para webhooks? Há previsão de assinatura HMAC ou `event_id`?
5. É possível solicitar replay de webhooks descartados?
6. Qual é a lista canônica de eventos: 28 ou 29?
7. Quais são todos os status possíveis de assinatura e cobrança, com capitalização e transições?
8. Valores das rotas de assinatura são centavos inteiros ou reais decimais?
9. `subscription_charge_success` pode incluir `order_id` e `cycle` em produção mesmo que não estejam no schema publicado?
10. Quais domínios precisam ser liberados em `connect-src` para Appmax JS?
11. Quais configurações de `fail_max_tries` e `fail_interval_hours` são recomendadas para SaaS mensal?
12. Aplicativo privado da Prospectly exige alguma validação adicional de produção, conta ou volume além do checklist técnico publicado?

## Fontes oficiais consultadas

- [Introdução à API](https://docs.appmax.com.br/api-reference/introduction)
- [Criar aplicativo](https://docs.appmax.com.br/guides/criar-aplicativo)
- [Fluxo de instalação](https://docs.appmax.com.br/guides/instalacao)
- [Autenticação](https://docs.appmax.com.br/guides/autenticacao)
- [Identificador de instalação](https://docs.appmax.com.br/guides/external-id)
- [Ambientes e sandbox](https://docs.appmax.com.br/guides/ambientes)
- [Appmax JS](https://docs.appmax.com.br/guides/appmax-js)
- [Criar ou atualizar cliente](https://docs.appmax.com.br/api-reference/customers/criar-atualizar)
- [Criar pedido](https://docs.appmax.com.br/api-reference/orders/criar-pedido)
- [Consultar pedido](https://docs.appmax.com.br/api-reference/orders/consultar-pedido)
- [Pagamento com cartão de crédito](https://docs.appmax.com.br/api-reference/payments/cartao-credito)
- [Status de pedidos](https://docs.appmax.com.br/guides/status-pedidos)
- [Criar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/criar-assinatura)
- [Listar assinaturas](https://docs.appmax.com.br/api-reference/subscriptions/listar-assinaturas)
- [Consultar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/consultar-assinatura)
- [Cancelar assinatura](https://docs.appmax.com.br/api-reference/subscriptions/cancelar-assinatura)
- [Webhooks](https://docs.appmax.com.br/guides/webhooks)
- [Rate limit](https://docs.appmax.com.br/guides/rate-limit)
- [Criar estorno](https://docs.appmax.com.br/api-reference/refunds/criar-estorno)
- [Publicação em produção](https://docs.appmax.com.br/guides/publicacao-producao)
- [Política de Privacidade e Cookies](https://appmax.com.br/politica-de-privacidade/)
