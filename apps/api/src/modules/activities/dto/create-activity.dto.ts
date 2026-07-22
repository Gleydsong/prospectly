import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({ enum: ActivityType, example: 'CALL' })
  @IsEnum(ActivityType)
  type!: ActivityType;

  @ApiPropertyOptional({ example: 'Ligação inicial — pediu orçamento por e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}
