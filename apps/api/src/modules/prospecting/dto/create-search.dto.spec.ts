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

describe('CreateSearchDto validation', () => {
  it('defaults onlyWithoutWebsite to false so all places are returned', async () => {
    await expect(
      transform({
        categories: ['restaurant'],
        city: 'São Paulo',
        state: 'SP',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        onlyWithoutWebsite: false,
      }),
    );
  });

  it('accepts multiple categories and defaults country to BR', async () => {
    await expect(
      transform({
        categories: ['restaurant', 'bakery'],
        city: 'São Paulo',
        state: 'sp',
        onlyWithoutWebsite: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        categories: ['restaurant', 'bakery'],
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        onlyWithoutWebsite: true,
      }),
    );
  });

  it('rejects Portugal after Brazil-only geo restriction', async () => {
    await expect(
      transform({
        categories: ['bakery'],
        country: 'pt',
        city: 'Lisboa',
        state: 'Lisboa',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty categories', async () => {
    await expect(
      transform({
        categories: [],
        city: 'São Paulo',
        state: 'SP',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown category values', async () => {
    await expect(
      transform({
        categories: ['spaceship'],
        city: 'São Paulo',
        state: 'SP',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects Brazilian searches with a non-UF region', async () => {
    await expect(
      transform({
        categories: ['restaurant'],
        country: 'BR',
        city: 'São Paulo',
        state: 'São Paulo',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported country codes including former European markets', async () => {
    await expect(
      transform({
        categories: ['restaurant'],
        country: 'US',
        city: 'New York',
        state: 'NY',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transform({
        categories: ['restaurant'],
        country: 'PT',
        city: 'Lisboa',
        state: 'Lisboa',
        onlyWithoutWebsite: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
