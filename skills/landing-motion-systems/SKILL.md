---
name: landing-motion-systems
description: Design accessible, performant landing-page motion and scroll systems. Use when a landing needs CSS animation, GSAP timelines or ScrollTrigger, Three.js or React Three Fiber scenes, interaction choreography, reduced-motion support, or motion performance review.
---

# Landing Motion Systems

Make motion clarify hierarchy, progress, and feedback. Motion is not decoration to apply everywhere.

## Select the motion engine

- Use CSS for hover, focus, simple entrance, and small progressive reveals.
- Use GSAP plus ScrollTrigger only for sequenced narratives, pinned panels, horizontal storytelling, or distributed stagger that CSS cannot express clearly.
- Use Three.js only when a 3D object communicates product value better than image, SVG, Canvas, or `transform3d`.
- In a React host, use `@gsap/react` with scoped cleanup; use React Three Fiber for a declarative scene.
- In a sandboxed generated HTML renderer, use CSS only. Never emit script tags or remote library imports from an LLM.

## Motion contract

1. Name the user purpose for every animation: orient, reveal, confirm, connect, or delight.
2. Animate only `transform` and `opacity` for routine UI. Use 100–150ms for hover/focus and 200–500ms for UI transitions.
3. Make scroll-synced movement linear; use `ease: 'none'` on GSAP container animations.
4. Implement `prefers-reduced-motion`; render the final state without scroll pinning, autoplay, parallax, or looping motion.
5. Keep decorative Canvas/WebGL inaccessible to screen readers and provide a static fallback for unsupported or low-power devices.
6. Clean up every ScrollTrigger, timeline, observer, WebGL resource, and listener on unmount.

## Review before shipping

- Motion never delays the primary message or CTA.
- Scroll remains usable with keyboard, touch, reduced motion, and a slow device.
- No layout property is animated and no state update runs every frame.
- The mobile page does not depend on pinned scenes, heavy textures, or a large JS bundle.

Read [references/gsap-and-webgl.md](references/gsap-and-webgl.md) when the chosen output is a trusted React/JavaScript template. Read [references/css-safe-motion.md](references/css-safe-motion.md) for standalone generated HTML.

