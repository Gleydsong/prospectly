import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsIn } from 'class-validator';

import { REPORT_BUCKETS, type ReportBucket } from './query-funnel-conversion.dto';

export class QuerySavedReportLeadsDto {
  @ApiProperty({ enum: REPORT_BUCKETS })
  @IsDefined()
  @IsIn(REPORT_BUCKETS)
  bucket!: ReportBucket;
}
