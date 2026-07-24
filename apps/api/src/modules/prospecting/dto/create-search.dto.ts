import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { PROSPECTING_CATEGORY_VALUES, type ProspectingCategory } from '@prospectly/shared-types';

import {
  BRAZILIAN_STATE_CODES,
  PROSPECTING_COUNTRY_CODES,
  PROSPECTING_PROVIDER_IDS,
  isBrazilianStateCode,
  type ProspectingCountryCode,
  type ProspectingProviderId,
} from '../domain/search-provider';

@ValidatorConstraint({ name: 'prospectingRegionForCountry', async: false })
class ProspectingRegionForCountryConstraint implements ValidatorConstraintInterface {
  validate(state: unknown, args: ValidationArguments): boolean {
    if (typeof state !== 'string' || !state.trim()) return false;
    const country = (args.object as CreateSearchDto).country;
    if (country === 'BR') {
      return isBrazilianStateCode(state.trim().toUpperCase());
    }
    return state.trim().length <= 120;
  }

  defaultMessage(args: ValidationArguments): string {
    const country = (args.object as CreateSearchDto).country;
    return country === 'BR'
      ? 'state must be a valid Brazilian UF'
      : 'state must be a non-empty region name';
  }
}

export class CreateSearchDto {
  @ApiProperty({ enum: [...PROSPECTING_CATEGORY_VALUES], example: 'restaurant' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsIn([...PROSPECTING_CATEGORY_VALUES])
  category!: ProspectingCategory;

  @ApiProperty({ enum: PROSPECTING_COUNTRY_CODES, example: 'BR', default: 'BR' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 'BR';
    return typeof value === 'string' ? value.trim().toUpperCase() : value;
  })
  @IsIn(PROSPECTING_COUNTRY_CODES)
  country!: ProspectingCountryCode;

  @ApiProperty({ example: 'São Paulo' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty({
    example: 'SP',
    description: 'Brazilian UF when country=BR; otherwise district/province/region name',
  })
  @Transform(({ value, obj }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    const country = (obj as CreateSearchDto).country;
    if (country === 'BR' || (!country && (BRAZILIAN_STATE_CODES as readonly string[]).includes(trimmed.toUpperCase()))) {
      return trimmed.toUpperCase();
    }
    return trimmed;
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Validate(ProspectingRegionForCountryConstraint)
  state!: string;

  @ApiPropertyOptional({ enum: PROSPECTING_PROVIDER_IDS, default: 'OPENSTREETMAP' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(PROSPECTING_PROVIDER_IDS)
  provider?: ProspectingProviderId;

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
