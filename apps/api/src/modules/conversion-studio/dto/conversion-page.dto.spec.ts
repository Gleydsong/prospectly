import { ValidationPipe } from '@nestjs/common';

import { UpdateConversionPageDraftDto } from './conversion-page.dto';
import { parsePageBlocks } from '../page-blocks.schema';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
});

describe('UpdateConversionPageDraftDto', () => {
  it('preserves block objects under enableImplicitConversion (does not Object.values them)', async () => {
    const body = {
      title: 'Proposta',
      expectedRevision: 1,
      blocks: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          type: 'hero',
          headline: 'Olá',
          variant: 'brand',
          cta: { type: 'call', phone: '+351912345678' },
          ctaLabel: 'Ligar',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          type: 'contact_form',
          title: 'Contacto',
          submitLabel: 'Enviar',
          privacyNotice: 'Privacidade',
          fields: ['name', 'email', 'message'],
        },
      ],
    };

    const dto = (await pipe.transform(body, {
      type: 'body',
      metatype: UpdateConversionPageDraftDto,
    })) as UpdateConversionPageDraftDto;

    expect(Array.isArray(dto.blocks)).toBe(true);
    expect(Array.isArray(dto.blocks[0])).toBe(false);
    expect(dto.blocks[0]).toEqual(expect.objectContaining({ type: 'hero', headline: 'Olá' }));
    expect(() => parsePageBlocks(dto.blocks)).not.toThrow();
  });
});
