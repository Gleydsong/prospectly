import { LeadStatus } from '@/types';

import { definitionFromFilters, hydrateLeadListFilters, type LeadListFilters } from './lead-filter';

function filters(overrides: Partial<LeadListFilters> = {}): LeadListFilters {
  return {
    q: '',
    status: '',
    statusOr: '',
    hasWebsite: '',
    lastContactOp: '',
    lastContactDays: 14,
    extras: {},
    ...overrides,
  };
}

describe('definitionFromFilters', () => {
  it('keeps a flat definition when there is no OR and no relative time', () => {
    expect(
      definitionFromFilters(
        filters({
          q: 'padaria',
          status: LeadStatus.NEW,
          hasWebsite: 'no',
          extras: { city: 'Lisboa' },
        }),
      ),
    ).toEqual({
      q: 'padaria',
      status: LeadStatus.NEW,
      hasWebsite: false,
      city: 'Lisboa',
    });
  });

  it('persists status OR and relative last contact as an AST', () => {
    expect(
      definitionFromFilters(
        filters({
          status: LeadStatus.NEW,
          statusOr: LeadStatus.QUALIFIED,
          hasWebsite: 'no',
          lastContactOp: 'older_than',
          lastContactDays: 14,
          extras: { city: 'Lisboa' },
        }),
      ),
    ).toEqual({
      filter: {
        op: 'and',
        nodes: [
          {
            op: 'or',
            nodes: [
              { field: 'status', op: 'eq', value: LeadStatus.NEW },
              { field: 'status', op: 'eq', value: LeadStatus.QUALIFIED },
            ],
          },
          { field: 'hasWebsite', op: 'eq', value: false },
          { field: 'city', op: 'eq', value: 'Lisboa' },
          { field: 'lastContactAt', op: 'older_than', days: 14 },
        ],
      },
    });
  });
});

describe('hydrateLeadListFilters', () => {
  it('restores OR status and last-contact controls from an AST', () => {
    expect(
      hydrateLeadListFilters({
        filter: {
          op: 'and',
          nodes: [
            {
              op: 'or',
              nodes: [
                { field: 'status', op: 'eq', value: LeadStatus.NEW },
                { field: 'status', op: 'eq', value: LeadStatus.QUALIFIED },
              ],
            },
            { field: 'hasWebsite', op: 'eq', value: false },
            { field: 'lastContactAt', op: 'older_than', days: 14 },
          ],
        },
      }),
    ).toEqual({
      q: '',
      status: LeadStatus.NEW,
      statusOr: LeadStatus.QUALIFIED,
      hasWebsite: 'no',
      lastContactOp: 'older_than',
      lastContactDays: 14,
      extras: {},
    });
  });
});
