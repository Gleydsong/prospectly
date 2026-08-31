import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';

import { IsCpfCnpjConstraint } from './cpf-cnpj.validator';

const digits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

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

  @IsString()
  @MinLength(2, { message: 'Informe o endereço.' })
  @MaxLength(120)
  address!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o número do endereço.' })
  @MaxLength(20)
  addressNumber!: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  complement?: string;

  @IsString()
  @MinLength(2, { message: 'Informe o bairro.' })
  @MaxLength(60)
  province!: string;

  @Transform(digits)
  @Matches(/^\d{8}$/, {
    message: 'Informe um CEP com 8 dígitos.',
  })
  postalCode!: string;
}
