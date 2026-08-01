import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { CAMPAIGN_STAGE_TYPES, type CampaignStageType } from '../../domain/campaign-stages';

export class CampaignStageInputDto {
  @ApiProperty({ enum: CAMPAIGN_STAGE_TYPES })
  @IsIn([...CAMPAIGN_STAGE_TYPES])
  type!: CampaignStageType;

  @ApiProperty({ example: 'E-mail de abertura' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class CampaignRulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entryStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  exitStatus?: string;

  @ApiPropertyOptional({ description: 'Days between assisted stage actions' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  frequencyDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  contactWindowStart?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  contactWindowEnd?: string;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'Cadência Padarias Lisboa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  segment?: string;

  @ApiPropertyOptional({ example: 'ASSISTED' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ type: [CampaignStageInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CampaignStageInputDto)
  stages?: CampaignStageInputDto[];

  @ApiPropertyOptional({ type: CampaignRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignRulesDto)
  rules?: CampaignRulesDto;
}
