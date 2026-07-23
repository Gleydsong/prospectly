import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QuerySearchesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SearchStatus })
  @IsOptional()
  @IsEnum(SearchStatus)
  status?: SearchStatus;
}
