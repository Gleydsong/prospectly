import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, Validate } from 'class-validator';

import { IsCpfCnpjConstraint } from './cpf-cnpj.validator';

const digits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

export class UpdateBillingProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @Transform(digits)
  @Matches(/^(?:\d{11}|\d{14})$/)
  @Validate(IsCpfCnpjConstraint)
  cpfCnpj!: string;

  @Transform(digits)
  @Matches(/^\d{10,11}$/)
  phone!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;
}
