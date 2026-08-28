import {
  findBlockedLlmKeys,
  LLM_FORBIDDEN_SENTINEL,
  sanitizeCompanyForLlm,
  sanitizeLlmPayload,
} from './llm-privacy.sanitizer';

describe('LLM privacy sanitizer', () => {
  it('drops contact fields from company payloads', () => {
    const sanitized = sanitizeCompanyForLlm({
      companyName: 'Padaria Central',
      category: 'bakery',
      city: 'Campinas',
      state: 'SP',
      email: 'contato@padaria.example',
      phone: '+5511999999999',
      address: 'Rua A, 10',
      password: LLM_FORBIDDEN_SENTINEL,
    });

    expect(sanitized).toEqual({
      companyName: 'Padaria Central',
      category: 'bakery',
      city: 'Campinas',
      state: 'SP',
    });
    expect(JSON.stringify(sanitized)).not.toContain(LLM_FORBIDDEN_SENTINEL);
    expect(JSON.stringify(sanitized)).not.toContain('contato@padaria.example');
  });

  it('strips blocked keys recursively before an LLM call', () => {
    const sanitized = sanitizeLlmPayload({
      service: 'sites',
      company: { companyName: 'Loja', email: 'a@b.com', phone: '11999999999' },
      password: LLM_FORBIDDEN_SENTINEL,
      nested: { apiKey: 'sk-test', ok: true },
    });

    expect(sanitized).toEqual({
      service: 'sites',
      company: { companyName: 'Loja' },
      nested: { ok: true },
    });
    expect(findBlockedLlmKeys(sanitized)).toEqual([]);
  });
});
