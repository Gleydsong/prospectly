import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const BILLING_CURRENCIES = ['BRL'] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

export const PAYMENT_METHODS = ['pix', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BILLING_INTERVALS = ['monthly', 'lifetime'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export class CreateCheckoutDto {
  @ApiProperty({ enum: BILLING_INTERVALS })
  @IsIn(BILLING_INTERVALS)
  interval!: BillingInterval;

  @ApiProperty({ enum: BILLING_CURRENCIES, default: 'BRL' })
  @IsIn(BILLING_CURRENCIES)
  currency!: BillingCurrency;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethod;
}

export const CREDIT_OFFERS = ['credits-2000', 'credits-5000'] as const;
export type CreditOffer = (typeof CREDIT_OFFERS)[number];

export class CreateCreditCheckoutDto {
  @ApiProperty({ enum: CREDIT_OFFERS })
  @IsIn(CREDIT_OFFERS)
  offer!: CreditOffer;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethod;
}
