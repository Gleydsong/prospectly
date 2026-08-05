import { normalizePublicFormFields } from './normalize-public-form';

describe('normalizePublicFormFields', () => {
  it('maps Portuguese AI form field names to canonical keys', () => {
    expect(
      normalizePublicFormFields({
        nome: 'Ana Silva',
        telefone: '+351912345678',
        mensagem: 'Quero agendar',
        email: 'ana@example.com',
      }),
    ).toEqual({
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '+351912345678',
      message: 'Quero agendar',
      companyWebsite: undefined,
    });
  });

  it('prefers canonical English keys when both are present', () => {
    expect(
      normalizePublicFormFields({
        name: 'Canonical',
        nome: 'Alias',
        phone: '111',
        celular: '222',
      }),
    ).toEqual({
      name: 'Canonical',
      email: undefined,
      phone: '111',
      message: undefined,
      companyWebsite: undefined,
    });
  });

  it('matches accented and spaced keys', () => {
    expect(
      normalizePublicFormFields({
        'Seu Nome': 'João',
        'e-mail': 'j@example.com',
        Telemóvel: '999',
        Comentário: 'Olá',
      }),
    ).toEqual({
      name: 'João',
      email: 'j@example.com',
      phone: '999',
      message: 'Olá',
      companyWebsite: undefined,
    });
  });
});
