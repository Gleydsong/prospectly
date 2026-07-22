import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MoveLeadStageDto {
  @ApiProperty()
  @IsUUID()
  stageId!: string;
}
