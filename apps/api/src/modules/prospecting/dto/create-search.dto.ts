import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import {
  DEFAULT_SEARCH_RESULT_LIMIT,
  PROSPECTING_CATEGORY_VALUES,
  SEARCH_RESULT_LIMITS,
  type ProspectingCategory,
  type SearchResultLimit,
} from '@prospectly/shared-types';

import {
  BRAZILIAN_STATE_CODES,
  PROSPECTING_COUNTRY_CODES,
  PROSPECTING_PROVIDER_IDS,
  isBrazilianStateCode,
  type ProspectingCountryCode,
  type ProspectingProviderId,
} from '../domain/search-provider';

const MAX_CATEGORIES = 10;

function normalizeCategories(value: unknown): ProspectingCategory[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];

  const unique: ProspectingCategory[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim().toLocaleLowerCase('pt-BR') as ProspectingCategory;
    if (!(PROSPECTING_CATEGORY_VALUES as readonly string[]).includes(normalized)) continue;
    if (!unique.includes(normalized)) unique.push(normalized);
  }
  return unique;
}

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
  @ApiProperty({
    enum: [...PROSPECTING_CATEGORY_VALUES],
    isArray: true,
    example: ['restaurant', 'bakery'],
    description: 'One or more prospecting categories (max 10)',
  })
  @Transform(({ value }) => normalizeCategories(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CATEGORIES)
  @ArrayUnique()
  @IsIn([...PROSPECTING_CATEGORY_VALUES], { each: true })
  categories!: ProspectingCategory[];

  @ApiProperty({ enum: [...PROSPECTING_COUNTRY_CODES], example: 'BR', default: 'BR' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 'BR';
    return typeof value === 'string' ? value.trim().toUpperCase() : value;
  })
  @IsIn([...PROSPECTING_COUNTRY_CODES])
  country: ProspectingCountryCode = 'BR';

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
    if (
      country === 'BR' ||
      (!country && (BRAZILIAN_STATE_CODES as readonly string[]).includes(trimmed.toUpperCase()))
    ) {
      return trimmed.toUpperCase();
    }
    return trimmed;
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Validate(ProspectingRegionForCountryConstraint)
  state!: string;

  @ApiPropertyOptional({
    example: 'Casa Caiada',
    description: 'Optional neighborhood/district used to narrow the search inside the city',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional({
    enum: [...SEARCH_RESULT_LIMITS],
    default: DEFAULT_SEARCH_RESULT_LIMIT,
    description: 'Maximum number of results to persist for this search',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return DEFAULT_SEARCH_RESULT_LIMIT;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  })
  @IsInt()
  @IsIn([...SEARCH_RESULT_LIMITS])
  limit?: SearchResultLimit;

  @ApiPropertyOptional({ enum: PROSPECTING_PROVIDER_IDS, default: 'OPENSTREETMAP' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn([...PROSPECTING_PROVIDER_IDS])
  provider?: ProspectingProviderId;

  @ApiPropertyOptional({
    default: false,
    description:
      'When true, keep only places whose source did not report a website (NO_WEBSITE_REPORTED). Default false returns all places.',
  })
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = (obj as Record<string, unknown>).onlyWithoutWebsite;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return value === undefined ? false : raw;
  })
  @IsBoolean()
  onlyWithoutWebsite: boolean = false;
}
