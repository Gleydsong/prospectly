# Plano: IA para gerar landing completa (Conversion Studio)

> Data: 2026-08-03  
> Branch: `feat/prospectly-conversion-studio`  
> Estado: **planejamento** (sem implementação neste documento)  
> Relacionados:  
> - `docs/superpowers/specs/2026-08-03-prospectly-conversion-studio-boundaries.md`  
> - `docs/superpowers/specs/2026-08-03-prospectly-conversion-studio-architecture.md`

## 1. Problema e objetivo

Hoje a geração a partir do lead usa `defaultBlocksFromLead` (template determinístico). Serve como fallback, mas não entrega a experiência da inspiração: **landing completa, personalizada, “já pronta”**, com copy/estrutura coerente ao negócio.

**Objetivo de produto**

```text
Lead (ou descrição / link Google) → job de IA → blocos validados → página pronta → usuário publica e aloca ao cliente
```

O usuário **não constrói** o site bloco a bloco. Ele:
1. escolhe a origem (lead / descrever / Google),
2. espera a geração,
3. vê a landing,
4. publica e envia ao prospect.

**Não-objetivos (nesta feature)**

- Editor HTML/CSS/JS livre
- Site genérico multi-página (só landing de conversão)
- Envio automático WhatsApp/e-mail
- Chat de refinamento em tempo real (fase 2 deste plano)
- Trocar o contrato de blocos estruturados

## 2. Princípio de segurança (inviolável)

A IA **nunca** grava HTML arbitrário.

Pipeline obrigatório:

```text
Prompt + contexto → LLM (JSON) → parse/sanitize → Zod pageBlocksSchema → assertPublishableBlocks → draftBlocks
```

Se a validação falhar: retry controlado (1–2×) com erro Zod no prompt; se ainda falhar → fallback `defaultBlocksFromLead` + flag `generationMode: TEMPLATE_FALLBACK`.

URLs de imagem/CTA: apenas HTTPS; rejeitar `javascript:`, data URIs suspeitos, hosts não allowlisted se política exigir.

## 3. Decisões de arquitetura

### 3.1 Abordagens avaliadas

| Abordagem | Prós | Contras | Veredito |
|-----------|------|---------|----------|
| A) LLM gera HTML livre | Visual “wow” | Quebra segurança/multi-tenant; XSS; fora do contrato | **Rejeitada** |
| B) LLM gera JSON de blocos (Zod) | Seguro, auditável, reusa renderer | Visual limitado ao design system de blocos | **Escolhida** |
| C) Só templates + fill de slots | Barato, previsível | Pouca personalização | Fallback / FREE |

**Escolha: B**, com C como fallback e plano FREE inicial.

### 3.2 Provider (adapter)

Abstração `LandingGenerationProvider`:

```ts
generateLandingDraft(input: GenerationContext): Promise<unknown> // JSON bruto
```

Implementações:

| Provider | Uso | Notas |
|----------|-----|-------|
| `OllamaProvider` | **Padrão prod + self-host** | Open source; sem API key |
| `OpenAiCompatibleProvider` | Labs / fallback cloud | Opcional via ENV |
| `TemplateProvider` | Fallback / sem cota | Chama `defaultBlocksFromLead` enriquecido |

Config via ENV (sem hardcode de secrets):

- `LANDING_AI_PROVIDER=ollama|openai_compatible|template`
- `LANDING_AI_BASE_URL`
- `LANDING_AI_API_KEY`
- `LANDING_AI_MODEL`
- `LANDING_AI_TIMEOUT_MS` (ex. 60000)
- `LANDING_AI_MAX_TOKENS`

### 3.3 Síncrono vs assíncrono

Geração pode levar 5–40s → **BullMQ job** (mesmo padrão de prospecting/website-analysis).

```text
POST /conversion-pages/generate
  → cria ConversionPage (status DRAFT, generationStatus=QUEUED)
  → enfileira job conversion-landing-generate
  → retorna { pageId, jobId }

Worker:
  → RUNNING → chama provider → valida → grava draftBlocks
  → SUCCEEDED | FAILED (com fallback opcional)

Web:
  → tela “Criando…” (já existe)
  → polling GET /conversion-pages/:id até generationStatus=SUCCEEDED
  → navega /pages/:id/view
```

Não bloquear request HTTP do Nest além de enfileirar.

### 3.4 Modelo de dados (incremental)

Estender `ConversionPage` (migração):

| Campo | Tipo | Uso |
|-------|------|-----|
| `generationStatus` | enum `IDLE\|QUEUED\|RUNNING\|SUCCEEDED\|FAILED` | UX polling |
| `generationMode` | enum `TEMPLATE\|AI_LEAD\|AI_DESCRIBE\|AI_GOOGLE\|TEMPLATE_FALLBACK` | auditoria |
| `generationError` | string? | mensagem segura (sem stack/prompt) |
| `generationStartedAt` / `generationFinishedAt` | DateTime? | métricas |
| `generationPromptVersion` | string? | versionar system prompt |
| `generationInput` | Json? | snapshot sanitizado (sem PII extra desnecessária) |

Opcional futuro: `ConversionGenerationRun` para histórico de tentativas/custo tokens.

Entitlement já previsto: `ai_generations` em `EntitlementService` (hoje = 0 em todos os planos → **definir quotas** na implementação).

Proposta de quotas iniciais:

| Plano | AI gens / ciclo |
|-------|-----------------|
| FREE | **2** (trial) |
| STARTER_MONTHLY | 50 |
| LIFETIME | 300 |

Meter via `UsageLedger` + `UsageMeterKey.ai_generations` (criar no Prisma se ainda não existir chave).
Refine e generate inicial consomem a mesma cota.

## 4. Entradas de geração (as 3 abas)

### 4.1 Lead existente (MVP prioritário)

Contexto montado no server a partir do lead da org:

- `companyName`, `tradeName`, `category`, `segment`, `description`
- `city`, `state`, `address`, `phone`/`whatsapp`, `email`
- `rating`, `reviewCount`, `openingHours` (se houver)
- `websitePresence` (copy cuidadosa: `NO_WEBSITE_REPORTED` ≠ “sem site”)
- notas curtas do lead (truncadas)

Prompt pede landing **do negócio do lead** (site do cliente final), não “proposta Prospectly” genérica.

### 4.2 Descrever (fase 1.1)

Texto livre do usuário (max ~1500 chars) + org locale.

### 4.3 Link do Google (fase 1.2)

1. Validar URL Maps/Business  
2. Reusar dados já importados **ou** enrichment controlado (Places)  
3. Não scrapear HTML arbitrário no worker sem allowlist  
4. Montar `GenerationContext` equivalente ao lead

## 5. Contrato de saída do LLM

Pedidos ao modelo (JSON mode / schema guidance):

```json
{
  "title": "Nome do negócio",
  "themeHint": "barbershop|restaurant|clinic|generic",
  "blocks": [ /* PageBlock[] */ ]
}
```

Regras no system prompt:

- Máx. 40 blocos; IDs UUID v4 gerados **no server** (LLM pode omitir ids → server atribui)
- Estrutura mínima sugerida para “landing completa”:
  1. `hero` (headline = nome; CTA WhatsApp/form)
  2. `rich_text` Sobre
  3. 2–3 `service_card`
  4. `testimonials` (se rating/reviews; senão omitir ou genérico marcado)
  5. `faq` (2–4 itens)
  6. `contact_form`
  7. `map_address` se houver endereço
  8. `footer`
- Tom local (pt-BR / pt-PT conforme i18n org)
- Sem inventar telefone/e-mail que não estejam no contexto
- Sem prometer preços inventados

Pós-processamento server:

1. Injetar/normalizar `id` UUID  
2. Forçar CTA WhatsApp se `phone` no contexto  
3. `parsePageBlocks` + `assertPublishableBlocks`  
4. Truncar strings aos max do Zod  

## 6. UX

### Fluxo gerar

1. `/pages/new` — aba ativa (Lead primeiro)  
2. Gerar → orb “Criando…” (já existe)  
3. Polling status (não abrir editor)  
4. Sucesso → `/pages/:id/view` (landing pronta)  
5. CTA primário: **Publicar para o cliente**

### Falha

- Mensagem clara + “Usar modelo padrão” / “Tentar de novo”  
- Se fallback automático: banner “Gerado com modelo padrão (IA indisponível)”

### Galeria

- Continua “Meus projetos” com preview  
- Badge opcional: `IA` vs `Modelo`

### Fora do MVP de IA

- Sidebar chat “peça qualquer mudança” (fase 2)  
- Upload/foto real automática (fase 3 + storage HTTPS)

## 7. Arquitetura de módulos

```text
apps/api/src/modules/conversion-studio/
  generation/
    landing-generation.service.ts      # orquestra job + validação + fallback
    landing-generation.processor.ts    # BullMQ
    landing-generation.prompts.ts      # system/user prompt versionados
    providers/
      landing-generation.provider.ts   # interface
      ollama.provider.ts
      openai-compatible.provider.ts
      template.provider.ts
    dto/generate-landing.dto.ts
```

Fila: `conversion-landing-generate` registrada em `ConversionStudioModule` + `WorkerModule`.

Web:

- `features/conversion-studio/hooks.ts` → `useGenerateLanding` + poll  
- create page já existente passa a chamar generate em vez de create síncrono “burro”  
- create síncrono template permanece para FREE / fallback

## 8. Fases de implementação

### Fase A — Fundação (1–2 dias)

- [x] Migração `generationStatus` + campos  
- [x] Interface provider + `TemplateProvider`  
- [x] Endpoint `POST /conversion-pages/generate`  
- [x] Job BullMQ + polling no web  
- [x] Entitlement `ai_generations` com quotas reais (FREE=2)  
- [x] Testes: tenant/entitlement regressão

### Fase B — IA lead (2–3 dias)

- [x] `OllamaProvider` + fallback template  
- [x] Prompts v1 + pós-processamento Zod  
- [x] Feature ENV `LANDING_AI_*`  
- [ ] Eval set formal + taxa ≥70% (operacional)

### Fase C — Descrever + Google (2 dias)

- [x] Unlock aba Descrever (API já aceita `describeText`)  
- [x] Unlock aba Google (parser + match CRM + Places opcional)  

### Fase D — Refinamento por chat (**mesmo marco**)

- [x] `POST /conversion-pages/:id/refine`  
- [x] UI split chat | preview  
- [x] Consome a mesma cota `ai_generations`  
- [x] Patch incremental de blocos (`ops`) com fallback full rewrite  
- [x] Histórico curto de instruções no chat

### Fase E — Riqueza visual (paralelo/contínuo)

- [ ] Expandir blocos/renderer (nav, dual CTA no hero, social proof rating)  
- [ ] Assets HTTPS allowlisted / upload futuro  
- [ ] Temas por `themeHint` (tokens CSS, sem CSS arbitrário do LLM)

## 9. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| HTML/XSS via modelo | Só JSON → Zod; sem `dangerouslySetInnerHTML` |
| Alucinação de contacto | Prompt + pós-filtro: só phones/emails do contexto |
| Latência / timeout | Job async + timeout ENV + fallback template |
| Custo API | Quotas por plano + provider Ollama em self-host |
| Qualidade irregular | Prompt versionado + eval set + retry schema |
| Worker down | Mesmo runbook de searches; UI mostra FAILED |
| Spec antiga “sem IA externa” | Este plano **atualiza** a decisão de produto; manter opção `template` |

## 10. Testes e qualidade

- Unit: parse/sanitize, IDs, assertPublishable, fallback  
- Unit provider: mock HTTP, JSON inválido, timeout  
- Integration: generate → job → draftBlocks → GET page  
- Tenant: lead de outra org rejeitado  
- Entitlement: FREE sem cota → 403 com upgrade CTA  
- Golden fixtures: 5 contextos (barbearia, clínica, restaurante, sem telefone, sem cidade)

## 11. Critérios de aceite do produto (MVP IA)

1. A partir de um lead, o usuário gera e vê landing **completa** (hero + serviços + prova/FAQ + contacto) sem abrir o editor.  
2. Conteúdo usa dados reais do lead; não inventa WhatsApp.  
3. Publicar continua o único passo para “alocar” ao cliente (link `/p/:slug`).  
4. FREE continua usável via template se IA estiver desligada/sem cota.  
5. Zero HTML arbitrário persistido.

## 12. Ordem sugerida de PRs

1. `feat(conversion): async generation job + status fields`  
2. `feat(conversion): AI provider adapters + lead prompt v1`  
3. `feat(conversion): unlock describe/google generation tabs`  
4. `feat(conversion): refine-by-chat (mesmo marco)`  

## 13. Decisões fechadas (2026-08-03)

| Pergunta | Decisão |
|----------|---------|
| FREE e IA | **Trial de 2 gerações** (`aiGenerations: 2`); depois só template / upgrade |
| Provider em produção | **Ollama self-host (open source)** como padrão; adapter OpenAI-compatible fica opcional para labs |
| Chat de refine | **Mesmo marco** que IA lead (Fase D não é opcional — entra no mesmo entregável) |

### Quotas revisadas

| Plano | `ai_generations` |
|-------|------------------|
| FREE | **2** (trial) |
| STARTER_MONTHLY | 50 |
| LIFETIME | 300 |

Refine por chat consome a **mesma** cota `ai_generations` (1 instrução = 1 unidade), salvo decisão futura de meter separado.

### Provider padrão

- `LANDING_AI_PROVIDER=ollama` (default em prod)
- `LANDING_AI_BASE_URL` (ex. `http://ollama:11434`)
- `LANDING_AI_MODEL` (ex. `llama3.1` / `qwen2.5` — escolher na Fase B com eval)
- Sem API key obrigatória no caminho Ollama

### Escopo do marco (A→D)

1. Fundação async + status  
2. IA lead via Ollama  
3. Descrever + Google  
4. Chat refine + preview split  

Fora deste marco: assets/foto automática (Fase E parcial ok se não bloquear).

