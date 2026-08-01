import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const DASHBOARD_PERIODS = ['7d', '30d', '90d', 'all'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export class QueryDashboardDto {
  @ApiPropertyOptional({ enum: DASHBOARD_PERIODS, default: '30d' })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  period: DashboardPeriod = '30d';

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ description: 'Filter by lead owner user id' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter by lead segment' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  segment?: string;
}
