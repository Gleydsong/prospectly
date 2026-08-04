# GSAP and WebGL reference

## GSAP guardrails

- Register `ScrollTrigger` once. In React, create animations with `useGSAP(..., { scope })` so they revert on unmount.
- Use one scroll owner per timeline. Do not nest child `ScrollTrigger`s inside a timeline controlled by another trigger.
- Batch repeated reveals instead of creating a trigger for each card.
- Use `gsap.matchMedia()` to disable complex motion below the chosen breakpoint and for reduced motion.
- Use `ScrollTrigger.refresh()` after a meaningful layout change, not on every render.

```ts
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion) {
  const timeline = gsap.timeline({
    scrollTrigger: { trigger: section, start: 'top 70%', once: true },
    defaults: { duration: 0.55, ease: 'power2.out' },
  });
  timeline.from(title, { y: 24, opacity: 0 }).from(items, { y: 16, opacity: 0, stagger: 0.08 }, '-=0.2');
}
```

## Three.js guardrails

- Prefer a CSS or image alternative first. A decorative scene must not be required to understand content or complete a conversion.
- Lazy-load the scene. Clamp DPR to `[1, 2]`, target fewer than 100 draw calls and fewer than one million triangles.
- Do not set React state in `useFrame`; mutate refs with delta time. Do not allocate vectors in the render loop.
- Respect reduced motion by stopping the loop or switching to `frameloop='demand'`. Release textures, materials, and geometry.
- Provide a poster/fallback in the same aspect ratio to prevent layout shift.

