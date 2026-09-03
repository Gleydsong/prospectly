import { AppLocale } from '@prisma/client';

import { escapeHtml } from '../../common/mail/email-html';
import {
  buildWaitlistConfirmationEmail as buildSharedWaitlistConfirmationEmail,
  buildWaitlistNotifyEmail,
} from '../../common/mail/templates/waitlist-confirmation-email';

export type WaitlistEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export { escapeHtml, buildWaitlistNotifyEmail };

export function buildWaitlistConfirmationEmail(
  locale: AppLocale,
  landingUrl?: string,
): WaitlistEmailContent {
  const content = buildSharedWaitlistConfirmationEmail({
    locale: locale === AppLocale.en ? 'en' : 'pt',
    landingUrl,
  });
  return {
    subject: content.subject,
    text: content.text,
    html: content.html,
  };
}
