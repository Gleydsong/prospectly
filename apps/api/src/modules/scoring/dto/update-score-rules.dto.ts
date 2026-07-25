import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { SCORE_POINTS_MAX, SCORE_POINTS_MIN, SCORE_RULE_KEYS } from '../scoring.constants';

export class UpdateScoreRuleItemDto {
  @ApiProperty({ enum: SCORE_RULE_KEYS })
  @IsIn([...SCORE_RULE_KEYS])
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: SCORE_POINTS_MIN, maximum: SCORE_POINTS_MAX })
  @IsOptional()
  @IsInt()
  @Min(SCORE_POINTS_MIN)
  @Max(SCORE_POINTS_MAX)
  points?: number;
}

export class UpdateScoreRulesDto {
  @ApiProperty({ type: [UpdateScoreRuleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateScoreRuleItemDto)
  rules!: UpdateScoreRuleItemDto[];
}
