import { InvalidSavedReportDefinitionError, parseSavedReportDefinition } from './saved-report-definition';

describe('parseSavedReportDefinition', () => {
  it('accepts an allowlisted recorte', () => {
    expect(
      parseSavedReportDefinition({
        period: '30d',
        source: 'GOOGLE_PLACES',
        ownerId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      period: '30d',
      source: 'GOOGLE_PLACES',
      ownerId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rejects an extra field', () => {
    expect(() => parseSavedReportDefinition({ period: '30d', sql: 'select 1' })).toThrow(
      InvalidSavedReportDefinitionError,
    );
  });

  it('rejects all-time period', () => {
    expect(() => parseSavedReportDefinition({ period: 'all' })).toThrow(
      InvalidSavedReportDefinitionError,
    );
  });
});
