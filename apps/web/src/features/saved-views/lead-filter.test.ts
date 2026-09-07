import { LeadStatus } from '@/types';

import {
  DEFAULT_LEAD_VIEW_COLUMNS,
  definitionFromFilters,
  hydrateLeadListFilters,
  type LeadListFilters,
} from './lead-filter';

function filters(overrides: Partial<LeadListFilters> = {}): LeadListFilters {
  return {
    q: '',
    status: '',
    statusOr: '',
    hasWebsite: '',
    lastContactOp: '',
    lastContactDays: 14,
    layout: 'table',
    columns: [...DEFAULT_LEAD_VIEW_COLUMNS],
    customFilters: [],
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

  it('persists kanban layout and non-default columns', () => {
    expect(
      definitionFromFilters(
        filters({
          status: LeadStatus.NEW,
          layout: 'kanban',
          columns: ['companyName', 'status', 'score'],
        }),
      ),
    ).toEqual({
      status: LeadStatus.NEW,
      layout: 'kanban',
      columns: ['companyName', 'status', 'score'],
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
      layout: 'table',
      columns: [...DEFAULT_LEAD_VIEW_COLUMNS],
      customFilters: [],
      extras: {},
    });
  });

  it('restores kanban layout and columns', () => {
    expect(
      hydrateLeadListFilters({
        hasWebsite: false,
        layout: 'kanban',
        columns: ['companyName', 'status'],
      }),
    ).toMatchObject({
      hasWebsite: 'no',
      layout: 'kanban',
      columns: ['companyName', 'status'],
    });
  });

  it('round-trips a custom field column and number filter', () => {
    const fieldId = '11111111-1111-4111-8111-111111111111';
    const definition = definitionFromFilters(
      filters({
        columns: ['companyName', fieldId],
        customFilters: [{ fieldId, op: 'gte', value: 10 }],
      }),
    );
    expect(definition).toEqual({
      filter: {
        op: 'and',
        nodes: [{ field: `custom:${fieldId}`, op: 'gte', value: 10 }],
      },
      columns: ['companyName', fieldId],
    });
    expect(hydrateLeadListFilters(definition)).toMatchObject({
      columns: ['companyName', fieldId],
      customFilters: [{ fieldId, op: 'gte', value: 10 }],
    });
  });
});
