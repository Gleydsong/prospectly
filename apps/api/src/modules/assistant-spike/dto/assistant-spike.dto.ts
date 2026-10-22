import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AssistantChatMessageDto {
  @IsString()
  @IsIn(['user', 'assistant', 'system', 'tool'])
  role!: 'user' | 'assistant' | 'system' | 'tool';

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  tool_call_id?: string;
}

export class AssistantStreamRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantChatMessageDto)
  messages!: AssistantChatMessageDto[];

  @IsOptional()
  @IsIn(['count_customers', 'propose_customer_action'])
  simulateTool?: 'count_customers' | 'propose_customer_action';

  @IsOptional()
  @IsString()
  simulateCustomerName?: string;
}

export class AssistantDecisionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}
