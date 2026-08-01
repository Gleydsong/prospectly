import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateWebhookIntegrationDto {
  @ApiProperty({ example: 'https://hooks.example.com/prospectly' })
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional({ description: 'Enable the webhook immediately', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Optional label for operators' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
