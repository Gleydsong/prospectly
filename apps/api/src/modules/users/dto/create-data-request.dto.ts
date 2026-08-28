import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDataRequestDto {
  @ApiProperty({ enum: ['DELETE', 'EXPORT', 'ACCESS', 'CORRECTION', 'CONSENT_WITHDRAWAL', 'OTHER'] })
  @IsIn(['DELETE', 'EXPORT', 'ACCESS', 'CORRECTION', 'CONSENT_WITHDRAWAL', 'OTHER'])
  type!: 'DELETE' | 'EXPORT' | 'ACCESS' | 'CORRECTION' | 'CONSENT_WITHDRAWAL' | 'OTHER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
