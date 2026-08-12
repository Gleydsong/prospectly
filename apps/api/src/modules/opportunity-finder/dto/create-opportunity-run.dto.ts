import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Validate } from 'class-validator';

import { PROSPECTING_COUNTRY_CODES } from '../../prospecting/domain/search-provider';
import { ProspectingRegionForCountry } from './prospecting-region.validator';

export class CreateOpportunityRunDto {
  @ApiProperty({ example: 'Criação de sites para pequenos negócios' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  service!: string;

  @ApiProperty({ example: 'Curitiba' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: 'PR' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Validate(ProspectingRegionForCountry)
  state!: string;

  @ApiPropertyOptional({ enum: [...PROSPECTING_COUNTRY_CODES], default: 'BR' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsIn([...PROSPECTING_COUNTRY_CODES])
  country = 'BR' as const;

  @ApiPropertyOptional({ description: 'UUID supplied by the client to make double submits idempotent' })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
