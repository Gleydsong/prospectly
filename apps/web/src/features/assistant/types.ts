export type AssistantRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  toolResult?: {
    name: string;
    result: Record<string, unknown>;
  };
}

export interface PendingActionIntent {
  intentId: string;
  customerId: string;
  customerName: string;
  action: string;
  summary: string;
  message: string;
}

export type AssistantStatus = 'idle' | 'streaming' | 'awaiting_approval' | 'error';
