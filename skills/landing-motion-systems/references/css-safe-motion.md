# Motion CSS seguro para HTML gerado

- Use keyframes CSS, transitions e `@supports (animation-timeline: view())` para progressive enhancement.
- Mantenha o conteúdo visível por padrão. Um enhancement de reveal nunca deve esconder conteúdo em browsers sem suporte.
- Use `scroll-behavior: smooth` só quando reduced motion o desligar.

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
