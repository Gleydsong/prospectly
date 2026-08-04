import { LANDING_PREMIUM_CREATIVE_BRIEF } from './landing-premium-brief';
import { LANDING_SYSTEM_PROMPT, buildUserPrompt } from './landing-generation.prompts';
import { LANDING_PROMPT_VERSION } from './landing-generation.constants';

describe('landing premium LLM brief', () => {
  it('embeds the premium creative brief in the system prompt for HTML', () => {
    expect(LANDING_SYSTEM_PROMPT).toContain(LANDING_PREMIUM_CREATIVE_BRIEF.slice(0, 60));
    expect(LANDING_SYSTEM_PROMPT).toContain('"html": string');
    expect(LANDING_SYSTEM_PROMPT).toContain('self-contained HTML');
    expect(LANDING_SYSTEM_PROMPT).toContain('NO <script>');
  });

  it('asks the model for HTML output in the user prompt', () => {
    const prompt = buildUserPrompt({
      companyName: "Top's Burguer",
      category: 'restaurant',
      city: 'Amaturá',
      photos: [{ url: 'https://lh3.googleusercontent.com/a', alt: 'Fachada' }],
    });
    expect(prompt).toContain('{ title, html }');
    expect(prompt).toContain('Complete self-contained HTML document');
    expect(prompt).toContain('photo-first');
  });

  it('bumps prompt version for HTML premium', () => {
    expect(LANDING_PROMPT_VERSION).toBe('v5-html-premium-motion');
  });
});
