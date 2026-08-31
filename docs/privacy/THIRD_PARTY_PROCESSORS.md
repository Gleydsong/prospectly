# Subprocessadores / terceiros

Última revisão técnica: 2026-08-28  
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
| Ollama (self-host / docker) | Prompt sanitizado | IA assistida | Onde o processo roda | Local | LLM | MEDIUM se local; HIGH se URL externa |
| Sentry | Não enviado (stub) | — | — | — | Observability | INFO até ligar SDK |

## Transferência internacional

Infra Render + Google + (possivelmente) Resend = tratamento fora do Brasil.  
`LEGAL_REVIEW_REQUIRED`: base art. 33 LGPD, cláusulas contratuais, política de privacidade alinhada.

## IA providers

| Provider | Model (default) | PII no prompt? | Retention | Training | Region | Settings | Risco |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ollama | `qwen3:8b` (env) | Contacto omitido pelo sanitizer | Não persistimos prompt | `EXTERNAL_REVIEW_REQUIRED` se não for local | `OPPORTUNITY_AI_BASE_URL` / WhatsApp URL | timeout + optional API key | HIGH se apontar para cloud sem DPA |

Não presumir “não treina com os dados” sem contrato.
