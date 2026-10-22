import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithTenant } from '../../common/prisma/tenant-context';
import { SuppressionService } from '../privacy/suppression.service';
import { LlmProviderService } from '../ai/llm-provider/llm-provider.service';
import type { LlmMessage } from '../ai/llm-provider/llm-provider.types';
import type { AssistantChatMessageDto } from './dto/assistant-spike.dto';

export type AssistantSpikeStreamEventType =
  | 'chunk'
  | 'tool_call'
  | 'tool_result'
  | 'approval_required'
  | 'done'
  | 'error';

export interface AssistantSpikeStreamEvent {
  type: AssistantSpikeStreamEventType;
  data: Record<string, unknown>;
}

export interface ActionIntent {
  id: string;
  organizationId: string;
  userId: string;
  customerId: string;
  customerName: string;
  action: string;
  summary: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

const INTENT_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class AssistantSpikeService {
  private readonly logger = new Logger(AssistantSpikeService.name);
  private readonly intents = new Map<string, ActionIntent>();

  constructor(
    private readonly llmProvider: LlmProviderService,
    private readonly prisma: PrismaService,
    private readonly suppression: SuppressionService,
  ) {}

  /**
   * Cleans up expired intents in memory
   */
  private sweepExpiredIntents(): void {
    const now = Date.now();
    for (const [id, intent] of this.intents.entries()) {
      if (now > intent.expiresAt) {
        this.intents.delete(id);
      }
    }
  }

  async *streamConversation(params: {
    organizationId: string;
    userId: string;
    messages: AssistantChatMessageDto[];
    signal?: AbortSignal;
    simulateTool?: 'count_customers' | 'propose_customer_action';
    simulateCustomerName?: string;
  }): AsyncGenerator<AssistantSpikeStreamEvent, void, unknown> {
    const { organizationId, userId, messages, signal, simulateTool, simulateCustomerName } =
      params;
    this.sweepExpiredIntents();

    if (signal?.aborted) {
      const err = new Error('Request aborted');
      err.name = 'AiRequestAbortedException';
      throw err;
    }

    // 1. Tool simulation branch: Read-only tool "count_customers"
    if (simulateTool === 'count_customers') {
      yield {
        type: 'tool_call',
        data: {
          name: 'count_customers',
          arguments: {},
        },
      };

      // Execute read-only count under tenant context and RLS
      const count = await runWithTenant(organizationId, async () => {
        return this.prisma.lead.count({ where: { organizationId } });
      });

      yield {
        type: 'tool_result',
        data: {
          name: 'count_customers',
          result: { count },
        },
      };

      // Build context for LLM response
      const updatedMessages: LlmMessage[] = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'system',
          content: `Ferramenta count_customers retornou ${count} clientes cadastrados para esta organização. Informe o usuário de forma concisa em português usando o termo 'cliente' (nunca 'lead').`,
        },
      ];

      // Stream assistant explanation
      try {
        for await (const chunk of this.llmProvider.streamChat({
          context: {
            organizationId,
            userId,
            task: 'ASSISTANT_SPIKE_READ',
          },
          messages: updatedMessages,
          signal,
        })) {
          if (chunk.contentDelta) {
            yield {
              type: 'chunk',
              data: { text: chunk.contentDelta },
            };
          }
        }
      } catch (err: unknown) {
        if (signal?.aborted || (err as Error)?.name === 'AiRequestAbortedException') {
          throw err;
        }
        // Fallback friendly message if LLM provider offline during test/spike
        yield {
          type: 'chunk',
          data: {
            text: ` Você possui atualmente ${count} clientes cadastrados na sua organização.`,
          },
        };
      }

      yield {
        type: 'done',
        data: { status: 'completed' },
      };
      return;
    }

    // 2. Tool simulation branch: Write tool "propose_customer_action" (requires human approval)
    if (simulateTool === 'propose_customer_action') {
      const customerQuery = simulateCustomerName?.trim() || 'Cliente';

      // Find customer within organization
      const customer = await runWithTenant(organizationId, async () => {
        return this.prisma.lead.findFirst({
          where: {
            organizationId,
            ...(simulateCustomerName
              ? { companyName: { contains: simulateCustomerName, mode: 'insensitive' } }
              : {}),
          },
          select: {
            id: true,
            companyName: true,
            email: true,
            phone: true,
            whatsapp: true,
            domain: true,
            doNotContact: true,
          },
        });
      });

      // Verification A: Do Not Contact (DNC) flag
      if (customer?.doNotContact) {
        yield {
          type: 'chunk',
          data: {
            text: `O cliente "${customer.companyName}" possui restrição de contato (marcado como Não Contatar). Por política de privacidade e conformidade, nenhuma ação de contato ou abordagem pode ser sugerida ou realizada para este cliente.`,
          },
        };
        yield {
          type: 'done',
          data: { status: 'blocked_dnc' },
        };
        return;
      }

      // Verification B: Global / Tenant suppression list
      const isSuppressed = customer
        ? await this.suppression.isSuppressed(organizationId, {
            email: customer.email,
            phone: customer.phone ?? customer.whatsapp,
            domain: customer.domain,
          })
        : false;

      if (isSuppressed) {
        yield {
          type: 'chunk',
          data: {
            text: `O cliente "${customer?.companyName ?? customerQuery}" consta na lista de clientes suprimidos da organização. Nenhuma sugestão de abordagem ou contato foi criada.`,
          },
        };
        yield {
          type: 'done',
          data: { status: 'blocked_suppressed' },
        };
        return;
      }

      // Customer is clean: create approval intent (in-memory with TTL)
      const intentId = `intent_${randomUUID().replace(/-/g, '')}`;
      const customerId = customer?.id ?? 'cust_simulated';
      const customerName = customer?.companyName ?? customerQuery;
      const action = 'schedule_followup';
      const summary = `Agendar follow-up comercial com ${customerName}`;

      const intent: ActionIntent = {
        id: intentId,
        organizationId,
        userId,
        customerId,
        customerName,
        action,
        summary,
        createdAt: Date.now(),
        expiresAt: Date.now() + INTENT_TTL_MS,
        status: 'pending',
      };

      this.intents.set(intentId, intent);

      yield {
        type: 'tool_call',
        data: {
          name: 'propose_customer_action',
          arguments: { customerId, customerName, action, summary },
        },
      };

      yield {
        type: 'chunk',
        data: {
          text: `Preparei uma sugestão de ação para o cliente "${customerName}". Por envolver contato com o cliente, esta ação requer sua aprovação antes de qualquer execução.`,
        },
      };

      yield {
        type: 'approval_required',
        data: {
          intentId,
          customerId,
          customerName,
          action,
          summary,
          message: `Confirmação necessária: Agendar follow-up com "${customerName}"?`,
        },
      };

      yield {
        type: 'done',
        data: { status: 'awaiting_approval', intentId },
      };
      return;
    }

    // 3. Default branch: stream conversation directly through LlmProviderService
    const llmMessages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'Você é o assistente inteligente do Prospectly. Você auxilia na organização de clientes comerciais. Use sempre a palavra "cliente" e nunca "lead". Seja profissional, conciso e amigável.',
      },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    for await (const chunk of this.llmProvider.streamChat({
      context: {
        organizationId,
        userId,
        task: 'ASSISTANT_SPIKE_STREAM',
      },
      messages: llmMessages,
      signal,
    })) {
      if (chunk.contentDelta) {
        yield {
          type: 'chunk',
          data: { text: chunk.contentDelta },
        };
      }
    }

    yield {
      type: 'done',
      data: { status: 'completed' },
    };
  }

  async *resumeDecision(params: {
    organizationId: string;
    userId: string;
    intentId: string;
    decision: 'approve' | 'reject';
    signal?: AbortSignal;
  }): AsyncGenerator<AssistantSpikeStreamEvent, void, unknown> {
    const { organizationId, intentId, decision, signal } = params;
    this.sweepExpiredIntents();

    if (signal?.aborted) {
      const err = new Error('Request aborted');
      err.name = 'AiRequestAbortedException';
      throw err;
    }

    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new NotFoundException(`Ação pendente com id ${intentId} não encontrada ou já expirou`);
    }

    // Tenant isolation verification
    if (intent.organizationId !== organizationId) {
      throw new ForbiddenException('Ação não pertence à organização autenticada');
    }

    if (intent.status !== 'pending') {
      throw new BadRequestException('Esta ação já foi processada anteriormente');
    }

    if (Date.now() > intent.expiresAt) {
      this.intents.delete(intentId);
      throw new BadRequestException('Esta ação expirou e não pode mais ser processada');
    }

    if (decision === 'reject') {
      intent.status = 'rejected';
      yield {
        type: 'chunk',
        data: {
          text: `Ação para o cliente "${intent.customerName}" foi rejeitada pelo operador. Nenhuma modificação ou contato foi realizado.`,
        },
      };
      yield {
        type: 'done',
        data: { status: 'rejected', intentId },
      };
      return;
    }

    // decision === 'approve'
    // Re-verify DNC and suppression before taking any action (defense-in-depth)
    const customer = await runWithTenant(organizationId, async () => {
      return this.prisma.lead.findFirst({
        where: { id: intent.customerId, organizationId },
        select: {
          id: true,
          companyName: true,
          email: true,
          phone: true,
          whatsapp: true,
          domain: true,
          doNotContact: true,
        },
      });
    });

    if (customer?.doNotContact) {
      intent.status = 'rejected';
      yield {
        type: 'chunk',
        data: {
          text: `Ação cancelada: o cliente "${intent.customerName}" foi marcado como Não Contatar. Nenhuma mensagem ou contato foi enviado.`,
        },
      };
      yield {
        type: 'done',
        data: { status: 'blocked_dnc', intentId },
      };
      return;
    }

    const isSuppressed = customer
      ? await this.suppression.isSuppressed(organizationId, {
          email: customer.email,
          phone: customer.phone ?? customer.whatsapp,
          domain: customer.domain,
        })
      : false;

    if (isSuppressed) {
      intent.status = 'rejected';
      yield {
        type: 'chunk',
        data: {
          text: `Ação cancelada: o cliente "${intent.customerName}" encontra-se na lista de supressão.`,
        },
      };
      yield {
        type: 'done',
        data: { status: 'blocked_suppressed', intentId },
      };
      return;
    }

    // Mark as approved (simulated write tool without real outreach)
    intent.status = 'approved';

    yield {
      type: 'chunk',
      data: {
        text: `Ação "${intent.action}" para o cliente "${intent.customerName}" foi aprovada e confirmada pelo operador. A simulação foi concluída com sucesso sem disparar mensagens automáticas.`,
      },
    };

    yield {
      type: 'done',
      data: { status: 'approved', intentId },
    };
  }
}
