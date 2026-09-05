import { ApiPropertyOptional } from '@nestjs/swagger';
import { SavedViewVisibility } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSavedViewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ enum: SavedViewVisibility })
  @IsOptional()
  @IsEnum(SavedViewVisibility)
  visibility?: SavedViewVisibility;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}
