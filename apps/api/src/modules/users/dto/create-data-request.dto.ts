import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDataRequestDto {
  @ApiProperty({ enum: ['DELETE', 'EXPORT'] })
  @IsIn(['DELETE', 'EXPORT'])
  type!: 'DELETE' | 'EXPORT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
