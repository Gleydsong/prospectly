import { compileLeadFilter, parseLeadFilter } from './lead-filter-ast';

const now = new Date('2026-09-05T12:00:00.000Z');

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
    expect(() =>
      parseLeadFilter({ field: 'lastContactAt', op: 'older_than', days: 0 }),
    ).toThrow('days');
    expect(() =>
      parseLeadFilter({ field: 'createdAt', op: 'within', days: 366 }),
    ).toThrow('days');
  });

  it('rejects empty groups, mixed group/leaf nodes and tenant fields', () => {
    expect(() => parseLeadFilter({ op: 'and', nodes: [] })).toThrow('empty');
    expect(() =>
      parseLeadFilter({ op: 'and', field: 'city', nodes: [{ field: 'city', op: 'eq', value: 'X' }] }),
    ).toThrow('both a group and a leaf');
    expect(() => parseLeadFilter({ field: 'organizationId', op: 'eq', value: 'org-1' })).toThrow(
      'Unknown filter field',
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
});
