import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { REPORT_PERIODS, type ReportPeriod } from './query-funnel-conversion.dto';

export class SavedReportDefinitionDto {
  @ApiProperty({ enum: REPORT_PERIODS })
  @IsIn(REPORT_PERIODS)
  period!: ReportPeriod;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class CreateSavedReportDto {
  @ApiProperty({ example: 'Conversão 30d Google' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: SavedReportDefinitionDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SavedReportDefinitionDto)
  definition!: SavedReportDefinitionDto;
}
