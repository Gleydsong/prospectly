export const GMAIL_PORT = 'GMAIL_PORT';

export type GmailMessageMetadata = {
  externalId: string;
  threadId: string;
  occurredAt: Date;
  from: string[];
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  htmlLink: string;
};

export interface GmailPort {
  refreshAccessToken(refreshToken: string): Promise<string>;
  listMessages(input: { accessToken: string; after: Date }): Promise<GmailMessageMetadata[]>;
}
