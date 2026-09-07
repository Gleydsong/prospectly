import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Partial map of custom field id → value. null or empty string removes the key.',
  })
  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, string | number | null>;
}
