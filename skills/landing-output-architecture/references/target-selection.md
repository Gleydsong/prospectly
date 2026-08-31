# Referência de escolha de alvo

## Trade-offs

| Alvo | Força | Custo | Adequado agora |
| --- | --- | --- | --- |
| HTML + CSS | Publicação segura, preview imediato em iframe, runtime mínimo, sem build | Limitado a motion CSS; sem JS arbitrário | Sim, default do Conversion Studio |
| React + shadcn + GSAP | UI stateful rica, componentes de template reutilizáveis, coreografia avançada de scroll | JavaScript no client, build/deploy de componentes, gestão de lifecycle | Construir como catálogo curado de templates |
| Astro + islands | Performance excelente de conteúdo, publicação estática, hidratação por componente | Novo pipeline de build/deploy; islands interativas ainda precisam de um framework | Melhor para páginas de marketing do Prospectly e exports estáticos futuros |

## Arquitetura segura para templates futuros

1. Guarde um `templateId`, modelo de conteúdo verificado, tokens visuais e flags de motion aprovadas — nunca JSX cru, Astro, script, nomes de pacote ou URLs arbitrárias vindas do LLM.
2. Resolva `templateId` no servidor para um template de propriedade do repositório.
3. Valide imagens, links, tamanho de texto e dados de CTA antes de renderizar.
4. Faça build e publicação num worker isolado. Capture screenshots desktop/mobile e rode checagens de acessibilidade antes do release.
5. Caia para HTML estático quando JavaScript, WebGL, assets ou output de build falharem.

## Esclarecimento shadcn

shadcn não é um CDN de runtime nem um framework para HTML gerado. É source de componentes copiado e mantido para uma aplicação React. Use-o em templates React confiáveis para botões, dialogs, forms, menus e tokens acessíveis; não o peça num documento HTML standalone.
