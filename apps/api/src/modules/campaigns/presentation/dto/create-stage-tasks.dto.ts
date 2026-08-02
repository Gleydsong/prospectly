import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateStageTasksDto {
  @ApiPropertyOptional({
    description: 'Subset of campaign lead ids; defaults to all PENDING leads',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  leadIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
