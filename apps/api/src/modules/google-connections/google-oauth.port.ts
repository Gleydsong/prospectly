export const GOOGLE_OAUTH_PORT = 'GOOGLE_OAUTH_PORT';

export type GoogleTokenSet = {
  refreshToken: string;
  accessToken: string;
  googleEmail: string;
  googleSubject: string;
  scope: string;
};

export interface GoogleOAuthPort {
  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<GoogleTokenSet>;
}
