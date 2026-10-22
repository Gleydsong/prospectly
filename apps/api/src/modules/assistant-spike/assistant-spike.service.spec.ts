import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { SuppressionService } from '../privacy/suppression.service';
import type { LlmProviderService } from '../ai/llm-provider/llm-provider.service';
import { AssistantSpikeService, type AssistantSpikeStreamEvent } from './assistant-spike.service';

describe('AssistantSpikeService', () => {
  let service: AssistantSpikeService;
  let mockPrisma: {
    lead: {
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let mockSuppression: {
    isSuppressed: jest.Mock;
  };
  let mockLlmProvider: {
    streamChat: jest.Mock;
  };

  const orgId = 'org-1111-1111';
  const otherOrgId = 'org-2222-2222';
  const userId = 'user-1111-1111';

  beforeEach(() => {
    mockPrisma = {
      lead: {
        count: jest.fn().mockResolvedValue(42),
        findFirst: jest.fn(),
      },
    };

    mockSuppression = {
      isSuppressed: jest.fn().mockResolvedValue(false),
    };

    mockLlmProvider = {
      streamChat: jest.fn(async function* () {
        yield { contentDelta: 'Olá ', isDone: false };
        yield { contentDelta: 'cliente!', isDone: true };
      }),
    };

    service = new AssistantSpikeService(
      mockLlmProvider as unknown as LlmProviderService,
      mockPrisma as unknown as PrismaService,
      mockSuppression as unknown as SuppressionService,
    );
  });

  describe('read-only tool: count_customers', () => {
    it('executes database count for the organization and yields tool events and stream chunks', async () => {
      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Quantos clientes temos?' }],
        simulateTool: 'count_customers',
      })) {
        events.push(event);
      }

      expect(mockPrisma.lead.count).toHaveBeenCalledWith({
        where: { organizationId: orgId },
      });

      const toolCall = events.find((e) => e.type === 'tool_call');
      expect(toolCall).toBeDefined();
      expect(toolCall?.data.name).toBe('count_customers');

      const toolResult = events.find((e) => e.type === 'tool_result');
      expect(toolResult).toBeDefined();
      expect(toolResult?.data.result).toEqual({ count: 42 });

      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
    });
  });

  describe('simulated write tool: propose_customer_action and DNC / suppression checks', () => {
    it('blocks action and does NOT create approval intent when customer is marked as Do Not Contact (DNC)', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-dnc',
        companyName: 'Padaria Bloqueada',
        email: 'dnc@example.com',
        phone: '11999999999',
        doNotContact: true,
      });

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Padaria Bloqueada' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Padaria Bloqueada',
      })) {
        events.push(event);
      }

      // Must NOT emit approval_required
      const approvalEvent = events.find((e) => e.type === 'approval_required');
      expect(approvalEvent).toBeUndefined();

      // Must emit a message indicating DNC restriction
      const textChunks = events
        .filter((e) => e.type === 'chunk')
        .map((e) => String(e.data.text ?? ''))
        .join('');
      expect(textChunks).toContain('restrição de contato');
      expect(textChunks).toContain('Não Contatar');
    });

    it('blocks action and does NOT create approval intent when customer is in suppression list', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-suppressed',
        companyName: 'Restaurante Suprimido',
        email: 'suprimido@example.com',
        phone: '11888888888',
        doNotContact: false,
      });
      mockSuppression.isSuppressed.mockResolvedValue(true);

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Restaurante Suprimido' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Restaurante Suprimido',
      })) {
        events.push(event);
      }

      const approvalEvent = events.find((e) => e.type === 'approval_required');
      expect(approvalEvent).toBeUndefined();

      const textChunks = events
        .filter((e) => e.type === 'chunk')
        .map((e) => String(e.data.text ?? ''))
        .join('');
      expect(textChunks).toContain('suprimido');
    });

    it('emits approval_required event with intentId for allowed customer without executing immediately', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-clean',
        companyName: 'Borracharia Limpa',
        email: 'limpa@example.com',
        phone: '11777777777',
        doNotContact: false,
      });
      mockSuppression.isSuppressed.mockResolvedValue(false);

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Borracharia Limpa' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Borracharia Limpa',
      })) {
        events.push(event);
      }

      const approvalEvent = events.find((e) => e.type === 'approval_required');
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent?.data.intentId).toBeDefined();
      expect(approvalEvent?.data.customerName).toBe('Borracharia Limpa');
      expect(approvalEvent?.data.action).toBe('schedule_followup');
    });
  });

  describe('approval_required + resumption decision', () => {
    let intentId: string;

    beforeEach(async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-123',
        companyName: 'Mecânica Central',
        email: 'central@example.com',
        phone: '11666666666',
        doNotContact: false,
      });
      mockSuppression.isSuppressed.mockResolvedValue(false);

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Mecânica Central' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Mecânica Central',
      })) {
        events.push(event);
      }

      const approvalEvent = events.find((e) => e.type === 'approval_required');
      intentId = String(approvalEvent?.data.intentId ?? '');
    });

    it('resumes and confirms action when approved by operator', async () => {
      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.resumeDecision({
        organizationId: orgId,
        userId,
        intentId,
        decision: 'approve',
      })) {
        events.push(event);
      }

      const text = events
        .filter((e) => e.type === 'chunk')
        .map((e) => String(e.data.text ?? ''))
        .join('');
      expect(text).toContain('aprovada');
      expect(text).toContain('Mecânica Central');

      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
      expect(done?.data.status).toBe('approved');
    });

    it('resumes and informs cancellation when rejected by operator', async () => {
      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.resumeDecision({
        organizationId: orgId,
        userId,
        intentId,
        decision: 'reject',
      })) {
        events.push(event);
      }

      const text = events
        .filter((e) => e.type === 'chunk')
        .map((e) => String(e.data.text ?? ''))
        .join('');
      expect(text).toContain('rejeitada');
      expect(text).toContain('Nenhuma modificação');

      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
      expect(done?.data.status).toBe('rejected');
    });

    it('rejects decision from another organization (tenant isolation)', async () => {
      const generator = service.resumeDecision({
        organizationId: otherOrgId,
        userId,
        intentId,
        decision: 'approve',
      });

      await expect(generator.next()).rejects.toThrow(ForbiddenException);
    });

    it('rejects duplicate decision on already-decided intent', async () => {
      // First decision
      for await (const _ of service.resumeDecision({
        organizationId: orgId,
        userId,
        intentId,
        decision: 'approve',
      })) {
        // drain
      }

      // Second decision on same intent
      const secondGen = service.resumeDecision({
        organizationId: orgId,
        userId,
        intentId,
        decision: 'approve',
      });

      await expect(secondGen.next()).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown intentId', async () => {
      const generator = service.resumeDecision({
        organizationId: orgId,
        userId,
        intentId: 'non-existent-intent',
        decision: 'approve',
      });

      await expect(generator.next()).rejects.toThrow(NotFoundException);
    });
  });

  describe('abort propagation', () => {
    it('stops stream when abort signal is aborted', async () => {
      const controller = new AbortController();

      mockLlmProvider.streamChat.mockImplementation(async function* (req: { signal?: AbortSignal }) {
        yield { contentDelta: 'Parte 1', isDone: false };
        if (req.signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AiRequestAbortedException';
          throw err;
        }
        yield { contentDelta: 'Parte 2', isDone: true };
      });

      controller.abort();

      const events: AssistantSpikeStreamEvent[] = [];
      await expect(async () => {
        for await (const event of service.streamConversation({
          organizationId: orgId,
          userId,
          messages: [{ role: 'user', content: 'Olá' }],
          signal: controller.signal,
        })) {
          events.push(event);
        }
      }).rejects.toThrow();
    });
  });
});
