import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteDataRequestDto {
  @ApiPropertyOptional({ description: 'Optional operator note (no PII dump)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  confirmationNote?: string;

  @ApiPropertyOptional({ example: 'email_stub' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  confirmationChannel?: string;
}
