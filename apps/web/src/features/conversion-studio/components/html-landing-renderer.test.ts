import { normalizeFormPayload } from './html-landing-renderer';

describe('normalizeFormPayload', () => {
  it('maps Portuguese AI field names to API fields', () => {
    expect(
      normalizeFormPayload({
        nome: 'Ana',
        telefone: '911',
        mensagem: 'Olá',
        email: 'ana@example.com',
      }),
    ).toEqual({
      name: 'Ana',
      email: 'ana@example.com',
      phone: '911',
      message: 'Olá',
      companyWebsite: undefined,
    });
  });
});
