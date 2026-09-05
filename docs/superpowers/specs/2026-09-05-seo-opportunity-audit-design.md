# Spec: SEO Opportunity Audit (fatia 1 — auditoria + scores)

> **Status:** APPROVED — em implementação  
> **Data:** 2026-09-05  
> **Branch:** `feat/seo-opportunity-audit`  
> **Módulos:** `apps/api/src/modules/website-analysis`, `packages/shared-types`, `apps/web/src/features/leads`

## 1. Objetivo

Transformar a análise de site de um lead numa auditoria técnica de SEO com:

- **SEO Health Score** 0–100 (100 = perfeito).
- **Opportunity Score** `LOW | MEDIUM | HIGH | CRITICAL` (inverso do health — quanto pior o SEO, maior a oportunidade comercial).
- **Arquitetura detectada** (ex.: `Next.js SSR`, `WordPress`, `React SPA (CSR)`).
- **Findings** ranqueados (top 3 falhas graves) e **quick wins** (≤1h de correção), com diagnóstico, impacto comercial e correção em PT-BR.

Tudo persistido em `WebsiteAnalysis` e visível no detalhe do lead. Sem LLM nesta fatia.

## 2. Decisões

| # | Decisão |
|---|---------|
| D1 | Estender `HttpWebsiteAnalyzer` e `WebsiteAnalysisResult` em vez de criar módulo/fila novos. Mesma fetch, mesmo pipeline SSRF, mesmo processor. |
| D2 | Cálculo do score em função pura `computeSeoAudit(result)` (`seo-audit.ts`), sem I/O. Testável por tabela de casos. |
| D3 | 3 requests auxiliares em paralelo (robots.txt, sitemap.xml, host alternativo www↔sem-www), budget próprio de 5s, body ≤ 64KB, via `assertSafePublicUrl` + `fetchWithPinnedDns`. Redirects de robots/sitemap só são seguidos dentro do mesmo site (host ou variante `www.`); host alternativo pode encadear até 3 hops no próprio host antes de apontar para o principal. Falha ⇒ `unknown`, sem penalidade. Só executam com `includeAuxChecks: true` (o `WebsiteAnalysisService` passa; Opportunity Finder não). |
| D4 | `WebsiteAnalyzer.analyze(url, context?)` recebe `{ city?, state?, includeAuxChecks? }`. Compatível com chamadores existentes (Opportunity Finder chama sem contexto → sinais SEO só do HTML, sem requests extras). |
| D5 | Site inacessível / FAILED ⇒ `seoHealthScore = null`, `seoOpportunity = null` ("não avaliado"). O `LeadScore` já pune site indisponível. |
| D6 | Findings SEO também viram `WebsiteAnalysisIssue` (codes `SEO_*`) para manter a tabela de issues consistente. Codes legados (`NO_HTTPS`, `NOT_RESPONSIVE`, `SLOW`, `NO_META_DESCRIPTION`, `NO_CONTACT_FORM`) permanecem — o scoring depende deles. |
| D7 | Textos dos findings em PT-BR, gerados no backend (catálogo estático). UI não traduz. |
| D8 | `LeadScore`/`ScoreRule` **não** mudam nesta fatia. |
| D9 | Parsing do HTML (até 1,5MB, controlado pelo site alvo) é linear: elementos extraídos por `indexOf`, tags limitadas a 2048 chars. Regressão coberta por teste com payloads hostis (< 1,5s). |

## 3. Fora de escopo (follow-ups)

- Hook de campanha WhatsApp via Ollama com `{{companyName}}`/`{{contactName}}`.
- Regra `POOR_SEO` no `LeadScore`.
- Filtro/ordenação por `seoOpportunity` na lista de leads.
- Renderização com browser headless (Lighthouse/CWV reais). Só heurísticas sobre HTML bruto.
- Validação real de certificado TLS.

## 4. Sinais novos (analyzer)

Todos derivados do HTML principal, exceto onde indicado.

| Sinal | Tipo | Detecção |
|-------|------|----------|
| `renderingMode` | `SSR \| CSR \| STATIC \| UNKNOWN` | `visibleTextLength < 200` **e** mount vazio (`<div id="root\|app\|__next\|__nuxt\|___gatsby\|q-app\|main\|application">` ou `<app-root>` sem filhos além de `<noscript>`) ⇒ `CSR`. Framework detectado ou bundle JS com texto ⇒ `SSR`. Sem framework JS e texto ⇒ `STATIC`. Sem HTML ⇒ `UNKNOWN`. |
| `framework` | string? | `/_next/` ⇒ Next.js; `/_nuxt/` ⇒ Nuxt; `___gatsby` ⇒ Gatsby; `ng-version` ⇒ Angular; `data-v-`/`vue` ⇒ Vue; `react` em src/`data-reactroot` ⇒ React. |
| `visibleTextLength` | number | Tamanho do texto após remover `<script>`, `<style>`, `<noscript>`, tags e whitespace colapsado. |
| `noindex` | boolean | `<meta name="robots" content="...noindex...">`. |
| `canonicalUrl` | string? | `<link rel="canonical" href>`. |
| `h1Count` | number | Ocorrências de `<h1`. |
| `titleLength` / `metaDescriptionLength` | number? | Comprimento em chars. |
| `ogTitle` / `ogImage` | string? | `property="og:title"` / `og:image`. |
| `jsonLdTypes` | string[] | `@type` de cada bloco `application/ld+json` parseável (top-level e `@graph`). |
| `hasMicrodata` | boolean | Atributo `itemscope` presente. |
| `images` | `{ total, missingDimensions, modernFormat, missingAlt }` | `<img>`: sem `width`+`height`; src `.webp`/`.avif`; sem `alt`. |
| `thirdPartyScriptHosts` | string[] | Hosts de `<script src>` com host ≠ host final (dedup, máx. 20). |
| `renderBlockingScripts` | number | `<script src>` dentro de `<head>` sem `async`/`defer`/`type="module"`. |
| `hasAddress` | boolean | CEP `\d{5}-?\d{3}` ou logradouro (`Rua\|Av\.\|Avenida\|Alameda\|Travessa\|Rodovia` + número). |
| `mentionsCity` | boolean? | Cidade do lead (normalizada, sem acento) aparece no texto. `undefined` sem contexto. |
| `hasRobotsTxt` | boolean? | GET `/robots.txt` 200 + texto que não é HTML (soft-404 não conta). *(aux)* |
| `robotsBlocksAll` | boolean? | Bloco `User-agent: *` com `Disallow: /` exato. *(aux)* |
| `hasSitemap` | boolean? | GET `/sitemap.xml` 200 com `<urlset`/`<sitemapindex` **ou** `Sitemap:` no robots. *(aux)* |
| `alternateHostRedirects` | boolean? | Host alternativo (adiciona/remove `www.`) responde 301/302/307/308 para host final. `undefined` se falhar/timeout. *(aux)* |

Campos existentes que passam a ser preenchidos: `framework`, `hasSitemap`, `hasRobotsTxt`.

## 5. Score (`computeSeoAudit`)

Health = `100 − Σ deduções`, com cap por vetor. Cada check falho gera um finding.

| Vetor (cap) | Code | Pts | Severidade | Quick win | Condição |
|-------------|------|-----|------------|-----------|----------|
| Renderização & Indexabilidade (30) | `SEO_CSR_SHELL` | 18 | HIGH | não | `renderingMode === 'CSR'` |
| | `SEO_NOINDEX` | 12 | HIGH | sim | `noindex` |
| | `SEO_ROBOTS_BLOCKS_ALL` | 12 | HIGH | sim | `robotsBlocksAll` |
| | `SEO_THIN_CONTENT` | 6 | MEDIUM | não | `visibleTextLength < 300` e não CSR |
| On-Page & Semântica (30) | `SEO_NO_TITLE` | 8 | HIGH | sim | sem `<title>` |
| | `SEO_TITLE_LENGTH` | 3 | LOW | sim | title fora de 10–60 |
| | `SEO_NO_META_DESCRIPTION` | 6 | MEDIUM | sim | sem description |
| | `SEO_META_DESCRIPTION_LENGTH` | 2 | LOW | sim | fora de 50–160 |
| | `SEO_NO_H1` | 6 | MEDIUM | sim | `h1Count === 0` |
| | `SEO_MULTIPLE_H1` | 3 | LOW | sim | `h1Count > 1` |
| | `SEO_NO_OPEN_GRAPH` | 4 | MEDIUM | sim | sem `og:title` **ou** sem `og:image` |
| | `SEO_NO_STRUCTURED_DATA` | 5 | MEDIUM | não | `jsonLdTypes.length === 0` e sem `itemscope` |
| Performance (20) | `SEO_NO_VIEWPORT` | 8 | HIGH | sim | `!hasViewport` |
| | `SEO_SLOW_RESPONSE` | 6 | MEDIUM | não | `responseTimeMs ≥ 3000` |
| | `SEO_IMAGES_WITHOUT_DIMENSIONS` | 6 | MEDIUM | não | `total ≥ 3` e `missingDimensions / total > 0.5` |
| | `SEO_LEGACY_IMAGE_FORMATS` | 4 | LOW | não | `total ≥ 3` e `modernFormat === 0` |
| | `SEO_RENDER_BLOCKING_SCRIPTS` | 4 | MEDIUM | sim | `renderBlockingScripts ≥ 3` |
| Local & Infra (20) | `SEO_NO_HTTPS` | 10 | HIGH | não | `!https` |
| | `SEO_NO_CANONICAL` | 3 | LOW | sim | sem canonical |
| | `SEO_ALTERNATE_HOST_NOT_REDIRECTED` | 3 | MEDIUM | não | `alternateHostRedirects === false` |
| | `SEO_NO_ROBOTS_TXT` | 2 | LOW | sim | `hasRobotsTxt === false` |
| | `SEO_NO_SITEMAP` | 4 | MEDIUM | sim | `hasSitemap === false` |
| | `SEO_NO_NAP` | 5 | MEDIUM | sim | `!hasPhone \|\| !hasAddress` |

Checks com sinal `undefined` (aux falhou) **não** deduzem.

**Opportunity:** health ≥ 80 ⇒ `LOW`; 60–79 ⇒ `MEDIUM`; 40–59 ⇒ `HIGH`; < 40 ⇒ `CRITICAL`.

**Arquitetura:** `cms` tem prioridade (`WordPress`, `Shopify`, `Wix`); senão `framework` + modo (`Next.js SSR`, `Next.js CSR`, `React SPA (CSR)`, `Angular SPA (CSR)`…); senão `STATIC` ⇒ `HTML estático/servidor`; senão `Desconhecida`.

**Saída:**

```ts
interface SeoAudit {
  healthScore: number;              // 0-100
  opportunity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  architecture: string;
  vectors: Record<SeoVector, { score: number; max: number }>;
  findings: SeoFinding[];           // ordenados por points desc
  topIssues: SeoFinding[];          // 3 primeiros
  quickWins: SeoFinding[];          // quickWin === true, 2 primeiros
  signals: SeoSignals;              // sinais brutos usados no cálculo
}
interface SeoFinding {
  code: string; vector: SeoVector; severity: 'HIGH' | 'MEDIUM' | 'LOW';
  points: number; quickWin: boolean;
  title: string; diagnosis: string; impact: string; fix: string;
}
```

## 6. Persistência

Migration `20260905180000_website_analysis_seo_audit`:

```prisma
enum SeoOpportunityLevel { LOW MEDIUM HIGH CRITICAL }

model WebsiteAnalysis {
  // ...
  seoHealthScore Int?
  seoOpportunity SeoOpportunityLevel?
  architecture   String?
  seoAudit       Json?   // SeoAudit + sinais SEO brutos (SeoSignals)
}
```

`processAnalysis`: se `result.accessible` e há HTML ⇒ grava `computeSeoAudit(result)`; senão `null`. Issues: legados + `findings.map(code, severity→IssueSeverity, title)`. Mapa de severidade: `HIGH → CRITICAL`, `MEDIUM → WARNING`, `LOW → INFO`.

Processor passa `{ city, state }` do lead ao analyzer (select adicional em `processAnalysis`).

## 7. UI

`WebsiteAnalysisPanel` (lead detail → "Análise do site") ganha bloco **SEO & Oportunidade** quando `analysis.seoAudit` existe:

- Score ring `seoHealthScore` + badge opportunity (`Baixo`/`Médio`/`Alto`/`Crítico`) + arquitetura.
- 4 barras por vetor.
- **Sinais de oportunidade**: `topIssues` expansíveis (diagnóstico / impacto / correção).
- **Quick wins**: `quickWins` em lista.

`LeadDetail.websiteRecord.analyses[]` estende com `seoHealthScore`, `seoOpportunity`, `architecture`, `seoAudit`.

## 8. Invariantes

1. `analyze()` nunca lança; falhas auxiliares nunca derrubam a análise principal.
2. Requests auxiliares só para o **mesmo host** (ou variante `www.`) do URL final já validado por SSRF.
3. `computeSeoAudit` é determinística e sem I/O.
4. `healthScore ∈ [0, 100]`; soma por vetor nunca excede o cap.
5. Analyzer continua respeitando `WEBSITE_ANALYSIS_TIMEOUT_MS` para o HTML principal; auxiliares têm 5s próprios em paralelo (tempo total ≤ 10s + 5s).

## 9. Testes

- `seo-audit.spec.ts`: perfeito ⇒ 100/LOW; CSR shell sem meta ⇒ CRITICAL; caps por vetor; `undefined` não deduz; ordenação topIssues/quickWins; arquitetura.
- `http-website-analyzer.spec.ts`: fixtures HTML (Next.js SSR, React CSR shell, HTML estático) ⇒ sinais; robots/sitemap/alternate via `fetchImpl` mock; falha aux ⇒ `undefined`; redirect aux para host externo recusado; sem `includeAuxChecks` ⇒ 1 request; falha após redirect preserva URL do último hop; payloads hostis ⇒ tempo linear.
- `website-analysis.service.spec.ts`: persistência de `seoHealthScore`/`seoOpportunity`/`seoAudit` e issues `SEO_*`; FAILED ⇒ nulls.
- Web: vitest do painel renderiza score/opportunity/topIssues.
