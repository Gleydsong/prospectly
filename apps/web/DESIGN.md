# Design da web Prospectly

## Theme
- Light (principal): cinza-gelo `#F1F2F4`, superfícies brancas, acento índigo-violeta
- Dark: mesmos tokens semânticos com valores escuros coerentes

## Color
- Accent / primary: **índigo** (`--brand: #676FD6` → `--brand-hover: #5B63C9`)
- Texto: `--ink` `#1A1D26`, `--ink-secondary` `#5B6472` (WCAG), `--ink-muted` `#8B93A0` (ícones / placeholders)
- Superfícies: `--bg-app`, `--bg-sidebar`, `--bg-surface`, `--bg-subtle`, `--bg-nav-active`
- Semânticos: success mint, warning ouro, teal fechado, slate neutro
- Evitar: glass, gradientes decorativos, noise, halos, CTA grafite, azul cobalto como primária

## Typography
- Família única: **Inter** (400–700)
- H1 páginas: ~24–28px semibold / tight tracking
- Body: 14px regular, `ink-secondary`
- Labels: 13–14px medium

## Components
- Controles: radius 10px, altura mínima 44px no chrome
- Cards: radius 12px, hairline, sombra `0 1px 2px rgb(16 24 40 / 0.06)`
- Painéis: radius 16px
- Pills: 999px
- Inputs: `.field-control` — borda `--border-default`, fundo `--bg-surface`
- Buttons: `primary` = índigo sólido; `outline`/`secondary` = flat
- Nav ativa: `--bg-nav-active`
- Kanban: header sólido + well pastel por estágio

## Shell
- Sidebar ~220px + topbar 56–64px
- Workspace ocupa a largura restante (sem `max-width: 1200px`)
- Mobile: sidebar vira drawer (botão, backdrop, Escape)
- Desktop: ícone no aside esconde a barra; a topbar reabre

## Motion
- Theme toggle: View Transition máscara radial ~720ms
- Reduced motion: troca instantânea
