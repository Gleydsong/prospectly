import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, Validate } from 'class-validator';

import { IsCpfCnpjConstraint } from './cpf-cnpj.validator';

const digits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

export class UpdateBillingProfileDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome ou razão social.' })
  @MaxLength(160)
  name!: string;

  @Transform(digits)
  @Matches(/^(?:\d{11}|\d{14})$/, {
    message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
  })
  @Validate(IsCpfCnpjConstraint)
  cpfCnpj!: string;

  @Transform(digits)
  @Matches(/^\d{10,11}$/, {
    message: 'Informe um telefone com DDD, com 10 ou 11 dígitos.',
  })
  phone!: string;

  @IsEmail({}, { message: 'Informe um e-mail de cobrança válido.' })
  @MaxLength(254)
  email!: string;
}
