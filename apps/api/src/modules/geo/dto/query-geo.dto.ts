import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { PROSPECTING_COUNTRY_CODES, type ProspectingCountryCode } from '../../prospecting/domain/search-provider';

export class QueryRegionsDto {
  @ApiProperty({ enum: PROSPECTING_COUNTRY_CODES, example: 'PT' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @IsIn([...PROSPECTING_COUNTRY_CODES])
  country!: ProspectingCountryCode;
}

export class QueryCitiesDto {
  @ApiProperty({ enum: PROSPECTING_COUNTRY_CODES, example: 'PT' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @IsIn([...PROSPECTING_COUNTRY_CODES])
  country!: ProspectingCountryCode;

  @ApiProperty({ example: '11', description: 'Region/state isoCode from /geo/regions' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  region!: string;
}
