import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PRIVACY_REQUEST_TYPES = [
  'ACCESS',
  'CORRECTION',
  'DELETION',
  'EXPORT',
  'CONSENT_WITHDRAWAL',
  'OTHER',
] as const;

export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export class CreatePrivacyRequestDto {
  @ApiProperty({ enum: PRIVACY_REQUEST_TYPES })
  @IsIn(PRIVACY_REQUEST_TYPES)
  type!: PrivacyRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
