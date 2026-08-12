import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryOpportunityCandidatesDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn(['EXCELLENT', 'HIGH', 'MEDIUM', 'LOW'])
  category?: 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW';
}
