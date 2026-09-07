import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AgentsLeadDto {
  @ApiProperty()
  @IsUUID('4')
  leadId!: string;
}

export class AgentsCrmApplyDto {
  @ApiProperty()
  @IsUUID('4')
  leadId!: string;

  @ApiPropertyOptional({
    description: 'Stage to move to. When omitted, uses the suggested next stage from suggest().',
  })
  @IsOptional()
  @IsUUID('4')
  stageId?: string;
}

export class AgentsWhatsappFirstMessageDto {
  @ApiProperty()
  @IsUUID('4')
  leadId!: string;

  @ApiPropertyOptional({
    description: 'Message template id. Defaults to first WHATSAPP template in the org.',
  })
  @IsOptional()
  @IsUUID('4')
  templateId?: string;
}

export class AgentsWhatsappVariantsDto {
  @ApiProperty()
  @IsUUID('4')
  leadId!: string;

  @ApiPropertyOptional({ description: 'Number of variants (3-5). Default 4.', default: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(5)
  count?: number;

  @ApiPropertyOptional({
    description:
      'Generation seed so "Gerar de novo" rotates fallback packs / Ollama wording. Default 0.',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seed?: number;

  @ApiPropertyOptional({
    description: 'Sequence stage for the message',
    enum: ['FIRST_MESSAGE', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'BREAKUP'],
    default: 'FIRST_MESSAGE',
  })
  @IsOptional()
  sequenceStage?: 'FIRST_MESSAGE' | 'FOLLOW_UP_1' | 'FOLLOW_UP_2' | 'BREAKUP';
}

export class AgentsWhatsappRecordOutreachDto {
  @ApiProperty()
  @IsUUID('4')
  leadId!: string;

  @ApiProperty({ description: 'The text sent or opened in WhatsApp' })
  messageBody!: string;

  @ApiPropertyOptional({ description: 'The variant id used, if any' })
  @IsOptional()
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Sequence stage for the message',
    enum: ['FIRST_MESSAGE', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'BREAKUP'],
    default: 'FIRST_MESSAGE',
  })
  @IsOptional()
  sequenceStage?: 'FIRST_MESSAGE' | 'FOLLOW_UP_1' | 'FOLLOW_UP_2' | 'BREAKUP';

  @ApiPropertyOptional({ description: 'Stage to move the lead to (e.g. Contacted)' })
  @IsOptional()
  @IsUUID('4')
  advanceStageId?: string;

  @ApiPropertyOptional({ description: 'Schedule follow-up task in N days (1-30)', minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  scheduleFollowUpDays?: number;
}

