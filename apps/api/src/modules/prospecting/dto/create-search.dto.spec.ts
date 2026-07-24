import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateSearchDto } from './create-search.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { exposeDefaultValues: true },
});

async function transform(body: Record<string, unknown>) {
  return pipe.transform(body, { type: 'body', metatype: CreateSearchDto });
}

describe('CreateSearchDto country/region validation', () => {
  it('defaults country to BR when omitted and uppercases Brazilian UF', async () => {
    await expect(
      transform({
        category: 'restaurant',
        city: 'São Paulo',
        state: 'sp',
        onlyWithoutWebsite: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        category: 'restaurant',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        onlyWithoutWebsite: true,
      }),
    );
  });

  it('accepts Portugal with a free-text region', async () => {
    await expect(
      transform({
        category: 'bakery',
        country: 'pt',
        city: 'Lisboa',
        state: 'Lisboa',
        onlyWithoutWebsite: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        category: 'bakery',
        country: 'PT',
        city: 'Lisboa',
        state: 'Lisboa',
      }),
    );
  });

  it('rejects Brazilian searches with a non-UF region', async () => {
    await expect(
      transform({
        category: 'restaurant',
        country: 'BR',
        city: 'São Paulo',
        state: 'São Paulo',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported country codes', async () => {
    await expect(
      transform({
        category: 'restaurant',
        country: 'US',
        city: 'New York',
        state: 'NY',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty region for European countries', async () => {
    await expect(
      transform({
        category: 'restaurant',
        country: 'PT',
        city: 'Lisboa',
        state: '   ',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
