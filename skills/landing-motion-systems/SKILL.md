---
name: landing-motion-systems
description: Projetar motion e sistemas de scroll acessíveis e performáticos em landing. Use quando a página precisar de animação CSS, timelines GSAP ou ScrollTrigger, cenas Three.js ou React Three Fiber, coreografia de interação, suporte a reduced-motion ou revisão de performance de motion.
---

# Sistemas de motion da landing

Faça o motion esclarecer hierarquia, progresso e feedback. Motion não é decoração para aplicar em tudo.

## Escolha o motor de motion

- Use CSS para hover, foco, entrada simples e reveals progressivos pequenos.
- Use GSAP + ScrollTrigger só para narrativas sequenciadas, painéis pinned, storytelling horizontal ou stagger distribuído que o CSS não expressa com clareza.
- Use Three.js só quando um objeto 3D comunica valor de produto melhor que imagem, SVG, Canvas ou `transform3d`.
- Num host React, use `@gsap/react` com cleanup no escopo; use React Three Fiber para cena declarativa.
- Num renderer HTML gerado em sandbox, use só CSS. Nunca emita tags script ou imports remotos de biblioteca a partir de um LLM.

## Contrato de motion

1. Nomeie o propósito do usuário em cada animação: orientar, revelar, confirmar, conectar ou deleitar.
2. Anime só `transform` e `opacity` em UI rotineira. Use 100–150ms para hover/foco e 200–500ms para transições de UI.
3. Movimento sincronizado com scroll deve ser linear; use `ease: 'none'` nas animações de container GSAP.
4. Implemente `prefers-reduced-motion`; renderize o estado final sem pin de scroll, autoplay, parallax ou motion em loop.
5. Mantenha Canvas/WebGL decorativo inacessível a leitores de tela e ofereça fallback estático em devices sem suporte ou de baixa potência.
6. Limpe todo ScrollTrigger, timeline, observer, recurso WebGL e listener no unmount.

## Revisar antes de publicar

- Motion nunca atrasa a mensagem primária ou o CTA.
- Scroll continua usável com teclado, toque, reduced motion e device lento.
- Nenhuma propriedade de layout é animada e nenhum update de estado roda a cada frame.
- A página mobile não depende de cenas pinned, texturas pesadas ou bundle JS grande.

Leia [references/gsap-and-webgl.md](references/gsap-and-webgl.md) quando a saída escolhida for um template React/JavaScript confiável. Leia [references/css-safe-motion.md](references/css-safe-motion.md) para HTML gerado standalone.
