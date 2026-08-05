# Landing art-direction reference

## Choose a direction

| Signal in the brief | Direction | Use | Avoid |
| --- | --- | --- | --- |
| Craft, food, wellness, hospitality | Editorial warm | Large photography, tactile surfaces, generous whitespace | SaaS metrics/cards and neon effects |
| Professional service, B2B, legal, health | Quiet authority | Strong grid, measured contrast, proof close to CTA | Playful bounce, vague claims, excessive gradients |
| Digital product, studio, technology | Product precision | Interface/product visual, clear flows, restrained glow | Fake dashboards and decorative charts |
| Culture, event, creative brand | Expressive poster | Bold type, asymmetric crop, controlled colour | Unreadable overlap or motion competing with copy |

Choose one direction. A page can have contrast but must not look like four templates combined.

## Responsive composition

- 320–479px: one column; CTA width is easy to tap; hero content remains above the fold without hiding the subject.
- 480–767px: allow two-up proof or gallery items only when each stays legible.
- 768–1023px: introduce split hero and denser editorial rhythm.
- 1024px+: use a 12-column max-width grid, but preserve the reading order from mobile.
- Use `clamp()` for type and spacing. Define image `aspect-ratio`; use `object-fit: cover` with intentional `object-position`.
- Never depend on hover for an essential action. Keep keyboard and touch paths equivalent.

## Design quality gate

- Is the company identifiable without reading the footer?
- Does the first viewport state an outcome and show a credible visual?
- Is there one obvious primary action at every major scroll depth?
- Do proof and contact appear before the user must hunt for them?
- Do real inputs remain truthful, including reviews, prices, locations, and contact data?
- At 320px, 768px, and 1440px, is there no horizontal overflow, clipped text, or overlapping CTA?
- Does the page still work with images slow, absent, or cropped differently?

