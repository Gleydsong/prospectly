import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '../../../common/professional-persona';

export class GoogleAuthDto {
  @ApiPropertyOptional({ description: 'Google ID token (credential) from GIS / One Tap' })
  @ValidateIf((o: GoogleAuthDto) => !o.accessToken)
  @IsString()
  @IsNotEmpty()
  idToken?: string;

  @ApiPropertyOptional({
    description: 'Google OAuth access token from GIS token client / custom button',
  })
  @ValidateIf((o: GoogleAuthDto) => !o.idToken)
  @IsString()
  @IsNotEmpty()
  accessToken?: string;

  @ApiPropertyOptional({
    example: 'Agência XPTO',
    description: 'Required when creating a new account via Google',
  })
  @ValidateIf((o: GoogleAuthDto) => o.organizationName !== undefined && o.organizationName !== '')
  @IsString()
  @MaxLength(120)
  organizationName?: string;

  @ApiPropertyOptional({ enum: ['pt', 'en'], example: 'pt' })
  @IsOptional()
  @IsIn(['pt', 'en'])
  locale?: 'pt' | 'en';

  @ApiPropertyOptional({
    example: true,
    description: 'Required (true) when creating a new account via Google',
  })
  @IsOptional()
  @Equals(true, { message: 'You must accept the Terms of Use and Privacy Policy' })
  acceptTerms?: true;

  @ApiPropertyOptional({
    enum: PROFESSIONAL_PERSONAS,
    example: 'vendedor',
    description: 'Organization default professional persona when creating a new account via Google',
  })
  @IsOptional()
  @IsIn(PROFESSIONAL_PERSONAS)
  defaultPersona?: ProfessionalPersona;

  @ApiPropertyOptional({
    example: 'Fotógrafo',
    description: 'Required (2–40 chars) when creating an account with defaultPersona outro',
  })
  @ValidateIf((o: GoogleAuthDto) => o.defaultPersona === 'outro')
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  personaOtherLabel?: string | null;
}
