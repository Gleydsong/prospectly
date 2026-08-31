# Runbook operacional do Prospectly

Métricas operacionais privadas: `GET /api/v1/ops/metrics` (header `X-Prospectly-Ops-Token` igual a `OPS_METRICS_TOKEN`, ≥ 32 caracteres). Papéis JWT de tenant **não** são aceitos. Se o token não estiver definido, a rota devolve 404. Nunca exponha esta rota publicamente e nunca coloque stack traces, payloads de lead ou secrets nas respostas públicas de health.

Filas no escopo: `prospecting`, `imports`, `scoring`, `website-analysis`.

## Fila travada

Sintomas:

- `queues.<name>.waiting` ou `delayed` cresce enquanto `active` fica em 0
- Ações do usuário permanecem em `PENDING`/`RUNNING` mais tempo que o usual
- `jobs.<name>.retries` sobe sem `completed`

Ações:

1. Confirme que o processo da API está no ar: `GET /health/live` e `GET /health/ready`.
2. Chame `GET /api/v1/ops/metrics` com `X-Prospectly-Ops-Token` e anote profundidades de fila + contadores recentes de fail/retry.
3. Filtre os logs da API por `correlationId` da requisição HTTP de origem (`x-correlation-id`).
4. Se o Redis estiver saudável mas os workers parecerem ociosos, reinicie o serviço da API (hoje os workers rodam in-process com o HTTP).
5. Para uma pesquisa/importação travada isolada, inspecione o status da entidade no app/DB. Prefira retry controlado pela UI do produto em vez de editar Redis na mão.
6. Evite apagar chaves Redis às cegas — o BullMQ guarda estado de job sob prefixos de fila.

Escale se as profundidades continuarem subindo depois do restart ou se jobs failed acumularem com erros permanentes de provedor.

## Redis fora

Sintomas:

- `GET /health/ready` devolve `503` com `{ "status": "not_ready" }`
- `ops/metrics` reporta `redis.status: "down"` (quando o processo ainda consegue servir o token de ops)
- Caminhos de enqueue/rate-limit falham; jobs param de avançar

Ações:

1. Verifique se a instância Key Value da Render (`prospectly-redis`) está no ar e não esgotada.
2. Confirme `REDIS_URL` no serviço da API e que a política continua `noeviction` (obrigatório para BullMQ).
3. A partir do host/rede da API, teste conectividade com o Redis (somente rede privada).
4. Restaure o Redis antes de forçar retries de job. Quando o Redis voltar, reconfira `health/ready` e as profundidades de fila.
5. Se houve perda de dados num Redis efêmero/recriado, jobs em voo terão sumido — reconcilie pesquisas/importações pendentes a partir do estado no Postgres e redispare pelo app se preciso.

Não troque o Redis para políticas de eviction voláteis.

## Falha de provedor

Sintomas:

- Jobs de prospecção falham com mensagens públicas sanitizadas
- Logs incluem `provider`, `statusCode`, `reason`, `retryable` e `correlationId`
- Falhas permanentes (ex.: Google Places `SERVICE_DISABLED`) param de retentar (`UnrecoverableError`)

Ações:

1. Pegue o `correlationId` no header da resposta do cliente ou no body de erro da API e ache os logs do processor correspondentes.
2. Erros retryable de provedor/rede: espere o backoff do BullMQ; confirme retries em `ops/metrics`.
3. Erros não retryable do Google Places: corrija enablement/IAM da chave no Google Cloud e crie uma pesquisa nova.
4. Rate limits OpenStreetMap/Nominatim: reduza concorrência/volume de busca; confirme que as chaves do rate-limiter no Redis existem.
5. SSRF/timeouts de análise de website são esperados para URLs bloqueadas/inatingíveis — trate como falha no nível do lead, não como outage da plataforma.

Nunca cole payloads crus de provedor, API keys ou PII de lead em tickets/canais públicos.

## Rollback

Use quando um deploy introduzir pico de erros, filas travadas ou regressão de auth/ops.

1. Identifique o deploy ruim na Render (serviço API `prospectly-api`) e o deploy saudável anterior.
2. Faça rollback do serviço da API para o último deploy conhecido como bom. Prefira rolar API + web juntos quando a mudança cruzou a fronteira do cookie de refresh / `withCredentials`.
3. Confirme `GET /health/ready` ready e `GET /api/v1/ops/metrics` (token de ops) com profundidades de fila se recuperando.
4. Observe `http.errors5xx`, job `failed`/`retries` e status do Redis por 10–15 minutos.
5. Se migrations foram aplicadas no release ruim, **não** assuma que rollback de imagem desfaz o schema — siga o guia Prisma / docs de deploy antes de reprocessar jobs.
6. Comunique a janela de impacto e se os usuários devem retentar pesquisas/importações.

## Checagens rápidas

| Checagem | Esperado |
|-------|----------|
| `GET /health` | OK estilo liveness público, sem internos |
| `GET /health/ready` | ready só quando Postgres + Redis respondem |
| `GET /api/v1/ops/metrics` sem `OPS_METRICS_TOKEN` configurado | 404 |
| `GET /api/v1/ops/metrics` com `X-Prospectly-Ops-Token` ausente/errado | 401 |
| `GET /api/v1/ops/metrics` só com JWT de tenant | 401 (ou 404 se o token não estiver definido) |
| `GET /api/v1/ops/metrics` com token de ops correto | JSON com `http`, `jobs`, `queues`, `redis` |
