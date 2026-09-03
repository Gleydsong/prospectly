import { buildAccountActivationEmail } from '../templates/account-activation-email';
import { buildCreditsPurchasedEmail } from '../templates/credits-purchased-email';
import { buildPasswordResetEmail } from '../templates/password-reset-email';
import { buildWaitlistConfirmationEmail } from '../templates/waitlist-confirmation-email';
import { buildWelcomeEmail } from '../templates/welcome-email';
import type { EmailContent } from '../email-layout';

export const EMAIL_PREVIEW_IDS = [
  'welcome',
  'account-activation',
  'credits-purchased',
  'password-reset',
  'waitlist-confirmation',
] as const;

export type EmailPreviewId = (typeof EMAIL_PREVIEW_IDS)[number];

const APP_URL = 'https://app.prospectlyonboard.com';
const LANDING_URL = 'https://prospectlyonboard.com';

export function renderEmailPreview(id: EmailPreviewId): EmailContent {
  switch (id) {
    case 'welcome':
      return buildWelcomeEmail({
        locale: 'pt',
        fullName: 'Ana Silva',
        appUrl: APP_URL,
      });
    case 'account-activation':
      return buildAccountActivationEmail({
        locale: 'pt',
        fullName: 'Ana Silva',
        activationUrl: `${APP_URL}/verify-email?token=preview-token`,
        expiresInHours: 24,
        frontendUrl: APP_URL,
      });
    case 'credits-purchased':
      return buildCreditsPurchasedEmail({
        locale: 'pt',
        fullName: 'Ana Silva',
        credits: 5000,
        amountCentavos: 2399,
        currency: 'BRL',
        purchasedAt: new Date('2026-09-03T15:00:00.000Z'),
        balanceAfter: 15450,
        appUrl: APP_URL,
      });
    case 'password-reset':
      return buildPasswordResetEmail({
        locale: 'pt',
        resetUrl: `${APP_URL}/reset-password?token=preview-token`,
        frontendUrl: APP_URL,
      });
    case 'waitlist-confirmation':
      return buildWaitlistConfirmationEmail({ locale: 'pt', landingUrl: LANDING_URL });
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown email preview: ${String(exhaustive)}`);
    }
  }
}

export function isEmailPreviewId(value: string): value is EmailPreviewId {
  return (EMAIL_PREVIEW_IDS as readonly string[]).includes(value);
}
