import { parseWorkflowDefinition } from './workflow-definition';

describe('parseWorkflowDefinition', () => {
  it('accepts lead.created with an add_tag step and optional Vista filter', () => {
    expect(
      parseWorkflowDefinition({
        trigger: { type: 'lead.created' },
        filter: { field: 'hasWebsite', op: 'eq', value: false },
        steps: [{ type: 'add_tag', tagName: ' alto-potencial ' }],
      }),
    ).toEqual({
      trigger: { type: 'lead.created' },
      filter: { field: 'hasWebsite', op: 'eq', value: false },
      steps: [{ type: 'add_tag', tagName: 'alto-potencial' }],
    });
  });

  it('allows a draft with no steps', () => {
    expect(parseWorkflowDefinition({ trigger: { type: 'lead.created' } })).toEqual({
      trigger: { type: 'lead.created' },
      steps: [],
    });
  });

  it('rejects unknown keys, triggers, steps and SQL in tagName', () => {
    expect(() => parseWorkflowDefinition({ trigger: { type: 'lead.created' }, sql: '1' })).toThrow(
      'Unknown definition key',
    );
    expect(() => parseWorkflowDefinition({ trigger: { type: 'lead.stage_changed' } })).toThrow(
      'trigger.type is not allowed',
    );
    expect(() =>
      parseWorkflowDefinition({
        trigger: { type: 'lead.created' },
        steps: [{ type: 'assign_owner' }],
      }),
    ).toThrow('step type is not allowed');
    expect(() =>
      parseWorkflowDefinition({
        trigger: { type: 'lead.created' },
        steps: [{ type: 'add_tag', tagName: 'x; drop' }],
      }),
    ).toThrow('disallowed characters');
    expect(() =>
      parseWorkflowDefinition({
        trigger: { type: 'lead.created' },
        filter: { field: 'email', op: 'eq', value: 'a@b.c' },
      }),
    ).toThrow('Unknown filter field');
  });
});
