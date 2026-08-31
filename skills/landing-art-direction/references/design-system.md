# Referência de direção de arte da landing

## Escolha uma direção

| Sinal no brief | Direção | Use | Evite |
| --- | --- | --- | --- |
| Craft, comida, wellness, hospitalidade | Editorial quente | Fotografia grande, superfícies táteis, whitespace generoso | Cards/métricas de SaaS e efeitos neon |
| Serviço profissional, B2B, jurídico, saúde | Autoridade quieta | Grid forte, contraste medido, prova perto do CTA | Bounce brincalhão, claims vagos, gradientes em excesso |
| Produto digital, estúdio, tecnologia | Precisão de produto | Visual de interface/produto, fluxos claros, glow contido | Dashboards falsos e charts decorativos |
| Cultura, evento, marca criativa | Pôster expressivo | Tipo bold, crop assimétrico, cor controlada | Sobreposição ilegível ou motion competindo com o texto |

Escolha uma direção. A página pode ter contraste, mas não pode parecer quatro templates misturados.

## Composição responsiva

- 320–479px: uma coluna; largura do CTA fácil de tocar; conteúdo do hero permanece above the fold sem esconder o assunto.
- 480–767px: permita prova ou itens de galeria em duas colunas só quando cada um permanecer legível.
- 768–1023px: introduza hero partido e ritmo editorial mais denso.
- 1024px+: use grid de 12 colunas com max-width, mas preserve a ordem de leitura do mobile.
- Use `clamp()` para tipo e espaçamento. Defina `aspect-ratio` da imagem; use `object-fit: cover` com `object-position` intencional.
- Nunca dependa de hover para uma ação essencial. Mantenha caminhos de teclado e toque equivalentes.

## Gate de qualidade de design

- A empresa é identificável sem ler o rodapé?
- O primeiro viewport declara um resultado e mostra um visual crível?
- Existe uma ação primária óbvia em cada profundidade maior de scroll?
- Prova e contato aparecem antes de o usuário ter de caçá-los?
- Inputs reais continuam verdadeiros, inclusive reviews, preços, locais e dados de contato?
- Em 320px, 768px e 1440px, não há overflow horizontal, texto cortado ou CTA sobreposto?
- A página ainda funciona com imagens lentas, ausentes ou recortadas de outro jeito?
