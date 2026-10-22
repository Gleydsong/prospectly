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
2. **Propagação de Abort e Resiliência no Node 22:** Corrigido o listener de abort no Express/Node 22: utiliza-se `res.on('close')` com checagem `!res.writableEnded` (pois o evento `req.on('close')` dispara prematuramente assim que o corpo do POST é lido pelo body-parser). Validado via TDD com servidor HTTP real ouvindo em porta efêmera.
3. **Tratamento e Sanitização de Erros SSE:** Mensagens de erro emitidas via SSE são estritamente sanitizadas, enviando códigos estruturados (`AI_TIMEOUT`, `AI_PROVIDER_UNAVAILABLE`, `AI_RATE_LIMIT`, `AI_DISABLED`, `INTERNAL`) e mensagens amigáveis em português, registrando detalhes técnicos e stack traces apenas no logger do servidor (prevenindo vazamento de dados internos).
4. **Tools Simuladas com HITL (Human-In-The-Loop):**
   - **Mecanismo de Disparo:** Neste spike, as ferramentas são disparadas deterministicamente via parâmetro `simulateTool` no corpo da requisição (`count_customers` ou `propose_customer_action`), comprovando o transporte e os fluxos de leitura e confirmação. A avaliação de tool-calling autônomo diretamente pelo modelo LLM está formalmente escopada para a issue **#373**.
   - **Tool de leitura (`count_customers`):** executa contagem de clientes no banco isolada por tenant (`runWithTenant` + RLS).
   - **Tool de escrita simulada (`propose_customer_action`):** **NÃO** executa contatos reais. Clientes com `doNotContact: true` ou presentes na lista de supressão (`SuppressionService`) são categoricamente bloqueados de receberem sugestões de contato. Para clientes permitidos, emite evento `approval_required` com `intentId` persistido em memória com TTL (10 min).
   - **Endpoint de decisão (`POST /api/v1/assistant/spike/actions/:intentId/decision`):** permite aprovar ou rejeitar a ação, retomando a conversa e transmitindo a confirmação via SSE.
5. **Avaliação do Vercel AI SDK vs Loop Manual:** Identificada incompatibilidade crítica entre o pacote `ai` (pure ESM) e o runtime NestJS CommonJS do repositório, além de restrições de peer dependencies do Zod. Optou-se fundamentadamente pelo **loop manual sobre `LlmProviderService.streamChat`**, preservando a telemetria (`AiRun`), limites de orçamento (`LlmBudgetService`), fallback e sanitização existentes.
6. **Web (React 19 / Vite):** Hook `useAssistantSpike` e página `/assistant/spike` implementados utilizando `fetch` com `ReadableStream` (não `EventSource`), mantendo o JWT seguro no header, botão "Parar" e cartões interativos de aprovação/rejeição. Vocabulário da interface 100% em português e utilizando o termo "cliente" (nunca "lead").
7. **Feature Flags:** Desligado por padrão em todas as camadas (`ASSISTANT_SPIKE_ENABLED=false` no backend retorna 404 `NotFoundException`; `VITE_ASSISTANT_SPIKE=false` no frontend exibe tela informativa de recurso experimental desativado).

---

## 2. Matriz de Versões do Ecossistema

| Componente | Versão no Repositório | Notas de Compatibilidade |
|---|---|---|
| **Node.js** | v22.23.3 | Total compatibilidade com Fetch nativo, AbortController, TextEncoder/TextDecoder e Streams. |
| **TypeScript** | 5.6.3 | Modo estrito (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`). |
| **NestJS** | 10.4.15 | Arquitetura CommonJS com `ts-loader`/`tsc`, decorators e interceptores de tenant. |
| **Express** | 5.0.0 (`@types/express`) | Suporte a streaming com `res.write()` e `res.flushHeaders()`. |
| **React** | 19.3.0 | React 19 estável com hooks e Suspense. |
| **Vite** | 6.0.3 (dev) / 6.4.4 (override) | Build em ESM com code-splitting automático. |
| **Zod** | 3.24.0 (API) / 3.24.1 (Web) | Validação de schemas e contratos de entrada/saída. |
| **Vercel AI SDK** | v7.0.148 (avaliado) | Pacote ESM puro (`"type": "module"`, sem CJS). |

---

## 3. Avaliação Técnica: Vercel AI SDK vs Loop Manual

### 3.1 Limitações e Incompatibilidades do Vercel AI SDK no Projeto
1. **Incompatibilidade de Formato de Módulo (ESM vs CommonJS):**
   - O backend (`@prospectly/api`) é compilado e executado em CommonJS (`tsconfig.json` target ES2022, `nest build` gerando `dist/main.js` CJS).
   - O pacote `ai` a partir da v4+ (e atual v7.0.148) é distribuído exclusivamente como **Pure ESM** (`"type": "module"` com exports apontando apenas para `./dist/index.js`, sem entrypoint CommonJS).
   - No runtime Node.js CJS, qualquer tentativa de carregar o SDK resulta em:
     ```
     Error [ERR_REQUIRE_ESM]: require() of ES Module .../node_modules/ai/dist/index.js not supported.
     ```
   - Embora existam técnicas de transpile ou wrappers assíncronos (`await import(...)`), elas introduzem instabilidade no carregamento de dependências com injeção de dependência do NestJS e complexidade desnecessária no build.
2. **Conflito de Peer Dependencies com Zod:**
   - O pacote `ai@7.0.148` possui como peer dependency `zod: ^3.25.76 || ^4.1.8`.
   - O repositório Prospectly está padronizado e validado em `zod@^3.24.0`. Forçar uma atualização do Zod traria risco de regressão em dezenas de módulos de validação do monorepo.
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
- **Cancelamento Imediato no Node 22:** Ao monitorar `res.on('close')`, a desconexão do cliente aborta diretamente o `AbortController`, propagando o sinal para o cliente HTTP subjacente sem estados zumbis.

---

## 4. Segurança, Autenticação, Abort e Compliance

1. **JWT Exclusivo em Header:**
   - Requisições sem header `Authorization` recebem `401 Unauthorized`.
   - Tentativas de enviar o token por query string (`?token=...`, `?jwt=...`, `?access_token=...`) são rejeitadas pelo `AssistantSpikeGuard` com `401 Unauthorized` (mesmo se acompanhadas de headers válidos), evitando vazamento de credenciais em logs de acesso de servidores web e proxies.
2. **Propagação Correta de Abort no Node 22:**
   - No Node 22, `req.on('close')` no `IncomingMessage` dispara quando o corpo da requisição é totalmente consumido (o que ocorre imediatamente após o body parser do Nest processar o JSON).
   - O cancelamento da conexão durante o streaming ativo deve ser observado no fluxo de saída: `res.on('close', () => { if (!res.writableEnded) abortController.abort(); })`.
   - Teste automatizado com HTTP real comprovou que a leitura de todos os deltas não gera falso abort e que o cancelamento pelo cliente aborta o upstream em menos de 150 ms.
3. **Sanitização de Erros do Stream:**
   - Erros lançados durante o streaming são mapeados para códigos canônicos (`AI_TIMEOUT`, `AI_PROVIDER_UNAVAILABLE`, `AI_RATE_LIMIT`, `AI_DISABLED`, `INTERNAL`) com mensagens amigáveis em português.
   - Mensagens de erro internas (como consultas SQL ou stacks) são gravadas unicamente no `Logger` do servidor e nunca transmitidas aos clientes SSE.
4. **Proteção de Dados e DNC (Do Not Contact):**
   - Clientes com flag `doNotContact === true` têm qualquer proposta de contato imediatamente bloqueada com mensagem explícita e nenhum intent de aprovação é criado.
   - Clientes registrados na tabela de supressão (`SuppressionService.isSuppressed`) são igualmente bloqueados.
   - Na retomada da aprovação (`decision`), a verificação de DNC e supressão é reexecutada (defesa em profundidade), prevenindo condições de corrida onde o cliente foi suprimido enquanto a aprovação estava pendente.
5. **Isolamento de Tenant:**
   - Toda consulta ao banco ocorre sob `runWithTenant(organizationId, ...)`.
   - Ações pendentes são validadas contra o `organizationId` do operador autenticado. Tentativa de aprovar uma ação de outra organização é rejeitada com `403 Forbidden`.
6. **Sem Segredos no Bundle Web:**
   - O frontend consome apenas a API `/api/v1/assistant/spike/stream`. Nenhuma chave de API (Cloudflare, Groq, etc.) é exposta no bundle client-side (tamanho do chunk do assistente: 4.87 kB).

---

## 5. Ferramentas Simuladas e Escopo de Tool-Calling (#373)

- **Comportamento no Spike:** As ferramentas foram implementadas com acionamento direcionado através do campo `simulateTool` (`count_customers` ou `propose_customer_action`) no DTO de requisição, permitindo testar com precisão determinística o fluxo de leitura isolada por RLS e o fluxo de proposta assíncrona com confirmação humana (HITL).
- **Escopo Futuro:** O teste e a avaliação de **tool-calling autônomo** gerado pelo próprio modelo `@cf/openai/gpt-oss-120b` (com parsing de JSON Schema para `tools` e ciclo de execução de ferramentas orientado pelo modelo) está formalmente delegado e reservado para a issue **#373**.

---

## 6. Configuração de Proxy Reverso Nginx (Hostinger VPS)

Para evitar buffering e garantir a entrega token-a-token na VPS da Hostinger, o arquivo `deploy/nginx/assistant-sse.conf` foi criado com as diretivas recomendadas:

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

O `deploy/nginx/assistant-sse.conf` foi corrigido nesta rodada: o `location` estava solto no nível `http`, e o `nginx -t` recusava o arquivo (`"location" directive is not allowed here`). Agora ele fica dentro de um bloco `server { listen 80; }`, validado com `nginx -t` (`syntax is ok`).

Ambiente da prova:
- Contêiner `nginx:alpine` montando `deploy/nginx/assistant-sse.conf` sem alterações em `conf.d/default.conf`, com porta `8080:80`.
- Servidor SSE de teste (`node:20-alpine`) emitindo 10 eventos `chunk` a cada 300 ms, compartilhando o network namespace do nginx para que o `upstream` `127.0.0.1:3000` alcance o teste.
- Captura com `curl -N` e timestamps em milissegundos gerados pelo cliente; o log do servidor registra o instante de envio de cada evento.

Resultado (cabeçalhos e primeiros eventos; os demais seguem o mesmo padrão):
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

Intervalos observados no cliente entre eventos consecutivos: 300 a 312 ms, batendo com a emissão no servidor (ex.: `seq=8` enviado em `46.399Z`, recebido em `46.402`). Os eventos chegam incrementalmente pelo proxy e não em lote, o que comprova `proxy_buffering off` e a ausência de acúmulo de buffer.

Contêineres de teste removidos ao final com `docker rm -f`.

#### Como repetir a prova
```bash
docker run -d --name nginx-sse-test -p 8080:80 \
  -v "$(pwd)/deploy/nginx/assistant-sse.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:alpine
curl -N -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -X POST http://localhost:8080/api/v1/assistant/spike/stream \
  -d '{"messages":[{"role":"user","content":"Quantos clientes temos?"}],"simulateTool":"count_customers"}' \
  | node -e "require('node:readline').createInterface({input:process.stdin}).on('line',l=>console.log('['+new Date().toISOString().slice(11,23)+'] '+l))"
docker rm -f nginx-sse-test
```
Observação: o `upstream` do conf aponta para `127.0.0.1:3000`. Para repetir o teste é preciso que a API (ou um servidor SSE de teste) escute nessa porta dentro do mesmo network namespace do contêiner, por exemplo com `--network container:nginx-sse-test`. O `date +'%3N'` do macOS não suporta milissegundos, por isso o exemplo usa `node`.

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
