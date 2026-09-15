import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '../../../common/professional-persona';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'ana@agency.dev' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'Str0ngPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @ApiProperty({ example: 'Agência XPTO', description: 'Organization name to create' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationName!: string;

  @ApiProperty({ enum: ['pt', 'en'], example: 'pt' })
  @IsIn(['pt', 'en'])
  locale!: 'pt' | 'en';

  @ApiProperty({
    enum: PROFESSIONAL_PERSONAS,
    example: 'vendedor',
    description: 'Organization default professional persona',
  })
  @IsIn(PROFESSIONAL_PERSONAS)
  defaultPersona!: ProfessionalPersona;

  @ApiPropertyOptional({
    example: 'Fotógrafo',
    description: 'Required (2–40 chars) when defaultPersona is outro',
  })
  @ValidateIf((o: RegisterDto) => o.defaultPersona === 'outro')
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  personaOtherLabel?: string | null;

  @ApiProperty({
    example: true,
    description: 'Must accept Terms of Use and Privacy Policy',
  })
  @Equals(true, { message: 'You must accept the Terms of Use and Privacy Policy' })
  acceptTerms!: true;
}
