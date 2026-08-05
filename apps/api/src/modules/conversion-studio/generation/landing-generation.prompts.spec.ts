import { LANDING_SYSTEM_PROMPT } from './landing-generation.prompts';

describe('landing generation system prompt', () => {
  it('keeps React Aura block generation rules for the local model', () => {
    expect(LANDING_SYSTEM_PROMPT).toContain('React Aura');
    expect(LANDING_SYSTEM_PROMPT).toContain('PageBlock');
    expect(LANDING_SYSTEM_PROMPT).toContain('Contact forms MUST use English input name attributes');
    expect(LANDING_SYSTEM_PROMPT).toContain('Creative brief — landing React Aura premium');
  });
});
