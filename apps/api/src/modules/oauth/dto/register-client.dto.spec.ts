import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { RegisterClientDto } from './register-client.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
});

const cursorDcrBody = {
  redirect_uris: [
    'cursor://anysphere.cursor-mcp/oauth/callback',
    'https://www.cursor.com/agents/mcp/oauth/callback',
    'http://localhost:8787/callback',
  ],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  client_name: 'Cursor',
  logo_uri: 'https://example.com/cursor.svg',
  scope: 'prospectly.plugin.read',
};

describe('RegisterClientDto', () => {
  it('accepts Cursor RFC 7591 DCR metadata that the global ValidationPipe would otherwise reject', async () => {
    const result = await pipe.transform(cursorDcrBody, {
      type: 'body',
      metatype: RegisterClientDto,
    });

    expect(result).toMatchObject({
      client_name: 'Cursor',
      redirect_uris: cursorDcrBody.redirect_uris,
      token_endpoint_auth_method: 'none',
    });
  });

  it('still requires redirect_uris', async () => {
    await expect(
      pipe.transform({ client_name: 'Cursor' }, { type: 'body', metatype: RegisterClientDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
