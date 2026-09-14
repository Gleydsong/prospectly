import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export const LEAD_WEBSITE_KINDS = ['site', 'landing', 'app'] as const;
export type LeadWebsiteKind = (typeof LEAD_WEBSITE_KINDS)[number];

export class CreateLeadWebsiteDto {
  @ApiProperty({ example: 'https://loja.example' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ enum: LEAD_WEBSITE_KINDS })
  @IsOptional()
  @IsIn(LEAD_WEBSITE_KINDS)
  kind?: LeadWebsiteKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateLeadWebsiteDto {
  @ApiPropertyOptional({ example: 'https://loja.example' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @ApiPropertyOptional({ enum: LEAD_WEBSITE_KINDS })
  @IsOptional()
  @IsIn(LEAD_WEBSITE_KINDS)
  kind?: LeadWebsiteKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
