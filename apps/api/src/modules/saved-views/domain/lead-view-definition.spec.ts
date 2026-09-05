import { parseLeadViewDefinition } from './lead-view-definition';

describe('parseLeadViewDefinition', () => {
  it('accepts the existing lead list allowlist', () => {
    expect(
      parseLeadViewDefinition({
        q: 'padaria',
        status: 'NEW',
        hasWebsite: false,
        minScore: 40,
        sortBy: 'score',
        sortOrder: 'desc',
      }),
    ).toEqual({
      q: 'padaria',
      status: 'NEW',
      hasWebsite: false,
      minScore: 40,
      sortBy: 'score',
      sortOrder: 'desc',
    });
  });

  it('rejects unknown keys including pagination and nested paths', () => {
    expect(() => parseLeadViewDefinition({ page: 1 })).toThrow('Unknown definition keys: page');
    expect(() => parseLeadViewDefinition({ 'lead.email': 'x' })).toThrow('Unknown definition keys');
    expect(() => parseLeadViewDefinition({ $where: '1=1' })).toThrow('Unknown definition keys');
  });

  it('rejects SQL fragments and non-objects', () => {
    expect(() => parseLeadViewDefinition({ q: 'a; DROP TABLE Lead' })).toThrow(
      'disallowed characters',
    );
    expect(() => parseLeadViewDefinition({ city: 'Lisboa -- comment' })).toThrow(
      'disallowed characters',
    );
    expect(() => parseLeadViewDefinition([])).toThrow('JSON object');
    expect(() => parseLeadViewDefinition(null)).toThrow('JSON object');
  });

  it('rejects invalid enums, scores and ids', () => {
    expect(() => parseLeadViewDefinition({ status: 'NOPE' })).toThrow('status');
    expect(() => parseLeadViewDefinition({ sortBy: 'email' })).toThrow('sortBy');
    expect(() => parseLeadViewDefinition({ minScore: 101 })).toThrow('minScore');
    expect(() => parseLeadViewDefinition({ ownerId: 'not-a-uuid' })).toThrow('ownerId');
    expect(() => parseLeadViewDefinition({ minScore: 80, maxScore: 10 })).toThrow(
      'minScore cannot be greater than maxScore',
    );
  });
});
