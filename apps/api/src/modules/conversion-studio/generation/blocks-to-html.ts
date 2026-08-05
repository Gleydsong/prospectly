import type { PageBlock } from '../page-blocks.schema';
import { sanitizeLandingHtml } from './html-sanitize';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fallback HTML a partir dos blocos tipados (template / legado).
 */
export function blocksToSimpleHtml(input: {
  title: string;
  companyName: string;
  blocks: PageBlock[];
}): string {
  const sections: string[] = [];

  for (const block of input.blocks) {
    switch (block.type) {
      case 'hero':
        sections.push(`
<header class="site-header">
  <a class="wordmark" href="#inicio" aria-label="${escapeHtml(input.companyName)} — início">${escapeHtml(input.companyName)}</a>
  <a class="header-cta" href="#contato">Contacto</a>
</header>
<section class="hero" id="inicio">
  ${block.imageUrl ? `<div class="hero-media"><img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.imageAlt || input.companyName)}" fetchpriority="high" /></div>` : '<div class="hero-ambient" aria-hidden="true"></div>'}
  <div class="hero-copy">
    <p class="eyebrow">${escapeHtml(input.companyName)}</p>
    <h1>${escapeHtml(block.headline)}</h1>
    ${block.subheadline ? `<p>${escapeHtml(block.subheadline)}</p>` : ''}
    <div class="hero-actions">
      ${block.ctaLabel ? `<a class="cta" href="#contato">${escapeHtml(block.ctaLabel)} <span aria-hidden="true">↗</span></a>` : ''}
      <a class="text-link" href="#sobre">Conhecer a história <span aria-hidden="true">↓</span></a>
    </div>
  </div>
</section>`);
        break;
      case 'rich_text':
        sections.push(`
<section class="about section-reveal" id="sobre">
  <div class="section-label"><span>01</span><span>Sobre</span></div>
  <div class="section-content">
    ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
    <p>${escapeHtml(block.body)}</p>
    ${
      block.bullets?.length
        ? `<ul>${block.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : ''
    }
  </div>
</section>`);
        break;
      case 'gallery':
        sections.push(`
<section class="gallery section-reveal">
  <div class="section-heading"><div class="section-label"><span>02</span><span>Ambiente</span></div>${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}</div>
  <div class="gallery-grid">
    ${block.images
      .map(
        (image) =>
          `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" /><span aria-hidden="true"></span></figure>`,
      )
      .join('')}
  </div>
</section>`);
        break;
      case 'service_card':
        sections.push(`
<section class="service section-reveal">
  <p class="service-index" aria-hidden="true">•</p>
  <div><h3>${escapeHtml(block.title)}</h3><p>${escapeHtml(block.description)}</p></div>
</section>`);
        break;
      case 'testimonials':
        sections.push(`
<section class="testimonials section-reveal">
  <div class="section-label"><span>03</span><span>Quem conhece</span></div>
  ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
  <div class="quote-grid">
  ${block.items
    .map(
      (item) =>
        `<blockquote><p>“${escapeHtml(item.quote)}”</p><cite>${escapeHtml(item.author)}${item.role ? ` <span>— ${escapeHtml(item.role)}</span>` : ''}</cite></blockquote>`,
    )
    .join('')}
  </div>
</section>`);
        break;
      case 'faq':
        sections.push(`
<section class="faq">
  ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
  ${block.items
    .map(
      (item) =>
        `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`,
    )
    .join('')}
</section>`);
        break;
      case 'map_address':
        sections.push(`
<section class="map section-reveal">
  <div><p class="eyebrow">Encontre-nos</p>${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}</div>
  <p>${escapeHtml(block.address)}</p>
</section>`);
        break;
      case 'contact_form':
        sections.push(`
<section class="contact section-reveal" id="contato">
  <div><p class="eyebrow">Vamos conversar</p><h2>${escapeHtml(block.title || 'Contacto')}</h2><p>Conte-nos o que precisa. A equipa entra em contacto em breve.</p></div>
  <form>
    <label>Nome <input name="name" required /></label>
    <label>Email <input type="email" name="email" /></label>
    <label>Telefone <input name="phone" /></label>
    <label>Mensagem <textarea name="message" rows="4"></textarea></label>
    <button type="submit">${escapeHtml(block.submitLabel || 'Enviar')}</button>
  </form>
</section>`);
        break;
      case 'cta_button':
        sections.push(
          `<section class="cta-row section-reveal"><a class="cta" href="#contato">${escapeHtml(block.label)} <span aria-hidden="true">↗</span></a></section>`,
        );
        break;
      case 'footer':
        sections.push(`<footer><a class="wordmark" href="#inicio">${escapeHtml(input.companyName)}</a><p>${escapeHtml(block.text ?? '')}</p></footer>`);
        break;
      default:
        break;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root { color-scheme: dark; --ink:#171915; --paper:#f1efe8; --muted:#9c9d94; --line:rgba(241,239,232,.18); --accent:#c9d956; --max:1200px; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; background:var(--ink); }
    body { margin:0; background:var(--ink); color:var(--paper); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.5; overflow-x:hidden; }
    a { color:inherit; }
    .site-header, section, footer { width:min(100% - 2.5rem, var(--max)); margin-inline:auto; }
    .site-header { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between; padding:1.25rem 0; font-size:.75rem; letter-spacing:.1em; text-transform:uppercase; }
    .wordmark { font-weight:800; text-decoration:none; letter-spacing:-.04em; text-transform:none; font-size:1rem; }
    .header-cta, .text-link { color:var(--paper); font-size:.78rem; text-underline-offset:.3rem; }
    .hero { position:relative; min-height:clamp(620px, 88vh, 850px); display:grid; align-items:end; padding:clamp(1.5rem, 4vw, 4rem); overflow:hidden; border:1px solid var(--line); isolation:isolate; }
    .hero-media, .hero-media::after, .hero-ambient { position:absolute; inset:0; z-index:-1; }
    .hero-media::after { content:""; background:linear-gradient(90deg, rgba(15,17,13,.94) 0%, rgba(15,17,13,.56) 50%, rgba(15,17,13,.14) 100%); }
    .hero-media img { width:100%; height:100%; object-fit:cover; animation:hero-settle 1.1s cubic-bezier(.2,0,0,1) both; }
    .hero-ambient { background:radial-gradient(circle at 70% 35%, #667022 0%, transparent 22%), radial-gradient(circle at 30% 85%, #252b1b 0%, transparent 38%), #171915; }
    .hero-copy { max-width:760px; animation:hero-copy .8s .12s cubic-bezier(.2,0,0,1) both; }
    .eyebrow, .section-label { margin:0 0 1rem; color:var(--accent); font-size:.7rem; font-weight:700; letter-spacing:.15em; text-transform:uppercase; }
    h1,h2,h3 { margin:0; font-family:Georgia, "Times New Roman", serif; font-weight:400; letter-spacing:-.055em; line-height:.95; text-wrap:balance; }
    h1 { max-width:11ch; font-size:clamp(3.5rem, 8.4vw, 8rem); }
    h2 { font-size:clamp(2.5rem, 5vw, 5.5rem); }
    h3 { font-size:clamp(1.75rem, 3vw, 3rem); }
    .hero-copy > p:not(.eyebrow) { max-width:38rem; margin:1.75rem 0 0; color:#e1dfd7; font-size:clamp(1rem, 1.5vw, 1.2rem); }
    .hero-actions { display:flex; flex-wrap:wrap; align-items:center; gap:1.25rem; margin-top:2rem; }
    .cta { display:inline-flex; align-items:center; gap:.8rem; padding:1rem 1.2rem; background:var(--accent); color:#1b1d18; font-size:.78rem; font-weight:800; letter-spacing:.07em; text-decoration:none; text-transform:uppercase; transition:transform 160ms cubic-bezier(.2,0,0,1), background-color 160ms ease; }
    .cta:hover { transform:translateY(-3px); background:#e2f05f; }
    .cta span { font-size:1.15rem; line-height:0; }
    .about, .gallery, .testimonials, .map, .contact { padding-block:clamp(5rem, 12vw, 10rem); }
    .about { display:grid; gap:2rem; border-bottom:1px solid var(--line); }
    .section-label { display:flex; gap:1rem; }
    .section-label span:first-child { color:var(--muted); }
    .section-content { max-width:760px; }
    .section-content > p, .contact > div > p:not(.eyebrow), .map > p { max-width:50ch; margin:1.75rem 0 0; color:var(--muted); font-size:1.08rem; }
    .section-content ul { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:.75rem; margin:2.25rem 0 0; padding:0; list-style:none; }
    .section-content li { padding-top:.9rem; border-top:1px solid var(--line); color:var(--paper); }
    .section-heading { display:grid; gap:2.25rem; margin-bottom:2.5rem; }
    .gallery-grid { display:grid; grid-template-columns:repeat(12, 1fr); gap:.75rem; }
    .gallery-grid figure { grid-column:span 12; position:relative; min-height:300px; margin:0; overflow:hidden; background:#262820; }
    .gallery-grid figure:nth-child(3n+1) { grid-column:span 7; }
    .gallery-grid figure:nth-child(3n+2) { grid-column:span 5; }
    .gallery-grid figure:nth-child(3n) { min-height:440px; }
    .gallery-grid img { display:block; width:100%; height:100%; object-fit:cover; filter:saturate(.82); transition:transform .7s cubic-bezier(.2,0,0,1), filter .4s ease; }
    .gallery-grid figure:hover img { transform:scale(1.045); filter:saturate(1.05); }
    .gallery-grid figure span { position:absolute; inset:0; background:linear-gradient(135deg, transparent 60%, rgba(201,217,86,.24)); pointer-events:none; }
    .service { display:grid; grid-template-columns:2rem 1fr; gap:1rem; padding:2rem 0; border-top:1px solid var(--line); }
    .service:last-of-type { border-bottom:1px solid var(--line); }
    .service-index { margin:0; color:var(--accent); font-size:1.35rem; }
    .service h3 + p { max-width:55ch; margin:1rem 0 0; color:var(--muted); }
    .testimonials h2 { max-width:11ch; margin-bottom:2.5rem; }
    .quote-grid { display:grid; gap:1rem; }
    blockquote { display:flex; min-height:220px; flex-direction:column; justify-content:space-between; margin:0; padding:1.5rem; border:1px solid var(--line); background:#1c1e19; }
    blockquote p { margin:0; font-family:Georgia, "Times New Roman", serif; font-size:clamp(1.4rem, 2.2vw, 2rem); line-height:1.05; letter-spacing:-.035em; }
    cite { margin-top:2rem; color:var(--muted); font-size:.78rem; font-style:normal; }
    cite span { color:#6f716a; }
    .map { display:flex; flex-direction:column; justify-content:space-between; gap:3rem; background:var(--paper); color:var(--ink); padding-inline:clamp(1.5rem, 5vw, 5rem); }
    .map .eyebrow { color:#5c661f; }
    .map > p { color:#56584f; font-family:Georgia, "Times New Roman", serif; font-size:clamp(1.6rem, 3vw, 3rem); line-height:1.05; letter-spacing:-.04em; }
    .contact { display:grid; gap:2.5rem; }
    .contact form { display:grid; gap:1rem; padding:1.2rem; border:1px solid var(--line); background:#1c1e19; }
    label { display:grid; gap:.45rem; color:#d7d5ce; font-size:.78rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    input, textarea, button { width:100%; border:1px solid #56594e; border-radius:0; background:#151712; color:var(--paper); font:inherit; }
    input, textarea { padding:.85rem; transition:border-color 160ms ease, box-shadow 160ms ease; }
    input:focus, textarea:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(201,217,86,.16); outline:0; }
    button { padding:1rem 1.2rem; background:var(--accent); color:var(--ink); cursor:pointer; font-size:.78rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; transition:transform 160ms cubic-bezier(.2,0,0,1), background-color 160ms ease; }
    button:hover { transform:translateY(-2px); background:#e2f05f; }
    a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, summary:focus-visible { outline:3px solid var(--accent); outline-offset:4px; }
    .faq { width:min(100% - 2.5rem, 760px); margin-inline:auto; padding-block:5rem; }
    .faq details { padding:1.25rem 0; border-top:1px solid var(--line); }
    .faq summary { cursor:pointer; font-size:1.1rem; }
    .faq p { color:var(--muted); }
    .cta-row { padding-bottom:5rem; }
    footer { display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem; padding:2rem 0; border-top:1px solid var(--line); color:var(--muted); font-size:.8rem; }
    footer p { margin:0; }
    .section-reveal { animation:section-reveal .7s cubic-bezier(.2,0,0,1) both; animation-timeline:view(); animation-range:entry 8% cover 34%; }
    @keyframes hero-copy { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
    @keyframes hero-settle { from { opacity:.45; transform:scale(1.07); } to { opacity:1; transform:scale(1); } }
    @keyframes section-reveal { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
    @media (min-width:760px) { .about { grid-template-columns:1fr 2fr; } .section-heading { grid-template-columns:1fr 2fr; align-items:end; } .quote-grid { grid-template-columns:repeat(3, 1fr); } .map { flex-direction:row; align-items:end; } .contact { grid-template-columns:1fr 1fr; align-items:start; } }
    @media (prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } *, *::before, *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; transition-duration:.01ms !important; } }
  </style>
</head>
<body>
${sections.join('\n')}
</body>
</html>`;

  return sanitizeLandingHtml(html);
}
