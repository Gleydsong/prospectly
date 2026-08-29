import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { UpdateBillingProfileDto } from './update-billing-profile.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

describe('UpdateBillingProfileDto', () => {
  const valid = {
    name: 'Acme Ltda',
    cpfCnpj: '24.971.563.792',
    phone: '(11) 99999-9999',
    email: 'financeiro@acme.test',
  };

  it('accepts a formatted CPF and strips non-digits', async () => {
    await expect(
      pipe.transform({ ...valid }, { type: 'body', metatype: UpdateBillingProfileDto }),
    ).resolves.toMatchObject({
      cpfCnpj: '24971563792',
      phone: '11999999999',
    });
  });

  it('rejects a CPF with invalid check digits before calling Asaas', async () => {
    await expect(
      pipe.transform(
        { ...valid, cpfCnpj: '111.111.111-11' },
        { type: 'body', metatype: UpdateBillingProfileDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an incomplete phone with a payer-facing message', async () => {
    const error = await pipe
      .transform({ ...valid, phone: '1199' }, { type: 'body', metatype: UpdateBillingProfileDto })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as { message: string | string[] };
    const messages = Array.isArray(body.message) ? body.message : [body.message];
    expect(messages).toContain('Informe um telefone com DDD, com 10 ou 11 dígitos.');
    expect(messages.join(' ')).not.toMatch(/regular expression/i);
  });
});
