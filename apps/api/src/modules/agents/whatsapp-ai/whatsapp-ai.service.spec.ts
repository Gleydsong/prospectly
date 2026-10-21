import { Logger } from '@nestjs/common';
import { WhatsappAiService } from './whatsapp-ai.service';
import type { LlmProviderService } from '../../ai/llm-provider/llm-provider.service';
import {
  AiProviderUnavailableException,
  AiTimeoutException,
} from '../../ai/llm-provider/llm-provider.types';
import type { LeadContextForWhatsappAi } from './whatsapp-ai.types';

describe('WhatsappAiService', () => {
  const baseLead: LeadContextForWhatsappAi = {
    companyName: 'Padaria Central',
    tradeName: 'Padaria Central',
    city: 'Recife',
    segment: 'Padaria',
    website: 'https://padariacentral.com.br',
    senderName: 'Ana',
    sequenceStage: 'FIRST_MESSAGE',
    auditSignals: {
      hasWhatsappOnSite: false,
      isMobileFriendly: true,
      isSlow: false,
    },
  };

  function createMockLlmProvider(overrides: Partial<LlmProviderService> = {}): LlmProviderService {
    return {
      isAiEnabled: jest.fn().mockReturnValue(true),
      getProvider: jest.fn().mockReturnValue('cloudflare'),
      generateStructured: jest.fn().mockResolvedValue({
        data: {
          variants: [
            { angle: 'direto', body: 'Olá! Mensagem direta da Ana.' },
            { angle: 'curiosidade', body: 'Olá! Sabia dessa novidade?' },
            { angle: 'prova_social', body: 'Olá! Vários clientes em Recife usam.' },
            { angle: 'dor_site', body: 'Notei que o site não tem WhatsApp.' },
            { angle: 'oferta_leve', body: 'Podemos testar sem custo?' },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 450,
        fallbackUsed: false,
        retriesCount: 0,
      }),
      chat: jest.fn(),
      streamChat: jest.fn(),
      ...overrides,
    } as unknown as LlmProviderService;
  }

  it('generates variants via LlmProviderService when enabled', async () => {
    const llmProvider = createMockLlmProvider();
    const service = new WhatsappAiService(llmProvider);

    const result = await service.generateVariants(baseLead, 4, 1, 'org-123', 'user-456');

    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    expect(result![0]).toEqual({
      id: 'ai-1-direto-1',
      angle: 'direto',
      label: 'Direto',
      body: 'Olá! Mensagem direta da Ana.',
    });
    expect(result![1]?.id).toBe('ai-1-curiosidade-2');
    expect(result![2]?.id).toBe('ai-1-prova_social-3');
    expect(result![3]?.id).toBe('ai-1-dor_site-4');

    expect(llmProvider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          organizationId: 'org-123',
          userId: 'user-456',
          task: 'WHATSAPP_VARIANTS',
          promptVersion: 'v1',
        },
        system: expect.stringContaining('Você escreve 1ª mensagens de WhatsApp'),
        input: expect.objectContaining({
          companyName: 'Padaria Central',
          city: 'Recife',
          senderName: 'Ana',
          seed: 1,
          angles: ['direto', 'curiosidade', 'prova_social', 'dor_site'],
        }),
      }),
    );
  });

  it('supports the single variant requested by the SDR runtime', async () => {
    const result = await new WhatsappAiService(createMockLlmProvider()).generateVariants(
      baseLead,
      1,
      0,
      'org-123',
    );
    expect(result).toHaveLength(1);
    expect(result?.[0]?.angle).toBe('direto');
  });

  it('never logs external exception messages', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const llmProvider = createMockLlmProvider({
        generateStructured: jest.fn().mockRejectedValue(new Error('private-customer-payload')),
      });
      expect(
        await new WhatsappAiService(llmProvider).generateVariants(baseLead, 4, 0, 'org-123'),
      ).toBeNull();
      expect(warn).toHaveBeenCalled();
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private-customer-payload');
    } finally {
      warn.mockRestore();
    }
  });

  it('returns null immediately when AI provider is disabled', async () => {
    const llmProvider = createMockLlmProvider({
      isAiEnabled: jest.fn().mockReturnValue(false),
    });
    const service = new WhatsappAiService(llmProvider);

    const result = await service.generateVariants(baseLead, 4, 0, 'org-123');

    expect(result).toBeNull();
    expect(llmProvider.generateStructured).not.toHaveBeenCalled();
  });

  it('returns null for deterministic fallback when generateStructured throws AiTimeoutException', async () => {
    const llmProvider = createMockLlmProvider({
      generateStructured: jest.fn().mockRejectedValue(new AiTimeoutException('Timeout')),
    });
    const service = new WhatsappAiService(llmProvider);

    const result = await service.generateVariants(baseLead, 4, 0, 'org-123');

    expect(result).toBeNull();
  });

  it('returns null for deterministic fallback when generateStructured throws AiProviderUnavailableException', async () => {
    const llmProvider = createMockLlmProvider({
      generateStructured: jest
        .fn()
        .mockRejectedValue(new AiProviderUnavailableException('All providers failed')),
    });
    const service = new WhatsappAiService(llmProvider);

    const result = await service.generateVariants(baseLead, 4, 0, 'org-123');

    expect(result).toBeNull();
  });

  it('returns null when returned variants count is below 3', async () => {
    const llmProvider = createMockLlmProvider({
      generateStructured: jest.fn().mockResolvedValue({
        data: {
          variants: [{ angle: 'direto', body: 'Apenas uma variante.' }],
        },
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 200,
        fallbackUsed: false,
        retriesCount: 0,
      }),
    });
    const service = new WhatsappAiService(llmProvider);

    const result = await service.generateVariants(baseLead, 4, 0, 'org-123');

    expect(result).toBeNull();
  });

  it('adjusts system instruction for FOLLOW_UP_1, FOLLOW_UP_2, and BREAKUP stages', async () => {
    const llmProvider = createMockLlmProvider();
    const service = new WhatsappAiService(llmProvider);

    await service.generateVariants({ ...baseLead, sequenceStage: 'FOLLOW_UP_1' }, 3, 0, 'org-123');
    expect(llmProvider.generateStructured).toHaveBeenLastCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('1º follow-up suave'),
      }),
    );

    await service.generateVariants({ ...baseLead, sequenceStage: 'FOLLOW_UP_2' }, 3, 0, 'org-123');
    expect(llmProvider.generateStructured).toHaveBeenLastCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('2º follow-up com agregação de valor'),
      }),
    );

    await service.generateVariants({ ...baseLead, sequenceStage: 'BREAKUP' }, 3, 0, 'org-123');
    expect(llmProvider.generateStructured).toHaveBeenLastCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('mensagem de encerramento educada'),
      }),
    );
  });
});
