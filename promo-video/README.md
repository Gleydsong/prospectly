# Prospectly Promo Video (Remotion)

Vídeo comercial ~40s (1920×1080 @ 30fps) demonstrando o Prospectly.

## Pré-requisitos

Serviços locais rodando:

- Landing: `http://127.0.0.1:3001`
- Web app: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`

Conta demo: `demo@prospectly.dev` / `Demo123!`

## Tutoriais de cadastro

```bash
npm run capture              # inclui screenshots de /register
npm run render:howto-account # → out/como-criar-conta.mp4
npm run render:free-account  # → out/criar-conta-gratis.mp4
npm run render:signup        # renderiza os dois
```

Composições: `HowToCreateAccount` e `CreateFreeAccount`.

## Vídeo de preços

```bash
npm run render:pricing   # → out/precos.mp4
```

Composição: `PricingPromo` — motion graphics do Starter (mensal, vitalício e moedas).

## Product demo (landing hero)

Loop light-theme do fluxo Defina → Encontre → Organize (1280×720, 12s).

```bash
npm run render:product-demo   # → out/product-demo-flow.mp4
# copiar para apps/landing/public/videos/
```

Composição: `ProductDemoFlow`. Tokens em `src/config/light-theme.ts`.

## Estrutura

- `src/config/` — dimensões, cores, timing, assets
- `src/components/` — Logo, BrowserChrome, Callout, Cursor
- `src/scenes/` — Intro, Landing, Demo, Outro
- `scripts/capture.ts` — captura Playwright
- Composição principal: `ProspectlyPromo`
- Composições de teste: pasta `Test-Scenes`
