import { LANDING_SYSTEM_PROMPT, buildUserPrompt } from './landing-generation.prompts';
import { LANDING_PROMPT_VERSION } from './landing-generation.constants';

describe('landing React Aura LLM brief', () => {
  it('embeds the premium creative brief in the system prompt for blocks', () => {
    expect(LANDING_SYSTEM_PROMPT).toContain('Creative brief');
    expect(LANDING_SYSTEM_PROMPT).toContain('"blocks"');
    expect(LANDING_SYSTEM_PROMPT).toContain('React Aura');
    expect(LANDING_SYSTEM_PROMPT).not.toContain('"html": string');
  });

  it('asks the model for blocks output in the user prompt', () => {
    const prompt = buildUserPrompt({
      companyName: "Top's Burguer",
      category: 'restaurant',
      city: 'Amaturá',
      photos: [{ url: 'https://lh3.googleusercontent.com/a', alt: 'Fachada' }],
    });
    expect(prompt).toContain('{ title, themeHint?, blocks }');
    expect(prompt).toContain('blocks[] only');
    expect(prompt).toContain('photos drive identity');
  });

  it('bumps prompt version for React Aura blocks', () => {
    expect(LANDING_PROMPT_VERSION).toBe('v5-react-aura-blocks');
  });
});
