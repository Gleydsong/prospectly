# CSS-safe motion for generated HTML

- Use CSS keyframes, transitions, and `@supports (animation-timeline: view())` for progressive enhancement.
- Keep content visible by default. A reveal enhancement must never hide content in browsers that do not support it.
- Use `scroll-behavior: smooth` only when it is disabled by reduced motion.

```css
.reveal { opacity: 1; transform: none; }
@supports (animation-timeline: view()) {
  .reveal {
    animation: reveal-up 650ms cubic-bezier(.2,0,0,1) both;
    animation-timeline: view();
    animation-range: entry 10% cover 28%;
  }
}
@keyframes reveal-up { from { opacity: 0; transform: translateY(1.25rem); } }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

