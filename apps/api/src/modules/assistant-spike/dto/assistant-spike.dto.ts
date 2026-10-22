import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AssistantChatMessageDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
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
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssistantChatMessageDto)
  messages!: AssistantChatMessageDto[];

  @IsOptional()
  @IsIn(['count_customers', 'propose_customer_action'])
  simulateTool?: 'count_customers' | 'propose_customer_action';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  simulateCustomerName?: string;
}

export class AssistantDecisionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}
