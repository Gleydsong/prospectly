import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GoogleOAuthPort, GoogleTokenSet } from './google-oauth.port';

@Injectable()
export class GoogleOAuthHttpAdapter implements GoogleOAuthPort {
  constructor(private readonly config: ConfigService) {}

  async exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<GoogleTokenSet> {
    const clientId = this.config.get<string>('google.clientId') ?? '';
    const clientSecret = this.config.get<string>('google.clientSecret') ?? '';
    const body = new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      throw new BadGatewayException('Google token exchange failed');
    }
    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };
    if (!tokens.access_token) {
      throw new BadGatewayException('Google token exchange failed');
    }
    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      throw new BadGatewayException('Google userinfo failed');
    }
    const profile = (await userRes.json()) as { email?: string; sub?: string };
    if (!profile.email || !profile.sub) {
      throw new BadGatewayException('Google userinfo missing email');
    }
    if (!tokens.refresh_token) {
      throw new BadGatewayException('Google did not return a refresh token');
    }
    return {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      googleEmail: profile.email,
      googleSubject: profile.sub,
      scope: tokens.scope ?? '',
    };
  }
}
