import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { BillingController } from './billing.controller';

describe('BillingController Appmax contracts', () => {
  it.each(['postAppmaxHealth', 'handleAppmaxWebhook'] as const)(
    'returns HTTP 200 from %s as required by Appmax',
    (method) => {
      const status = Reflect.getMetadata(HTTP_CODE_METADATA, BillingController.prototype[method]) as
        | number
        | undefined;

      expect(status).toBe(HttpStatus.OK);
    },
  );
});
