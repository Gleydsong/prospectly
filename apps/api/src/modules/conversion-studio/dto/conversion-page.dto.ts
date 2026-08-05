import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
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

export class GenerateLandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  describeText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  googleLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;
}

export class RefineLandingDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  instruction!: string;
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
  @ArrayMaxSize(40)
  /**
   * Read from the original plain body (`obj.blocks`).
   * With global `enableImplicitConversion`, class-transformer otherwise maps each
   * array element through Object.values-like conversion before Zod runs.
   */
  @Transform(({ obj }) => {
    const blocks = (obj as { blocks?: unknown }).blocks;
    return Array.isArray(blocks) ? blocks : [];
  })
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

  /** AI pt-BR alias — normalized in service */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

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

  /** AI pt-BR alias — normalized in service */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;

  /** AI pt-BR alias — normalized in service */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  celular?: string;

  /** AI pt-BR alias — normalized in service */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** AI pt-BR alias — normalized in service */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensagem?: string;

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

export class UpdateConversionPageTemplateDto {
  @ApiProperty({ enum: ['HTML', 'AURORA'] })
  @IsString()
  @IsIn(['HTML', 'AURORA'])
  template!: 'HTML' | 'AURORA';
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
