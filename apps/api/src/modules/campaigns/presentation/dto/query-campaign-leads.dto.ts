import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

export class QueryCampaignLeadsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by CampaignLead.status' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by currentStageId' })
  @IsOptional()
  @IsUUID()
  stageId?: string;
}
