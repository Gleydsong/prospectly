import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { BillingController } from './billing.controller';

describe('BillingController', () => {
  it('acknowledges Asaas webhooks with HTTP 200', () => {
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, BillingController.prototype.handleAsaasWebhook),
    ).toBe(HttpStatus.OK);
  });
});
