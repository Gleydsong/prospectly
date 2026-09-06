import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, LeadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

function parseIdList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const flattened =
    Array.isArray(value) && value.length === 1 && typeof value[0] === 'string' && value[0].includes(',')
      ? value[0]
      : value;
  const raw = Array.isArray(flattened) ? flattened : String(flattened).split(',');
  return raw.map((item) => String(item).trim()).filter(Boolean);
}

export const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'companyName',
  'score',
  'rating',
  'reviewCount',
] as const;
export type LeadSortField = (typeof SORTABLE_FIELDS)[number];

export class QueryLeadsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search over company and trade name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated lead ids from a Relatórios bucket' })
  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsUUID(4, { each: true })
  @ArrayMaxSize(5000)
  ids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasWebsite?: boolean;

  @ApiPropertyOptional({
    description:
      'Allowlisted AND/OR filter AST. When present, flat predicates (q, status, …) are ignored.',
  })
  @Allow()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  })
  filter?: unknown;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy: LeadSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
