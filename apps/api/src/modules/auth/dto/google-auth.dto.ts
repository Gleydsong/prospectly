import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token (credential) from GIS / One Tap' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

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
}
