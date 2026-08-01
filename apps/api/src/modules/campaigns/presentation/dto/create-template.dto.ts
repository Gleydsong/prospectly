import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Abertura assistida' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'EMAIL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;

  @ApiPropertyOptional({ example: 'Proposta para {{companyName}}' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @ApiProperty({ example: 'Olá {{contactName}}, vi o site da {{companyName}}...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body!: string;
}
