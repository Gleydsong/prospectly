import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { CreateLeadDto } from './create-lead.dto';

/** Update payload — excludes ownerId (use assign-owner endpoint). */
export class UpdateLeadDto extends PartialType(
  OmitType(CreateLeadDto, ['ownerId'] as const),
) {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
