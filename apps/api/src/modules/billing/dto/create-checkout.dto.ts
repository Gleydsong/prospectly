import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const BILLING_CURRENCIES = ['BRL', 'EUR', 'USD'] as const;
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

export const BILLING_INTERVALS = ['monthly', 'lifetime'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export class CreateCheckoutDto {
  @ApiProperty({ enum: BILLING_INTERVALS })
  @IsIn(BILLING_INTERVALS)
  interval!: BillingInterval;

  @ApiProperty({ enum: BILLING_CURRENCIES })
  @IsIn(BILLING_CURRENCIES)
  currency!: BillingCurrency;
}

export const CREDIT_OFFERS = ['credits-2000', 'credits-5000'] as const;
export type CreditOffer = (typeof CREDIT_OFFERS)[number];

export class CreateCreditCheckoutDto {
  @ApiProperty({ enum: CREDIT_OFFERS })
  @IsIn(CREDIT_OFFERS)
  offer!: CreditOffer;
}
