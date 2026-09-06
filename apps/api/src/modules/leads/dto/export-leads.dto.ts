import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, LeadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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

export const EXPORTABLE_LEAD_COLUMNS = [
  'id',
  'companyName',
  'tradeName',
  'category',
  'segment',
  'email',
  'phone',
  'whatsapp',
  'website',
  'domain',
  'city',
  'state',
  'country',
  'status',
  'source',
  'score',
  'rating',
  'reviewCount',
  'ownerId',
  'notes',
  'createdAt',
  'updatedAt',
  'lastContactAt',
  'nextContactAt',
] as const;

export type ExportableLeadColumn = (typeof EXPORTABLE_LEAD_COLUMNS)[number];

export const DEFAULT_EXPORT_COLUMNS: ExportableLeadColumn[] = [
  'companyName',
  'email',
  'phone',
  'website',
  'city',
  'status',
  'source',
  'score',
];

export class ExportLeadsDto {
  @ApiPropertyOptional({
    isArray: true,
    enum: EXPORTABLE_LEAD_COLUMNS,
    description: 'Selectable CSV columns (whitelist); defaults when omitted',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(EXPORTABLE_LEAD_COLUMNS, { each: true })
  columns?: ExportableLeadColumn[];

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
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  segment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tagId?: string;

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

  @ApiPropertyOptional({ description: 'Lead ids from a Relatórios bucket' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID(4, { each: true })
  ids?: string[];

  @ApiPropertyOptional({
    description:
      'Allowlisted AND/OR filter AST. When present, flat predicates (q, status, …) are ignored.',
  })
  @Allow()
  @IsOptional()
  filter?: unknown;
}
