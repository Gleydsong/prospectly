import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { SuppressionService } from '../privacy/suppression.service';
import type { LlmProviderService } from '../ai/llm-provider/llm-provider.service';
import {
  AiDisabledException,
  AiProviderUnavailableException,
  AiTimeoutException,
} from '../ai/llm-provider/llm-provider.types';
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
        where: { organizationId: orgId, deletedAt: null },
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

    it('propagates AiDisabledException, AiTimeoutException and AiProviderUnavailableException without swallowing', async () => {
      // 1. AiTimeoutException
      // eslint-disable-next-line require-yield
      mockLlmProvider.streamChat.mockImplementationOnce(async function* () {
        throw new AiTimeoutException('Timeout connecting to Cloudflare', 5000);
      });

      const timeoutGen = service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Quantos clientes temos?' }],
        simulateTool: 'count_customers',
      });

      await expect(async () => {
        for await (const _ of timeoutGen) {
          // drain
        }
      }).rejects.toThrow(AiTimeoutException);

      // 2. AiDisabledException
      // eslint-disable-next-line require-yield
      mockLlmProvider.streamChat.mockImplementationOnce(async function* () {
        throw new AiDisabledException('AI disabled');
      });

      const disabledGen = service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Quantos clientes temos?' }],
        simulateTool: 'count_customers',
      });

      await expect(async () => {
        for await (const _ of disabledGen) {
          // drain
        }
      }).rejects.toThrow(AiDisabledException);

      // 3. AiProviderUnavailableException
      // eslint-disable-next-line require-yield
      mockLlmProvider.streamChat.mockImplementationOnce(async function* () {
        throw new AiProviderUnavailableException('Service down', 'cloudflare');
      });

      const unavailGen = service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Quantos clientes temos?' }],
        simulateTool: 'count_customers',
      });

      await expect(async () => {
        for await (const _ of unavailGen) {
          // drain
        }
      }).rejects.toThrow(AiProviderUnavailableException);
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

    it('returns safe message and does NOT create approval intent when customer is not found (no cust_simulated)', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Padaria Fantasma' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Padaria Fantasma',
      })) {
        events.push(event);
      }

      // Must NOT emit approval_required
      const approvalEvent = events.find((e) => e.type === 'approval_required');
      expect(approvalEvent).toBeUndefined();

      // Must NOT contain any simulated customer intent
      const toolCall = events.find((e) => e.type === 'tool_call');
      expect(toolCall).toBeUndefined();

      const textChunks = events
        .filter((e) => e.type === 'chunk')
        .map((e) => String(e.data.text ?? ''))
        .join('');
      expect(textChunks).toContain('Cliente "Padaria Fantasma" não encontrado na organização');

      const done = events.find((e) => e.type === 'done');
      expect(done?.data.status).toBe('customer_not_found');
    });

    it('searches customer filtering deletedAt: null and matching companyName or tradeName', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-trade',
        companyName: 'Razão Social X Ltda',
        tradeName: 'Nome Fantasia Central',
        email: 'contato@central.com',
        phone: '11999998888',
        doNotContact: false,
      });

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Nome Fantasia Central' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Nome Fantasia Central',
      })) {
        events.push(event);
      }

      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { companyName: { contains: 'Nome Fantasia Central', mode: 'insensitive' } },
            { tradeName: { contains: 'Nome Fantasia Central', mode: 'insensitive' } },
          ],
        },
        select: expect.objectContaining({
          id: true,
          companyName: true,
          tradeName: true,
          email: true,
          phone: true,
          whatsapp: true,
          domain: true,
          doNotContact: true,
        }),
      });

      const approvalEvent = events.find((e) => e.type === 'approval_required');
      expect(approvalEvent).toBeDefined();
    });

    it('checks suppression for whatsapp channel when phone is empty string', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-whatsapp',
        companyName: 'Lava Rápido Zap',
        tradeName: null,
        email: 'zap@example.com',
        phone: '', // empty string should fall through to whatsapp
        whatsapp: '+5511988887777',
        doNotContact: false,
      });
      // Mock isSuppressed to return true when called with whatsapp
      mockSuppression.isSuppressed.mockImplementation(async (_orgId, identifiers) => {
        return identifiers.phone === '+5511988887777';
      });

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Lava Rápido Zap' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Lava Rápido Zap',
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

    it.each([
      ['email', 'suprimido@example.com'],
      ['domain', 'suprimido.com.br'],
    ])('blocks whatsapp-only customer suppressed by %s', async (key, value) => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-whatsapp-only',
        companyName: 'Oficina Só Zap',
        tradeName: null,
        email: 'suprimido@example.com',
        domain: 'suprimido.com.br',
        phone: null,
        whatsapp: '+5511977776666',
        doNotContact: false,
      });
      mockSuppression.isSuppressed.mockImplementation(
        async (_orgId, identifiers: Record<string, string | null | undefined>) =>
          identifiers[key] === value,
      );

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.streamConversation({
        organizationId: orgId,
        userId,
        messages: [{ role: 'user', content: 'Agende contato com Oficina Só Zap' }],
        simulateTool: 'propose_customer_action',
        simulateCustomerName: 'Oficina Só Zap',
      })) {
        events.push(event);
      }

      expect(events.find((e) => e.type === 'approval_required')).toBeUndefined();
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

    it('rejects decision when userId does not match intent creator (H1)', async () => {
      const generator = service.resumeDecision({
        organizationId: orgId,
        userId: 'different-user-id',
        intentId,
        decision: 'approve',
      });

      await expect(generator.next()).rejects.toThrow(ForbiddenException);
    });

    it('rejects decision when user has role VIEWER (H1)', async () => {
      const generator = service.resumeDecision({
        organizationId: orgId,
        userId,
        userRole: 'VIEWER',
        intentId,
        decision: 'approve',
      });

      await expect(generator.next()).rejects.toThrow(ForbiddenException);
    });

    it('fails closed and cancels action if customer was deleted or missing at decision time (H2, M1)', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      const events: AssistantSpikeStreamEvent[] = [];
      for await (const event of service.resumeDecision({
        organizationId: orgId,
        userId,
        intentId,
        decision: 'approve',
      })) {
        events.push(event);
      }

      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-123', organizationId: orgId, deletedAt: null },
        select: expect.objectContaining({ id: true, doNotContact: true }),
      });

      const text = events
        .filter((e) => e.type === 'chunk')
        .map((e) => String(e.data.text ?? ''))
        .join('');
      expect(text).toContain('não foi encontrado ou foi excluído');

      const done = events.find((e) => e.type === 'done');
      expect(done?.data.status).toBe('customer_missing');
    });

    it('re-checks suppression on whatsapp channel during decision resumption (H2)', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'cust-123',
        companyName: 'Mecânica Central',
        tradeName: null,
        email: 'central@example.com',
        phone: '',
        whatsapp: '+5511977776666',
        doNotContact: false,
      });
      mockSuppression.isSuppressed.mockImplementation(async (_orgId, identifiers) => {
        return identifiers.phone === '+5511977776666';
      });

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
      expect(text).toContain('lista de supressão');

      const done = events.find((e) => e.type === 'done');
      expect(done?.data.status).toBe('blocked_suppressed');
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
