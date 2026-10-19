# Design da web Prospectly

Identidade aprovada em ID-01, ID-02 e ID-03 (issues #356, #359 e #361).

## Theme e cores

- Ações primárias: cobalto `#2563EB`, hover `#1D4ED8`, texto branco.
- Dia: fundo `#F4F6FB`, superfície `#FFFFFF`, raised `#EEF2F8`, borda `#DCE3EE`, texto `#0F172A`, secundário `#475569`, soft `#E6EFFF`, acento de texto `#1D4ED8`.
- Noite: fundo `#0F172A`, superfície `#172237`, raised `#213149`, borda `#31435D`, texto `#F8FAFC`, secundário `#B6C4D9`, soft `#1E3A67`, acento de texto `#93BFFF`.
- `src/lib/lead-status-colors.ts` centraliza as 12 paletas de pills/pins; pills noturnas usam 16% de opacidade e texto claro da família correspondente. `applyThemeClass` instala as variáveis por tema.
- Símbolo oficial: cópia intacta de `apps/landing/public/brand/prospectly-mark.png`, inclusive no favicon.

## Tipografia e forma

- Outfit 400–700 para títulos e interface, JetBrains Mono 400–600 para dados.
- Fontes locais via Fontsource, sem requisições Google Fonts.
- Cards e painéis: raio 16 px; controles: 10 px; pills: 999 px.
- Sombras leves no tema Dia, hairlines em ambos os temas.

## Tema e movimento

- Chave sol/lua no cabeçalho, 84 × 40 px, estado exposto como switch acessível.
- A feature `theme` mantém persistência, classes HTML e View Transition radial de 720 ms.
- `prefers-reduced-motion` troca o tema instantaneamente e desativa animações.
- Navegação e composição das páginas pertencem a outras issues.
