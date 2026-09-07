import { CustomFieldType } from '@prisma/client';

import { assertCustomFieldFilter, compileLeadFilter, parseLeadFilter } from './lead-filter-ast';

const now = new Date('2026-09-05T12:00:00.000Z');
const NUMBER_FIELD = '11111111-1111-4111-8111-111111111111';
const DATE_FIELD = '22222222-2222-4222-8222-222222222222';
const TEXT_FIELD = '33333333-3333-4333-8333-333333333333';
const UNKNOWN_FIELD = '99999999-9999-4999-8999-999999999999';

describe('parseLeadFilter', () => {
  it('accepts nested AND/OR of allowlisted leaves', () => {
    expect(
      parseLeadFilter({
        op: 'and',
        nodes: [
          { field: 'city', op: 'eq', value: 'Lisboa' },
          {
            op: 'or',
            nodes: [
              { field: 'status', op: 'eq', value: 'NEW' },
              { field: 'status', op: 'eq', value: 'QUALIFIED' },
            ],
          },
          { field: 'lastContactAt', op: 'older_than', days: 14 },
        ],
      }),
    ).toEqual({
      op: 'and',
      nodes: [
        { field: 'city', op: 'eq', value: 'Lisboa' },
        {
          op: 'or',
          nodes: [
            { field: 'status', op: 'eq', value: 'NEW' },
            { field: 'status', op: 'eq', value: 'QUALIFIED' },
          ],
        },
        { field: 'lastContactAt', op: 'older_than', days: 14 },
      ],
    });
  });

  it('rejects unknown fields, SQL and too much nesting', () => {
    expect(() => parseLeadFilter({ field: 'email', op: 'eq', value: 'a@b.c' })).toThrow(
      'Unknown filter field',
    );
    expect(() => parseLeadFilter({ field: 'city', op: 'eq', value: 'Lisboa; drop' })).toThrow(
      'disallowed characters',
    );
    expect(() =>
      parseLeadFilter({
        op: 'and',
        nodes: [
          {
            op: 'or',
            nodes: [
              {
                op: 'and',
                nodes: [{ op: 'or', nodes: [{ field: 'city', op: 'eq', value: 'X' }] }],
              },
            ],
          },
        ],
      }),
    ).toThrow('depth');
  });

  it('rejects relative time outside 1–365 days', () => {
    expect(() => parseLeadFilter({ field: 'lastContactAt', op: 'older_than', days: 0 })).toThrow(
      'days',
    );
    expect(() => parseLeadFilter({ field: 'createdAt', op: 'within', days: 366 })).toThrow('days');
  });

  it('rejects empty groups, mixed group/leaf nodes and tenant fields', () => {
    expect(() => parseLeadFilter({ op: 'and', nodes: [] })).toThrow('empty');
    expect(() =>
      parseLeadFilter({
        op: 'and',
        field: 'city',
        nodes: [{ field: 'city', op: 'eq', value: 'X' }],
      }),
    ).toThrow('both a group and a leaf');
    expect(() => parseLeadFilter({ field: 'organizationId', op: 'eq', value: 'org-1' })).toThrow(
      'Unknown filter field',
    );
  });

  it('accepts custom field leaves keyed by definition id', () => {
    expect(parseLeadFilter({ field: `custom:${NUMBER_FIELD}`, op: 'gte', value: 10 })).toEqual({
      field: `custom:${NUMBER_FIELD}`,
      op: 'gte',
      value: 10,
    });
    expect(parseLeadFilter({ field: `custom:${DATE_FIELD}`, op: 'older_than', days: 14 })).toEqual({
      field: `custom:${DATE_FIELD}`,
      op: 'older_than',
      days: 14,
    });
    expect(parseLeadFilter({ field: `custom:${TEXT_FIELD}`, op: 'eq', value: 'Acme' })).toEqual({
      field: `custom:${TEXT_FIELD}`,
      op: 'eq',
      value: 'Acme',
    });
  });

  it('rejects contains and other unknown ops on custom fields', () => {
    expect(() =>
      parseLeadFilter({ field: `custom:${TEXT_FIELD}`, op: 'contains', value: 'Ac' }),
    ).toThrow('contains');
    expect(() => parseLeadFilter({ field: `custom:${NUMBER_FIELD}`, op: 'gt', value: 10 })).toThrow(
      'eq, gte, lte, older_than or within',
    );
  });
});

describe('compileLeadFilter', () => {
  it('compiles city AND (status OR status) AND stale last contact', () => {
    const node = parseLeadFilter({
      op: 'and',
      nodes: [
        { field: 'city', op: 'eq', value: 'Lisboa' },
        {
          op: 'or',
          nodes: [
            { field: 'status', op: 'eq', value: 'NEW' },
            { field: 'status', op: 'eq', value: 'QUALIFIED' },
          ],
        },
        { field: 'lastContactAt', op: 'older_than', days: 14 },
      ],
    });

    expect(compileLeadFilter(node, now)).toEqual({
      AND: [
        { city: { equals: 'Lisboa', mode: 'insensitive' } },
        {
          OR: [{ status: 'NEW' }, { status: 'QUALIFIED' }],
        },
        {
          OR: [
            { lastContactAt: { lt: new Date('2026-08-22T12:00:00.000Z') } },
            { lastContactAt: null },
          ],
        },
      ],
    });
  });

  it('compiles within as a lower bound without nulls', () => {
    const node = parseLeadFilter({ field: 'createdAt', op: 'within', days: 7 });
    expect(compileLeadFilter(node, now)).toEqual({
      createdAt: { gte: new Date('2026-08-29T12:00:00.000Z') },
    });
  });

  it('compiles number gte as a JSON path lower bound', () => {
    const node = parseLeadFilter({ field: `custom:${NUMBER_FIELD}`, op: 'gte', value: 10 });
    expect(compileLeadFilter(node, now)).toEqual({
      customFieldValues: { path: [NUMBER_FIELD], gte: 10 },
    });
  });

  it('compiles date older_than/within on the UTC calendar day', () => {
    const older = parseLeadFilter({
      field: `custom:${DATE_FIELD}`,
      op: 'older_than',
      days: 14,
    });
    expect(compileLeadFilter(older, now)).toEqual({
      customFieldValues: { path: [DATE_FIELD], lt: '2026-08-22' },
    });

    const within = parseLeadFilter({ field: `custom:${DATE_FIELD}`, op: 'within', days: 14 });
    expect(compileLeadFilter(within, now)).toEqual({
      customFieldValues: { path: [DATE_FIELD], gte: '2026-08-22' },
    });
  });
});

describe('assertCustomFieldFilter', () => {
  const catalog = new Map<string, CustomFieldType>([
    [NUMBER_FIELD, CustomFieldType.NUMBER],
    [DATE_FIELD, CustomFieldType.DATE],
    [TEXT_FIELD, CustomFieldType.TEXT],
  ]);

  it('rejects an unknown definition id', () => {
    const node = parseLeadFilter({ field: `custom:${UNKNOWN_FIELD}`, op: 'eq', value: 'x' });
    expect(() => assertCustomFieldFilter(node, catalog)).toThrow('Unknown custom field');
  });

  it('rejects an operator incompatible with the field type', () => {
    const node = parseLeadFilter({ field: `custom:${TEXT_FIELD}`, op: 'gte', value: 10 });
    expect(() => assertCustomFieldFilter(node, catalog)).toThrow('not allowed for this type');
  });

  it('allows an archived definition that is still in the catalog', () => {
    const archived = new Map(catalog);
    const node = parseLeadFilter({ field: `custom:${TEXT_FIELD}`, op: 'eq', value: 'legacy' });
    expect(() => assertCustomFieldFilter(node, archived)).not.toThrow();
  });
});
