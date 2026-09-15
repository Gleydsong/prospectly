import { ValidationPipe, BadRequestException } from '@nestjs/common';

import { RegisterDto } from './register.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

const validBase = {
  name: 'Ana Silva',
  email: 'ana@agency.dev',
  password: 'Str0ngPass1',
  organizationName: 'Agência XPTO',
  locale: 'pt',
  acceptTerms: true,
};

describe('RegisterDto', () => {
  it('rejects registration without defaultPersona', async () => {
    await expect(
      pipe.transform(validBase, { type: 'body', metatype: RegisterDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid defaultPersona enum value', async () => {
    await expect(
      pipe.transform(
        { ...validBase, defaultPersona: 'icp' },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts desenvolvedor as defaultPersona', async () => {
    await expect(
      pipe.transform(
        { ...validBase, defaultPersona: 'desenvolvedor' },
        { type: 'body', metatype: RegisterDto },
      ),
    ).resolves.toEqual(expect.objectContaining({ defaultPersona: 'desenvolvedor' }));
  });
});
