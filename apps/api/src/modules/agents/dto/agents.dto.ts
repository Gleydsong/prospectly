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
}
