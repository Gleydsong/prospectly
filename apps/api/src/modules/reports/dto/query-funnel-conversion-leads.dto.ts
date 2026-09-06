import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsIn } from 'class-validator';

import {
  QueryFunnelConversionDto,
  REPORT_BUCKETS,
  type ReportBucket,
} from './query-funnel-conversion.dto';

export class QueryFunnelConversionLeadsDto extends QueryFunnelConversionDto {
  @ApiProperty({ enum: REPORT_BUCKETS })
  @IsDefined()
  @IsIn(REPORT_BUCKETS)
  bucket?: ReportBucket;
}
