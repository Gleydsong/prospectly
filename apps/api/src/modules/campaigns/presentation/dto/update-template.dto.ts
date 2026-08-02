import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'Abertura assistida' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 'EMAIL' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category?: string;

  @ApiPropertyOptional({ example: 'Proposta para {{companyName}}' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string | null;

  @ApiPropertyOptional({ example: 'Olá {{contactName}}, vi o site da {{companyName}}...' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body?: string;
}
