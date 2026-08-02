import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignLeadResult } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordCampaignLeadResultDto {
  @ApiProperty({ enum: CampaignLeadResult })
  @IsEnum(CampaignLeadResult)
  @IsNotEmpty()
  result!: CampaignLeadResult;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpAt?: string;

  @ApiPropertyOptional({ description: 'Stage id from campaign.metrics.stages' })
  @IsOptional()
  @IsUUID()
  stageId?: string;
}
