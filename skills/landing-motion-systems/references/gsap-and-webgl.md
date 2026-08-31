# Referência GSAP e WebGL

## Guardrails GSAP

- Registre `ScrollTrigger` uma vez. No React, crie animações com `useGSAP(..., { scope })` para reverter no unmount.
- Use um dono de scroll por timeline. Não aninhe `ScrollTrigger`s filhos dentro de uma timeline controlada por outro trigger.
- Agrupe reveals repetidos em vez de criar um trigger por card.
- Use `gsap.matchMedia()` para desligar motion complexo abaixo do breakpoint escolhido e para reduced motion.
- Use `ScrollTrigger.refresh()` depois de uma mudança significativa de layout, não a cada render.

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

## Guardrails Three.js

- Prefira primeiro uma alternativa CSS ou imagem. Uma cena decorativa não pode ser exigida para entender o conteúdo ou completar uma conversão.
- Faça lazy-load da cena. Limite DPR a `[1, 2]`, vise menos de 100 draw calls e menos de um milhão de triângulos.
- Não sete estado React em `useFrame`; mute refs com delta time. Não aloque vetores no loop de render.
- Respeite reduced motion parando o loop ou trocando para `frameloop='demand'`. Libere texturas, materiais e geometria.
- Ofereça poster/fallback no mesmo aspect ratio para evitar layout shift.
