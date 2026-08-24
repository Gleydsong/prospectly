import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateAppmaxCardCheckoutDto } from './create-appmax-card-checkout.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const valid = {
  checkoutKey: 'f191b5ef-31b8-4c79-96c7-b233b522eb27',
  purpose: 'credits',
  offer: 'credits-2000',
  firstName: 'Ana',
  lastName: 'Silva',
  phone: '(11) 99999-9999',
  email: 'ana@example.com',
  ip: '203.0.113.10',
  cardToken: 'single-use-appmax-token',
  documentNumber: '191.000.000-00',
  holderName: 'ANA SILVA',
};

describe('CreateAppmaxCardCheckoutDto', () => {
  it('normalizes phone and document while retaining only the Appmax token', async () => {
    await expect(
      pipe.transform(valid, { type: 'body', metatype: CreateAppmaxCardCheckoutDto }),
    ).resolves.toEqual(expect.objectContaining({ phone: '11999999999', documentNumber: '19100000000' }));
  });

  it.each(['cardNumber', 'cvv', 'expirationMonth', 'expirationYear'])(
    'rejects raw card field %s at the API boundary',
    async (field) => {
      await expect(
        pipe.transform(
          { ...valid, [field]: '4111111111111111' },
          { type: 'body', metatype: CreateAppmaxCardCheckoutDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
