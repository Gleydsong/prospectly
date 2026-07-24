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

describe('CreateSearchDto multi-category validation', () => {
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
      }),
    );
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
});
