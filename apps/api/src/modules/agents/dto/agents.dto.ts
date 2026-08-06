import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

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
