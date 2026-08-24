import { Transform } from 'class-transformer';
import { IsEmail, IsIP, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import type { CreditOffer } from '../domain/payment-provider';

export class CreateAppmaxCardCheckoutDto {
  @IsUUID()
  checkoutKey!: string;

  @IsIn(['monthly', 'credits'])
  purpose!: 'monthly' | 'credits';

  @IsIn(['credits-2000', 'credits-5000'])
  @IsOptional()
  offer?: CreditOffer;

  @IsString()
  @Length(1, 80)
  firstName!: string;

  @IsString()
  @Length(1, 120)
  lastName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @Matches(/^\d{10,11}$/)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsIP()
  ip!: string;

  @IsString()
  @Length(10, 512)
  cardToken!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @Matches(/^\d{11}(?:\d{3})?$/)
  documentNumber!: string;

  @IsString()
  @Length(2, 120)
  holderName!: string;
}
