import {
  listTemplateVariables,
  renderTemplate,
  validateTemplateVariables,
} from './template-variables';

describe('template-variables', () => {
  it('lists variables used in subject and body', () => {
    expect(listTemplateVariables('Olá {{contactName}} da {{companyName}}')).toEqual([
      'contactName',
      'companyName',
    ]);
  });

  it('rejects unknown variables', () => {
    const result = validateTemplateVariables('Oi {{evil}} e {{companyName}}');
    expect(result.valid).toBe(false);
    expect(result.unknown).toEqual(['evil']);
  });

  it('renders only safe variables without evaluating expressions', () => {
    const result = renderTemplate('Olá {{ contactName }}, empresa {{companyName}} — {{unknownVar}}', {
      contactName: 'Ana',
      companyName: 'Padaria Sol',
    });
    expect(result.rendered).toBe('Olá Ana, empresa Padaria Sol — {{unknownVar}}');
    expect(result.unknown).toEqual(['unknownVar']);
    expect(result.missing).toEqual([]);
  });

  it('reports missing values without inventing content', () => {
    const result = renderTemplate('{{companyName}} / {{city}}', { companyName: 'ACME' });
    expect(result.rendered).toBe('ACME / {{city}}');
    expect(result.missing).toEqual(['city']);
  });

  it('does not execute injected code-like placeholders', () => {
    const result = renderTemplate('{{constructor}} {{__proto__}} {{companyName}}', {
      companyName: 'Safe Co',
    });
    expect(result.rendered).toContain('{{constructor}}');
    expect(result.rendered).toContain('{{__proto__}}');
    expect(result.rendered).toContain('Safe Co');
  });
});
