/**
 * Brief criativo premium para a geração de blocos React Aura.
 */
export const LANDING_PREMIUM_CREATIVE_BRIEF = `
## Creative brief — landing React Aura premium (Prospectly)

You are a senior brand designer creating a structured React Aura landing with the supported PageBlock types.

### Visual north star
- Premium, contemporary, sophisticated, editorial.
- Real establishment photos drive identity (colors, mood, sophistication).
- Strong hierarchy, generous breathing room, refined Portuguese (pt-BR).
- Avoid: dashboard look, excessive cards, generic gradients, stock-photo feel, decorative clutter.
- Never invent phones, emails, hours, social links, or fake reviews.
- If a fact is missing, omit that section elegantly.

### Required narrative arc in blocks
1) Hero: full-bleed photo (photos[0]), business name as h1, category/value prop, primary CTA + secondary anchor
2) Presentation: short authentic narrative + real specialties
3) Gallery: 3–8 real photos from photos[]
4) Services/products: only plausible offerings for the category (no fake prices)
5) Proof: googleReviews when present; map/address when present
6) Contact + closing CTA: form and/or WhatsApp link when phone exists
7) Footer with business name

### Technical block rules
- Return structured PageBlock JSON only; never return HTML, CSS, JavaScript, or Markdown.
- The React renderer provides responsive layout, semantics, and accessible motion.
- Only HTTPS image URLs from the provided photos[]
- Links: https, mailto, tel, or https://wa.me/...
- Contact <form> inputs MUST use English name attributes: name, email, phone, message (visible labels may be pt-BR). Do not use nome/telefone/mensagem as name=.
- Correct pt-BR spelling and accents

### Acceptance bar
- Feels unique to this business
- Photos are the center of the experience
- Complete conversion path
- Ready to publish
`.trim();
