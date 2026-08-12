# AI Opportunity Finder

## Escopo

O recurso vive em **Ferramentas** e transforma um serviço em uma busca priorizada de empresas brasileiras. Ele reutiliza autenticação, tenancy, billing, provedores de prospecção, análise de websites, BullMQ e ingestão de leads já existentes. O país é fixo em `BR`; não existe envio automático de mensagens.

## Fluxo

1. `POST /v1/opportunity-finder/runs` valida serviço, cidade e UF, aplica entitlement e cria uma execução idempotente.
2. O worker gera um perfil estruturado. Se a IA estiver indisponível ou produzir JSON inválido, usa perfil determinístico.
3. Os provedores existentes descobrem e deduplicam até 20 empresas.
4. Websites são analisados com limite de concorrência, timeout, limite de corpo, redirects manuais e validação SSRF.
5. Regras versionadas calculam DNA, score, confiança e completude. A IA nunca altera a pontuação.
6. As cinco melhores recebem uma explicação estruturada; fallback determinístico mantém o fluxo operacional.
7. O usuário revisa evidências e pode salvar manualmente a empresa como lead.

## Persistência e isolamento

- `OpportunityRun`: contexto, status, versões, contadores e erro público.
- `OpportunityCandidate`: snapshot da empresa, evidências, score e explicação.
- `AiRun`: provider/model/prompt, tokens, duração e status; prompts e respostas brutas não são persistidos.
- Todas as leituras HTTP resolvem primeiro a execução por `id + organizationId`.

## Operação

O processo API enfileira; o processo worker consome `opportunity-finder`. Em desenvolvimento sem IA, use `OPPORTUNITY_AI_ENABLED=false`. Falha ao despachar a fila reembolsa de modo idempotente um crédito eventualmente consumido e remove a execução não iniciada.
