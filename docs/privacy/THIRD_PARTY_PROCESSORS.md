# Subprocessadores / terceiros

Última revisão técnica: 2026-10-22  
Contratos, SCCs e DPA: `LEGAL_REVIEW_REQUIRED` / `EXTERNAL_REVIEW_REQUIRED`.

| Provedor | Dados enviados | Finalidade | País/região | Retenção do fornecedor | Tipo | Risco |
| --- | --- | --- | --- | --- | --- | --- |
| Render (API, web, landing, Postgres, Redis) | Dados do app, logs, IP | Hospedagem | EUA típico (Render) | Política Render | Infra | ALTO — transferência internacional |
| PostgreSQL (Render) | Inventário completo | Persistência | Idem | Snapshots | Infra | HIGH |
| Redis (Render) | Job IDs, throttle | Fila / rate limit | Idem | AOF | Infra | MEDIUM |
| OpenStreetMap Nominatim / Overpass | Query cidade/categoria; recebe POIs | Descoberta | Instâncias públicas (UE/outros) | Cache do provedor | Dados públicos | HIGH — PII possível em POI |
| Google Places | Query + API key | Descoberta | Google (global) | Política Google | API | HIGH |
| Google Identity | ID token / e-mail Google | Login | Google | Política Google | Auth | MEDIUM |
| Resend / SMTP | E-mail do usuário, link de reset | Transacional | Depende do vendor | Política vendor | E-mail | HIGH |
| AbacatePay | Dados de checkout PIX; webhook | Pagamento | Brasil (verificar contrato) | Política Abacate | PSP | HIGH |
| Asaas | name, cpfCnpj, email, phone | Cartão hospedado | Brasil | Política Asaas | PSP | HIGH |
| Stripe | IDs legado na org | Assinatura antiga | EUA | Política Stripe | PSP legado | HIGH |
| Cloudflare Workers AI | Prompt sanitizado | IA assistida (Opportunity / WhatsApp) | Global / EUA | Não usa dados de clientes para treinar | LLM | MEDIUM |
| Groq | Prompt sanitizado | Reserva de IA assistida | EUA | Logs de abuso até 30 dias; sem treino em API | LLM | MEDIUM |
| Laya (self-host / docker) | State minimizado sem PII | Julgamento e classificação SDR | Local | Processamento em memória | Classificador System 1 | LOW |
| Sentry | Não enviado (stub) | — | — | — | Observability | INFO até ligar SDK |

## Transferência internacional

Infra Render + Google + Cloudflare / Groq + (possivelmente) Resend = tratamento fora do Brasil.  
`LEGAL_REVIEW_REQUIRED`: base art. 33 LGPD, cláusulas contratuais, política de privacidade alinhada.

## IA providers

| Provider | Model (default) | PII no prompt? | Retention | Training | Region | Settings | Risco |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cloudflare Workers AI | `@cf/openai/gpt-oss-120b` (env `AI_MODEL`) | Contacto omitido pelo sanitizer | Efêmero (sem retenção de inferência) | Não usa conteúdo de clientes para treinar | Global (Cloudflare network) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN` | MEDIUM (provedor primário em nuvem) |
| Groq | `openai/gpt-oss-120b` (env `AI_FALLBACK_MODEL`) | Contacto omitido pelo sanitizer | Logs de abuso mantidos por até 30 dias | Não usa chamadas de API para treinar modelos | EUA | `GROQ_API_KEY` | MEDIUM (reserva de fallback) |
| Laya | `multilingual` (env `LAYA_MODEL`) | Não (state minimizado: nome empresa, categoria, cidade/UF, canais booleanos) | Zero (em memória, sem logs de payload) | Não se aplica (modelo não-autoregressivo congelado) | Local (sidecar Docker) | `LAYA_URL`, `LAYA_TIMEOUT_MS` | LOW (inferência 100% interna) |

Não presumir “não treina com os dados” sem contrato.
