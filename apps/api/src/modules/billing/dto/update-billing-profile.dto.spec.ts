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
});
