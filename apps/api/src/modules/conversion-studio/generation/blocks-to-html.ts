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
<section class="hero">
  ${block.imageUrl ? `<img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.imageAlt || input.companyName)}" />` : ''}
  <div class="hero-copy">
    <h1>${escapeHtml(block.headline)}</h1>
    ${block.subheadline ? `<p>${escapeHtml(block.subheadline)}</p>` : ''}
    ${block.ctaLabel ? `<a class="cta" href="#contato">${escapeHtml(block.ctaLabel)}</a>` : ''}
  </div>
</section>`);
        break;
      case 'rich_text':
        sections.push(`
<section class="about">
  ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
  <p>${escapeHtml(block.body)}</p>
  ${
    block.bullets?.length
      ? `<ul>${block.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : ''
  }
</section>`);
        break;
      case 'gallery':
        sections.push(`
<section class="gallery">
  ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
  <div class="gallery-grid">
    ${block.images
      .map(
        (image) =>
          `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" /></figure>`,
      )
      .join('')}
  </div>
</section>`);
        break;
      case 'service_card':
        sections.push(`
<section class="service">
  <h3>${escapeHtml(block.title)}</h3>
  <p>${escapeHtml(block.description)}</p>
</section>`);
        break;
      case 'testimonials':
        sections.push(`
<section class="testimonials">
  ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
  ${block.items
    .map(
      (item) =>
        `<blockquote><p>${escapeHtml(item.quote)}</p><cite>${escapeHtml(item.author)}${item.role ? ` — ${escapeHtml(item.role)}` : ''}</cite></blockquote>`,
    )
    .join('')}
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
<section class="map">
  ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
  <p>${escapeHtml(block.address)}</p>
</section>`);
        break;
      case 'contact_form':
        sections.push(`
<section class="contact" id="contato">
  <h2>${escapeHtml(block.title || 'Contacto')}</h2>
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
          `<section class="cta-row"><a class="cta" href="#contato">${escapeHtml(block.label)}</a></section>`,
        );
        break;
      case 'footer':
        sections.push(`<footer><p>${escapeHtml(block.text ?? '')}</p></footer>`);
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
    :root { color-scheme: light; --bg:#0b0b0c; --fg:#f5f5f4; --muted:#a1a1aa; --accent:#d97706; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Georgia, "Times New Roman", serif; background:var(--bg); color:var(--fg); line-height:1.55; }
    section, footer { padding: 3rem 1.25rem; max-width: 960px; margin: 0 auto; }
    .hero { display:grid; gap:1.5rem; }
    .hero img { width:100%; max-height:420px; object-fit:cover; border-radius:8px; }
    h1,h2,h3 { font-weight:600; letter-spacing:-0.02em; }
    p, li, cite { color: var(--muted); }
    .cta { display:inline-block; margin-top:1rem; padding:0.85rem 1.25rem; background:var(--accent); color:#111; text-decoration:none; font-family: system-ui, sans-serif; font-weight:600; }
    .gallery-grid { display:grid; gap:0.75rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .gallery-grid img { width:100%; height:160px; object-fit:cover; border-radius:6px; }
    form { display:grid; gap:0.75rem; }
    input, textarea, button { font: inherit; padding:0.7rem 0.85rem; border-radius:6px; border:1px solid #3f3f46; background:#18181b; color:var(--fg); }
    button { background:var(--accent); color:#111; border:none; font-family: system-ui, sans-serif; font-weight:600; cursor:pointer; }
    @media (min-width: 800px) { .hero { grid-template-columns: 1.2fr 1fr; align-items:center; } }
  </style>
</head>
<body>
${sections.join('\n')}
</body>
</html>`;

  return sanitizeLandingHtml(html);
}
