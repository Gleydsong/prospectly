import {
  CALENDAR_API_DISABLED,
  CALENDAR_LIST_FAILED,
  GMAIL_API_DISABLED,
  GMAIL_LIST_FAILED,
  googleApiFailureCode,
} from './google-api-error';

describe('googleApiFailureCode', () => {
  it('maps accessNotConfigured to the disabled code without keeping the project id', async () => {
    const res = new Response(
      JSON.stringify({
        error: {
          message: 'Gmail API has not been used in project prospecting-503316 before or it is disabled.',
          status: 'PERMISSION_DENIED',
          details: [{ reason: 'accessNotConfigured' }],
        },
      }),
      { status: 403 },
    );
    await expect(googleApiFailureCode(res, GMAIL_LIST_FAILED, GMAIL_API_DISABLED)).resolves.toBe(
      GMAIL_API_DISABLED,
    );
  });

  it('maps SERVICE_DISABLED and the classic errors[].reason without keeping the project id', async () => {
    const res = new Response(
      JSON.stringify({
        error: {
          message: 'Google Calendar API has not been used in project prospecting-503316 before or it is disabled.',
          errors: [{ reason: 'accessNotConfigured' }],
          details: [{ reason: 'SERVICE_DISABLED' }],
        },
      }),
      { status: 403 },
    );
    await expect(
      googleApiFailureCode(res, CALENDAR_LIST_FAILED, CALENDAR_API_DISABLED),
    ).resolves.toBe(CALENDAR_API_DISABLED);
  });

  it('falls back when the body is not Google JSON', async () => {
    const res = new Response('upstream', { status: 500 });
    await expect(googleApiFailureCode(res, CALENDAR_LIST_FAILED, CALENDAR_API_DISABLED)).resolves.toBe(
      CALENDAR_LIST_FAILED,
    );
  });
});
