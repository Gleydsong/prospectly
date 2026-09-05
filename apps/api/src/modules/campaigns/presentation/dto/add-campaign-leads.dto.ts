import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export const ADD_CAMPAIGN_LEADS_MAX = 200;

export class AddCampaignLeadsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ADD_CAMPAIGN_LEADS_MAX)
  @IsUUID('4', { each: true })
  leadIds?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  viewId?: string;
}
