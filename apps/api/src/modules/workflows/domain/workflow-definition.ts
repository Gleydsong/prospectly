import {
  InvalidLeadFilterError,
  parseLeadFilter,
  type LeadFilterNode,
} from '../../leads/domain/lead-filter-ast';

export const WORKFLOW_TRIGGER_LEAD_CREATED = 'lead.created';
export const WORKFLOW_STEP_ADD_TAG = 'add_tag';
export const WORKFLOW_MAX_STEPS = 10;
export const WORKFLOW_TAG_NAME_MAX = 40;

const DEFINITION_KEYS = new Set(['trigger', 'filter', 'steps']);
const TRIGGER_KEYS = new Set(['type']);
const STEP_KEYS = new Set(['type', 'tagName']);

export class InvalidWorkflowDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWorkflowDefinitionError';
  }
}

export type WorkflowTrigger = { type: typeof WORKFLOW_TRIGGER_LEAD_CREATED };

export type WorkflowAddTagStep = {
  type: typeof WORKFLOW_STEP_ADD_TAG;
  tagName: string;
};

export type WorkflowStep = WorkflowAddTagStep;

export type WorkflowDefinition = {
  trigger: WorkflowTrigger;
  filter?: LeadFilterNode;
  steps: WorkflowStep[];
};

export function parseWorkflowDefinition(raw: unknown): WorkflowDefinition {
  assertPlainObject(raw);
  for (const key of Object.keys(raw)) {
    if (!DEFINITION_KEYS.has(key)) {
      throw new InvalidWorkflowDefinitionError(`Unknown definition key: ${key}`);
    }
  }
  if (raw.trigger === undefined) {
    throw new InvalidWorkflowDefinitionError('trigger is required');
  }
  const definition: WorkflowDefinition = {
    trigger: parseTrigger(raw.trigger),
    steps: parseSteps(raw.steps),
  };
  if (raw.filter !== undefined) {
    try {
      definition.filter = parseLeadFilter(raw.filter);
    } catch (error) {
      if (error instanceof InvalidLeadFilterError) {
        throw new InvalidWorkflowDefinitionError(error.message);
      }
      throw error;
    }
  }
  return definition;
}

function parseTrigger(raw: unknown): WorkflowTrigger {
  assertPlainObject(raw);
  for (const key of Object.keys(raw)) {
    if (!TRIGGER_KEYS.has(key)) {
      throw new InvalidWorkflowDefinitionError(`Unknown trigger key: ${key}`);
    }
  }
  if (raw.type !== WORKFLOW_TRIGGER_LEAD_CREATED) {
    throw new InvalidWorkflowDefinitionError('trigger.type is not allowed');
  }
  return { type: WORKFLOW_TRIGGER_LEAD_CREATED };
}

function parseSteps(raw: unknown): WorkflowStep[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new InvalidWorkflowDefinitionError('steps must be an array');
  }
  if (raw.length > WORKFLOW_MAX_STEPS) {
    throw new InvalidWorkflowDefinitionError(`steps cannot exceed ${WORKFLOW_MAX_STEPS}`);
  }
  return raw.map(parseStep);
}

function parseStep(raw: unknown): WorkflowStep {
  assertPlainObject(raw);
  for (const key of Object.keys(raw)) {
    if (!STEP_KEYS.has(key)) {
      throw new InvalidWorkflowDefinitionError(`Unknown step key: ${key}`);
    }
  }
  if (raw.type !== WORKFLOW_STEP_ADD_TAG) {
    throw new InvalidWorkflowDefinitionError('step type is not allowed');
  }
  return { type: WORKFLOW_STEP_ADD_TAG, tagName: assertTagName(raw.tagName) };
}

function assertTagName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidWorkflowDefinitionError('tagName must be a string');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidWorkflowDefinitionError('tagName must not be empty');
  }
  if (trimmed.length > WORKFLOW_TAG_NAME_MAX) {
    throw new InvalidWorkflowDefinitionError('tagName is too long');
  }
  if (/[;\n]|--|\/\*/.test(trimmed)) {
    throw new InvalidWorkflowDefinitionError('tagName contains disallowed characters');
  }
  return trimmed;
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidWorkflowDefinitionError('Workflow definition must be a JSON object');
  }
}
