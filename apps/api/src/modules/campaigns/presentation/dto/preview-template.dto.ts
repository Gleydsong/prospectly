import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @ApiProperty({ example: 'Olá {{companyName}}' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body!: string;

  @ApiPropertyOptional({
    example: { companyName: 'Padaria Sol', contactName: 'Ana', city: 'Lisboa' },
  })
  @IsOptional()
  @IsObject()
  values?: Record<string, string>;
}
