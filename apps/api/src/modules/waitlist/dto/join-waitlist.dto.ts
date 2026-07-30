import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppLocale } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'ana@agency.dev' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ enum: AppLocale, example: AppLocale.pt })
  @IsEnum(AppLocale)
  locale!: AppLocale;

  @ApiPropertyOptional({ example: 'landing-home' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  /** Honeypot — bots fill this; humans leave empty. */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
