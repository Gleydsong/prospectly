# Relatório Técnico do Spike: Streaming Autenticado do Assistente (Issue #374)

**Status:** Concluído com sucesso (mesclável, atrás de flags desligadas por padrão)  
**Data:** 22/10/2026  
**Contexto:** Milestone "IA na Cloudflare — provedor e Assistente in-app"  
**Worktree:** `issue-374-assistant-stream-spike`  

---

## 1. Resumo Executivo

O objetivo deste spike foi provar a viabilidade do fluxo completo de chat contextual com streaming Server-Sent Events (SSE) autenticado:
`React 19 / Vite (Web)` → `NestJS 10 / Express (API)` → `LlmProviderService.streamChat` (Cloudflare Workers AI / Groq).

Todos os objetivos do spike foram atingidos e validados:
1. **API Streaming SSE Autenticado:** Endpoint `POST /api/v1/assistant/spike/stream` protegido por `JwtAuthGuard` e `AssistantSpikeGuard`. JWT aceito estritamente via header `Authorization: Bearer <token>`, rejeitando qualquer passagem de token por query string com HTTP 401. Headers `Cache-Control: no-cache` e `X-Accel-Buffering: no` com flush por evento.
2. **Propagação de Abort e Resiliência no Node 22:** Corrigido o listener de abort no Express/Node 22: utiliza-se `res.on('close')` com checagem `!res.writableEnded` (pois o evento `req.on('close')` dispara prematuramente assim que o corpo do POST é lido pelo body-parser). Validado via TDD com servidor HTTP real ouvindo em porta efêmera e com teste de abort no fetch real do cliente de streaming do provedor (`openai-compatible.client.ts:234`), observando fechamento de conexão em menos de 500 ms.
3. **Tratamento e Sanitização de Erros SSE:** Mensagens de erro emitidas via SSE são estritamente sanitizadas, enviando códigos estruturados (`AI_TIMEOUT`, `AI_PROVIDER_UNAVAILABLE`, `AI_RATE_LIMIT`, `AI_DISABLED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL`) e mensagens amigáveis em português, registrando detalhes técnicos e stack traces apenas no logger do servidor (prevenindo vazamento de dados internos).
4. **Tools Simuladas com HITL (Human-In-The-Loop):**
   - **Mecanismo de Disparo:** Neste spike, as ferramentas são disparadas deterministicamente via parâmetro `simulateTool` no corpo da requisição (`count_customers` ou `propose_customer_action`), comprovando o transporte e os fluxos de leitura e confirmação. A avaliação de tool-calling autônomo diretamente pelo modelo LLM está formalmente escopada para a issue **#373**.
   - **Tool de leitura (`count_customers`):** executa contagem de clientes no banco isolada por tenant (`runWithTenant` + RLS), filtrando clientes na lixeira (`deletedAt: null`).
   - **Tool de escrita simulada (`propose_customer_action`):** **NÃO** executa contatos reais. A busca de clientes filtra `deletedAt: null`, consulta tanto `companyName` quanto `tradeName`, e valida os canais `phone` e `whatsapp`. Clientes não encontrados retornam resposta segura sem criar intenção de aprovação. Clientes com `doNotContact: true` ou presentes na lista de supressão (`SuppressionService`) são categoricamente bloqueados de receberem sugestões de contato. Para clientes permitidos e cadastrados, emite evento `approval_required` com `intentId` persistido em memória com TTL (10 min).
   - **Endpoint de decisão (`POST /api/v1/assistant/spike/actions/:intentId/decision`):** valida existência da intent, permissão de usuário e organização antes de abrir o stream SSE (retornando HTTP 404, 403 ou 400 reais). Rejeita usuários divergentes e papéis de somente-leitura (`VIEWER`), revalida DNC, supressão e `deletedAt`, falhando fechado se o cliente for excluído ou suprimido antes da decisão.
5. **Avaliação do Vercel AI SDK vs Loop Manual:** Avaliado o pacote `ai` da Vercel. O Zod resolvido no lockfile (`zod@3.25.76`) satisfaz o peer do SDK; o bloqueio real é o formato **Pure ESM** do pacote contra o runtime **CommonJS** do NestJS no repositório. Optou-se fundamentadamente pelo **loop manual sobre `LlmProviderService.streamChat`**, preservando a telemetria (`AiRun`), limites de orçamento (`LlmBudgetService`), fallback e sanitização existentes.
6. **Web (React 19 / Vite):** Hook `useAssistantSpike` e página `/assistant/spike` implementados utilizando `fetch` com `ReadableStream` (não `EventSource`), mantendo o JWT seguro no header, botão "Parar" e cartões interativos de aprovação/rejeição. Vocabulário da interface 100% em português e normalizando dinamicamente qualquer ocorrência de "lead" para "cliente".
7. **Feature Flags:** Desligado por padrão em todas as camadas (`ASSISTANT_SPIKE_ENABLED=false` no backend retorna 404 `NotFoundException`; `VITE_ASSISTANT_SPIKE=false` no frontend exibe tela informativa de recurso experimental desativado).

---

## 2. Matriz de Versões do Ecossistema

| Componente | Declarado | Resolvido | Notas de Compatibilidade |
|---|---|---|---|
| **Node.js** | `>=20` | `v22.23.3` | Total compatibilidade com Fetch nativo, AbortController, TextEncoder/TextDecoder e Streams. |
| **TypeScript** | `^5.6.3` | `5.9.3` | Modo estrito (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`). |
| **NestJS** | `^10.4.15` | `10.4.22` | Arquitetura CommonJS com `ts-loader`/`tsc`, decorators e interceptores de tenant. |
| **Express** | `@types/express ^5.0.0` | `express@4.22.1` | Runtime Express 4.x com suporte a streaming com `res.write()` e `res.flushHeaders()`. |
| **React** | `^19.0.0` | `19.3.0` | React 19 estável com hooks e Suspense. |
| **Vite** | `^6.0.3` | `6.4.4` | Build em ESM com code-splitting automático. |
| **Zod** | `^3.24.0` | `3.25.76` | Validação de schemas e contratos. Satisfez peer de `ai@7.0.148` (`^3.25.76 \|\| ^4.1.8`). |
| **Vercel AI SDK** | — | `v7.0.148` (avaliado) | Pacote ESM puro (`"type": "module"`, sem CJS). Incompatível com backend CJS. |

---

## 3. Avaliação Técnica: Vercel AI SDK vs Loop Manual

### 3.1 Limitações e Incompatibilidades do Vercel AI SDK no Projeto
1. **Incompatibilidade de Formato de Módulo (Pure ESM vs CommonJS):**
   - O backend (`@prospectly/api`) é compilado e executado em CommonJS (`tsconfig.json` target ES2022, `nest build` gerando `dist/main.js` CJS).
   - O pacote `ai` a partir da v4+ (e atual v7.0.148) é distribuído exclusivamente como **Pure ESM** (`"type": "module"` com exports apontando apenas para `./dist/index.js`, sem entrypoint CommonJS).
   - No runtime Node.js CJS, qualquer tentativa de carregar o SDK resulta em:
     ```
     Error [ERR_REQUIRE_ESM]: require() of ES Module .../node_modules/ai/dist/index.js not supported.
     ```
   - Embora existam técnicas de transpile ou wrappers assíncronos (`await import(...)`), elas introduzem instabilidade no carregamento de dependências com injeção de dependência do NestJS e complexidade desnecessária no build.
2. **Conformidade de Peer Dependencies do Zod:**
   - O pacote `ai@7.0.148` possui como peer dependency `zod: ^3.25.76 || ^4.1.8`.
   - O lockfile do repositório Prospectly já resolve `zod@3.25.76` (`pnpm list zod`), portanto **satisfaz** os requisitos de peer dependency do AI SDK. Não há conflito com o Zod.
   - O **único e real bloqueio** do AI SDK é a distribuição ESM-only.
3. **Bypass dos Mecanismos de Governança Existentes (#369 e #389):**
   - O `LlmProviderService` já possui uma camada completa de:
     - Sanitização de payloads e mensagens contra vazamento de PII (`sanitizeLlmPayload`, `sanitizeMessages`).
     - Controle e bloqueio de orçamento diário de tokens por organização (`LlmBudgetService`).
     - Auditoria e persistência de latência, tokens e erros na tabela `AiRun` (`LlmTelemetryService`).
     - Fallback transparente e resiliente de Cloudflare Workers AI (`@cf/openai/gpt-oss-120b`) para Groq (`openai/gpt-oss-120b`).
     - Gestão estrita de timeouts de conexão e idle timeouts durante streaming.
   - Utilizar o Vercel AI SDK diretamente contornaria essa governança consolidada ou exigiria duplicar esses middlewares dentro de adapters do SDK.

### 3.2 Decisão Arquitetural: Loop Manual sobre `LlmProviderService.streamChat`
Optou-se pela implementação do **Loop Manual sobre `LlmProviderService.streamChat`**.

**Vantagens Comprovadas:**
- **Zero fricção de build:** 100% compatível com a compilação CommonJS do NestJS e com o ecossistema atual.
- **Transparência e Controle de SSE:** Controle direto dos headers HTTP (`Cache-Control: no-cache`, `X-Accel-Buffering: no`), flush síncrono após cada chunk, e eventos tipados (`chunk`, `tool_call`, `tool_result`, `approval_required`, `done`, `error`).
- **Segurança de Tenant (RLS/ALS):** Garantia de execução de ferramentas dentro de `runWithTenant(organizationId, ...)`, protegendo contra vazamento de contexto assíncrono durante streams.
- **Cancelamento Imediato no Node 22:** Ao monitorar `res.on('close')` com `!res.writableEnded`, a desconexão do cliente aborta diretamente o `AbortController`, cancelando o fetch do provedor (`openai-compatible.client.ts:234`) em menos de 500 ms.

---

## 4. Segurança, Autenticação, Abort e Compliance

1. **JWT Exclusivo em Header:**
   - Requisições sem header `Authorization` recebem `401 Unauthorized`.
   - Tentativas de enviar o token por query string (`?token=...`, `?jwt=...`, `?access_token=...`) são rejeitadas pelo `AssistantSpikeGuard` com `401 Unauthorized` (mesmo se acompanhadas de headers válidos), evitando vazamento de credenciais em logs de acesso de servidores web e proxies.
2. **Propagação Correta de Abort no Node 22:**
   - No Node 22, `req.on('close')` no `IncomingMessage` dispara quando o corpo da requisição é totalmente consumido (o que ocorre imediatamente após o body parser do Nest processar o JSON).
   - O cancelamento da conexão durante o streaming ativo deve ser observado no fluxo de saída: `res.on('close', () => { if (!res.writableEnded) abortController.abort(); })`.
   - Teste automatizado com HTTP real comprovou que a leitura de todos os deltas não gera falso abort e que o cancelamento pelo cliente aborta o upstream em menos de 500 ms (`assistant-spike.real-http.spec.ts` e `assistant-spike.provider-abort.spec.ts`).
3. **Sanitização de Erros do Stream:**
   - Erros lançados durante o streaming são mapeados para códigos canônicos (`AI_TIMEOUT`, `AI_PROVIDER_UNAVAILABLE`, `AI_RATE_LIMIT`, `AI_DISABLED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL`) com mensagens amigáveis em português.
   - Mensagens de erro internas (como consultas SQL ou stacks) são gravadas unicamente no `Logger` do servidor e nunca transmitidas aos clientes SSE.
4. **Proteção de Dados, DNC (Do Not Contact) e Supressão:**
   - A busca de clientes filtra registros na lixeira (`deletedAt: null`) e pesquisa tanto por `companyName` quanto por `tradeName`.
   - Se o cliente não existir, responde com mensagem segura ("cliente não encontrado") e **não cria** intent simulado nem emite `approval_required`. O caminho `cust_simulated` foi completamente removido.
   - Clientes com flag `doNotContact === true` têm qualquer proposta de contato imediatamente bloqueada.
   - A verificação de supressão valida os canais `phone` e `whatsapp` (desconsiderando strings vazias `""`), executada sob `runWithTenant(organizationId, ...)`.
   - Na retomada da aprovação (`decision`), a verificação de existência, `deletedAt: null`, DNC e supressão é reexecutada (defesa em profundidade), falhando fechado (`customer_missing`) caso o cliente tenha sido excluído ou suprimido após a criação da intent.
5. **Isolamento de Tenant, Usuário e Papel:**
   - Toda consulta ao banco ocorre sob `runWithTenant(organizationId, ...)`.
   - Ações pendentes são validadas contra o `organizationId` e o `userId` do operador criador. Apenas o criador da ação pode aprová-la ou rejeitá-la; usuários divergentes recebem `403 Forbidden`.
   - Operadores com papel `VIEWER` são impedidos de decidir ações com `403 Forbidden`.
   - As validações de intent no endpoint de decisão ocorrem antes do envio dos headers SSE (`res.flushHeaders()`), permitindo devolver respostas HTTP 404, 403 e 400 reais em formato JSON.
6. **Sem Segredos no Bundle Web:**
   - O frontend consome apenas a API `/api/v1/assistant/spike/stream`. Nenhuma chave de API (Cloudflare, Groq, etc.) é exposta no bundle client-side (tamanho do chunk do assistente: 4.87 kB).

---

## 5. Ferramentas Simuladas e Escopo de Tool-Calling (#373)

- **Comportamento no Spike:** As ferramentas foram implementadas com acionamento direcionado através do campo `simulateTool` (`count_customers` ou `propose_customer_action`) no DTO de requisição, permitindo testar com precisão determinística o fluxo de leitura isolada por RLS e o fluxo de proposta assíncrona com confirmação humana (HITL).
- **Escopo Futuro:** O teste e a avaliação de **tool-calling autônomo** gerado pelo próprio modelo `@cf/openai/gpt-oss-120b` (com parsing de JSON Schema para `tools` e ciclo de execução de ferramentas orientado pelo modelo) está formalmente delegado e reservado para a issue **#373**.

---

## 6. Configuração de Proxy Reverso Nginx (Hostinger VPS)

> [!IMPORTANT]
> **Nota de Implantação (L8):** O arquivo `deploy/nginx/assistant-sse.conf` é um **snippet de teste autônomo** estruturado com um `server block` em `listen 80` para validação em contêineres de teste (ex: montado como `/etc/nginx/conf.d/default.conf`). Ele **não é um drop-in de substituição** para a VPS de produção.
>
> Para a VPS de produção (Hostinger KVM 2 / Ubuntu 24.04 LTS com TLS / Certbot), insira apenas o bloco `location` abaixo dentro do bloco `server { listen 443 ssl; server_name app.prospectly.com.br; ... }` já existente:

```nginx
location /api/v1/assistant/ {
    proxy_pass http://prospectly_api;
    proxy_http_version 1.1;

    # Desativa buffering para entrega em tempo real
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;

    # Keepalive com o upstream
    proxy_set_header Connection "";

    # Timeouts longos para conexões de chat streaming
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;

    # Headers de propagação de IP
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Prova do Proxy Nginx (executada em 22/10/2026)

Ambiente da prova:
- Contêiner `nginx:alpine` montando `deploy/nginx/assistant-sse.conf` sem alterações em `conf.d/default.conf`, com porta `8080:80`.
- Servidor SSE de teste (`node:20-alpine`) emitindo 10 eventos `chunk` a cada 300 ms, compartilhando o network namespace do nginx para que o `upstream` `127.0.0.1:3000` alcance o teste.
- Captura com `curl -N` e timestamps em milissegundos gerados pelo cliente; o log do servidor registra o instante de envio de cada evento.

Resultado:
```
[13:52:44.240] event: chunk
[13:52:44.241] data: {"seq":1,"text":"delta 1","sentAt":"2026-10-22T13:52:44.237Z"}
[13:52:44.550] event: chunk
[13:52:44.551] data: {"seq":2,"text":"delta 2","sentAt":"2026-10-22T13:52:44.547Z"}
[13:52:44.859] event: chunk
[13:52:44.859] data: {"seq":3,"text":"delta 3","sentAt":"2026-10-22T13:52:44.856Z"}
...
[13:52:46.402] event: chunk
[13:52:46.402] data: {"seq":8,"text":"delta 8","sentAt":"2026-10-22T13:52:46.399Z"}
...
[13:52:47.021] event: done
[13:52:47.021] data: {"status":"completed"}
```

Intervalos observados no cliente entre eventos consecutivos: 300 a 312 ms, comprovando `proxy_buffering off` e ausência de acúmulo de buffer.

---

## 7. Riscos e Recomendações para a Issue #375

1. **Persistência Durável de Conversas e Ações:**
   - No spike, as intenções pendentes foram mantidas em memória com TTL de 10 minutos. Para a #375, modelar no Prisma as entidades `AssistantConversation`, `AssistantMessage` e `AssistantActionIntent` com coluna `organizationId` e RLS habilitada.
2. **Rate Limiting Dedicado para Inferência:**
   - Requisições de streaming de LLM consomem mais tempo e tokens. Implementar throttler específico no Redis para requisições de chat (ex.: 5 turnos/minuto por usuário, máximo 2 conexões concorrentes por organização).
3. **Registry Unificado de Ferramentas:**
   - Evoluir as ferramentas simuladas do spike para um catálogo tipado que integre os serviços reais de domínio (`LeadsService`, `PipelinesService`, `TasksService`, `DashboardService`), reaproveitando as projeções de dados minimizadas da integração MCP.
4. **Resiliência a Desconexões na UI:**
   - No frontend, implementar persistência local do histórico ou sincronização com a API para que uma perda momentânea de conexão de rede ou recarregamento de página permita retomar a visualização do cartão de aprovação pendente.
