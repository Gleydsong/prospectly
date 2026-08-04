/**
 * Runtime-safe distillation of the repository landing skills.
 * The full agent skills live in /skills; this compact capsule is explicitly
 * injected into the local model prompt and stays compatible with HTML sanitization.
 */
export const LANDING_RUNTIME_DESIGN_SKILL = `
## Runtime skill — premium landing direction

Act as an art director, UX designer, and responsive front-end specialist. Make each page visibly specific to the business, its verified facts, and its real photos; never apply a generic dashboard/card template.

### Design method
- Select one coherent direction from the category and imagery: editorial warm, quiet authority, product precision, or expressive poster. Do not mix styles.
- Build a conversion story: outcome-led hero, authentic presentation, offer/process, proof, friction-reduced CTA, and contact.
- Use one dominant visual idea, strong type hierarchy, generous spacing, and a clear primary CTA. Use cards only for comparable choices.
- Build mobile-first: one-column 320–480px layout, deliberate image aspect ratios/crops, 44px touch targets, no horizontal overflow, then enhance at 768px and 1024px.
- Preserve semantic landmarks, heading order, visible keyboard focus, descriptive alt text, and readable contrast.

### Safe motion and scroll
- The output runs in a sandbox that removes scripts. Use CSS only: transform/opacity transitions, restrained hover feedback, and progressive reveal via animation-timeline only as an enhancement.
- Keep content visible without scroll-animation support. Do not use GSAP, Three.js, WebGL, remote fonts, script tags, event handlers, iframes, or external stylesheets.
- Add a complete prefers-reduced-motion fallback that disables animation, transition, and smooth scrolling.

### Quality gate
- Make the business recognizable in the first viewport, keep proof close to the CTA, omit unsupported facts, and ensure a complete conversion path.
- Output a single self-contained, accessible HTML document with CSS in head. Do not output explanations or markdown.
`.trim();
