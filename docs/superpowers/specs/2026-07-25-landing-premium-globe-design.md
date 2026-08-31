# Redesign da landing premium com globo

**Data:** 2026-07-25  
**Status:** Aprovado  
**Escopo:** somente `apps/landing`

## Objetivo

Elevar a landing MVP de uma faixa simples foto/CTA para uma superfície Minimal Spatial SaaS moderna: neutros zinc + acento cobalt, globo WebGL COBE como visual hero e VP mais incisiva sobre dor operacional (copiar do Maps não é prospecção).

## Decisões

| Decisão | Escolha |
|---------|---------|
| Paleta | **A** — Globo manda: zinc/off-white + cobalt; emerald removido |
| Layout hero | Split 50/50: copy à esquerda, globo à direita |
| Ângulo VP | **1** — Dor operacional (Maps manual é lento), mais incisivo |
| Posição do globo | Hero (substitui `hero-street.jpg`) |
| Imagem do problema | Remover `no-website-shop.jpg`; seção só com texto |
| Tech | Globo de partículas WebGL `cobe`, client island |

## Sistema visual

- **Estética:** Minimal Spatial SaaS / soft data-viz (família COBE)
- **Tokens:** `--accent` cobalt `#2563EB` (light) / `#60A5FA` (dark); superfícies zinc
- **Tipografia:** manter Outfit + JetBrains Mono
- **Motion:** fade-in sutil no hero; auto-rotação do globo; respeitar `prefers-reduced-motion` (frame estático / sem rotação)

## Copy (PT)

- Headline: `Copiar lead do Maps` + highlight `não é prospecção.`
- Body: `Prospectly busca o nicho, corta quem já tem site e joga no pipeline. Sem manhã perdida no Maps.`
- Espelho EN com a mesma intenção

## Stack do hero (máx. 4)

1. Wordmark da marca (pequeno)
2. Headline (≤2 linhas)
3. Subtexto (≤20 palavras)
4. CTAs primário + secundário

Sem bullets de sinal dentro do hero. Faixa de confiança fica abaixo.

## Fora de escopo

- Vídeo promo / sync de tema Remotion
- Alinhamento emerald em `apps/web` (follow-up)
- Reescrita completa de FAQ/pricing
- Init Product.md / Design.md (separado)

## Critérios de sucesso

- Primeiro viewport transmite premium e product-led
- Uma cor de acento (cobalt) em toda a landing
- Globo funciona no desktop; degrada com graça em reduced motion / falha WebGL
- Strings PT + EN atualizadas
- `next build` / typecheck passam para `@prospectly/landing`
