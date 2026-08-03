import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateConversionPageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  leadId?: string;
}

export class UpdateConversionPageDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  blocks!: unknown[];

  @ApiPropertyOptional({ description: 'Optimistic concurrency token (draftRevision)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision?: number;
}

export class QueryConversionPagesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class RestoreVersionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class PublicFormSubmitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** Honeypot — must stay empty */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(0)
  companyWebsite?: string;
}

export class TrackPublicEventDto {
  @ApiProperty({ enum: ['page_view', 'cta_click', 'form_started'] })
  @IsString()
  type!: 'page_view' | 'cta_click' | 'form_started';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaType?: string;
}

export class RegisterPageAssetDto {
  @ApiProperty({ description: 'HTTPS image URL (no arbitrary upload storage in MVP)' })
  @IsString()
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  altText?: string;
}

export class UpdateAnalyticsSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  analyticsPixelEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  analyticsConsentLabel?: string;
}

export class CreateDomainBindingDto {
  @ApiProperty({ example: 'proposta.cliente.com' })
  @IsString()
  @MaxLength(253)
  hostname!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  pageId?: string;
}
