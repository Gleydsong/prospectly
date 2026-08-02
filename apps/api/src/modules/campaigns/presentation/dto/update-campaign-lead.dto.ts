import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateCampaignLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currentStageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;
}
