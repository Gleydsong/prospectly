import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PROSPECTING_CATEGORY_VALUES, type ProspectingCategory } from '@prospectly/shared-types';

import { BRAZILIAN_STATE_CODES, type BrazilianStateCode } from '../domain/search-provider';

export class CreateSearchDto {
  @ApiProperty({ enum: [...PROSPECTING_CATEGORY_VALUES], example: 'restaurant' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsIn([...PROSPECTING_CATEGORY_VALUES])
  category!: ProspectingCategory;

  @ApiProperty({ example: 'São Paulo' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ enum: BRAZILIAN_STATE_CODES, example: 'SP' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(BRAZILIAN_STATE_CODES)
  state!: BrazilianStateCode;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = (obj as Record<string, unknown>).onlyWithoutWebsite;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return value === undefined ? true : raw;
  })
  @IsBoolean()
  onlyWithoutWebsite: boolean = true;
}
