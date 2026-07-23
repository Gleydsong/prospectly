import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ImportSearchResultsDto {
  @ApiProperty({ type: [String], description: 'Search result IDs selected for import' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  resultIds!: string[];
}
