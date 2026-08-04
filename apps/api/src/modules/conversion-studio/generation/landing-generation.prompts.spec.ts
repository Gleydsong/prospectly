import { LANDING_SYSTEM_PROMPT } from './landing-generation.prompts';

describe('landing generation system prompt', () => {
  it('injects the runtime-safe design skill for the local model', () => {
    expect(LANDING_SYSTEM_PROMPT).toContain('Runtime skill — premium landing direction');
    expect(LANDING_SYSTEM_PROMPT).toContain('Build mobile-first');
    expect(LANDING_SYSTEM_PROMPT).toContain('The output runs in a sandbox that removes scripts');
  });
});
