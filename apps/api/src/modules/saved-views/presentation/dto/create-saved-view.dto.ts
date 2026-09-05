import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SavedViewVisibility } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSavedViewDto {
  @ApiProperty({ example: 'Lisboa sem site' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: SavedViewVisibility, default: SavedViewVisibility.PRIVATE })
  @IsOptional()
  @IsEnum(SavedViewVisibility)
  visibility?: SavedViewVisibility;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  definition!: Record<string, unknown>;
}
