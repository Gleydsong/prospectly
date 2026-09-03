import { shouldEnableEmailPreview } from './email-preview.module';
import { isEmailPreviewId, renderEmailPreview } from './email-preview.fixtures';

describe('email preview gate', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.EMAIL_PREVIEW;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.EMAIL_PREVIEW = originalFlag;
  });

  it('stays disabled in production even if the flag is on', () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PREVIEW = 'true';
    expect(shouldEnableEmailPreview()).toBe(false);
  });

  it('enables only in non-prod when the flag is true', () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PREVIEW = 'true';
    expect(shouldEnableEmailPreview()).toBe(true);
  });

  it('renders known templates and rejects unknown ids', () => {
    expect(isEmailPreviewId('welcome')).toBe(true);
    expect(isEmailPreviewId('credits-added')).toBe(false);
    expect(renderEmailPreview('welcome').html).toContain('Bem-vindo à Prospectly');
  });
});
