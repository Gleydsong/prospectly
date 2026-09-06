import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

export const REPORT_PERIODS = ['7d', '30d', '90d'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_BUCKETS = ['inflow', 'wins', 'losses'] as const;
export type ReportBucket = (typeof REPORT_BUCKETS)[number];

export class QueryFunnelConversionDto {
  @ApiPropertyOptional({ enum: REPORT_PERIODS, default: '30d' })
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period: ReportPeriod = '30d';

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ description: 'Filter by lead owner user id' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
