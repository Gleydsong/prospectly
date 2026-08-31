---
name: landing-output-architecture
description: "Selecionar e implementar o alvo mais seguro de entrega de landing: HTML/CSS standalone, React confiável com shadcn e GSAP, ou Astro com islands. Use quando uma landing gerada por IA precisar de escolha de framework, arquitetura de publicação, fronteiras de componente, restrições de segurança ou trade-offs de performance."
---

# Arquitetura de saída da landing

Escolha o alvo de saída antes de gerar código. Não peça a um modelo não confiável que devolva código de framework executável numa página pública.

## Regra de decisão

| Necessidade | Alvo |
| --- | --- |
| Página gerada pelo tenant, preview/publicação imediata, conteúdo não confiável | HTML e CSS standalone sanitizados |
| Template de produto reutilizável com interações ricas e confiáveis | Template React com shadcn, GSAP e island R3F opcional |
| Site de marketing com rotas content-first e JavaScript mínimo | Template Astro com output estático e islands seletivas |

## Caminho seguro atual

Gere um documento HTML completo com CSS inline. Sanitize, sirva num iframe sandbox e proíba scripts, event handlers, iframes e imports remotos arbitrários. Use só motion CSS progressivo. Este é o default do Conversion Studio porque o conteúdo da página vem de um LLM.

## Caminho de template confiável

Trate source React/Astro como código do repositório, nunca como output arbitrário de LLM. Deixe o LLM escolher um template registrado e fornecer conteúdo estruturado, tokens de design, IDs de asset e opções de motion. O servidor valida esses dados; o build usa só componentes e dependências aprovados.

No React, use shadcn como primitivas acessíveis de propriedade do source, GSAP só dentro de client components com lifecycle seguro, e isole cenas R3F atrás de frontiers lazy. No Astro, mantenha a página estática por padrão e hidrate só a island interativa que precisa de JavaScript.

Leia [references/target-selection.md](references/target-selection.md) antes de propor um framework ou uma migração.
