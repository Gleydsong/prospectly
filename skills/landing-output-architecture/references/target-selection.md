# Target selection reference

## Trade-offs

| Target | Strength | Cost | Appropriate now |
| --- | --- | --- | --- |
| HTML + CSS | Secure publishing, instant iframe preview, tiny runtime, no build | Limited to CSS motion; no arbitrary JS | Yes, Conversion Studio default |
| React + shadcn + GSAP | Rich stateful UI, reusable template components, advanced scroll choreography | Client JavaScript, component build/deploy, lifecycle management | Build as a curated template catalog |
| Astro + islands | Excellent content performance, static publishing, choose hydration per component | New build/deploy pipeline; interactive islands still need a framework | Best for Prospectly marketing pages and future static exports |

## Safe architecture for future templates

1. Store a `templateId`, verified content model, visual tokens, and approved motion flags — never raw JSX, Astro, script, package names, or arbitrary URLs from the LLM.
2. Resolve `templateId` on the server to a repository-owned template.
3. Validate images, links, text length, and CTA data before rendering.
4. Build and publish in an isolated worker. Capture desktop/mobile screenshots and run accessibility checks before release.
5. Fall back to static HTML when JavaScript, WebGL, assets, or build output fail.

## shadcn clarification

shadcn is not a runtime CDN and not a framework for generated HTML. It is copied, maintained component source for a React application. Use it in trusted React templates for accessible buttons, dialogs, forms, menus, and tokens; do not request it in a standalone HTML document.

