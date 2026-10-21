import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProspectingCategory } from '@prospectly/shared-types';

import {
  OPPORTUNITY_EXPLANATION_PROMPT_VERSION,
  OPPORTUNITY_PROFILE_PROMPT_VERSION,
  OPPORTUNITY_STRATEGY_PROMPT_VERSION,
} from '../opportunity-finder/opportunity-finder.constants';
import {
  AiDisabledException,
  AiInvalidStructuredOutputException,
  AiProviderUnavailableException,
  AiRateLimitException,
  AiTimeoutException,
} from './llm-provider/llm-provider.types';
import { LlmProviderService } from './llm-provider/llm-provider.service';
import { StructuredAiService } from './structured-ai.service';

describe('StructuredAiService', () => {
  let service: StructuredAiService;
  let llmProviderMock: {
    generateStructured: jest.Mock;
    isAiEnabled: jest.Mock;
  };
  let configMock: {
    get: jest.Mock;
  };

  const defaultContext = {
    organizationId: 'org-test-1',
    userId: 'user-test-1',
    opportunityRunId: 'run-test-1',
    candidateId: 'cand-test-1',
  };

  const validProfileData = {
    service: 'Criação de sites',
    niche: 'restaurantes',
    categories: ['restaurant' as ProspectingCategory],
    summary: 'Restaurantes locais que precisam de site institucional',
    targetCompanyDescription: 'Pequenos restaurantes e bistrôs',
    buyingScenarios: ['Sem presença digital', 'Cardápio apenas em PDF'],
    valuableSignals: [
      {
        signalType: 'WITHOUT_WEBSITE' as const,
        weight: 30,
        rationale: 'Falta de site próprio',
      },
    ],
    qualificationCriteria: ['Possui endereço fixo'],
    disqualificationCriteria: ['Grandes franquias'],
  };

  const validStrategyData = {
    categories: ['restaurant' as ProspectingCategory],
    searchPhrases: ['restaurante em curitiba', 'bistrô'],
    preferredSources: ['GOOGLE_PLACES' as const],
    prioritySignals: ['WITHOUT_WEBSITE' as const],
    minimumRating: 3.5,
    minimumReviews: 5,
  };

  const validExplanationData = {
    summary: 'Empresa com forte oportunidade de presença online',
    whyOpportunity: 'Não possui website próprio e tem boa avaliação local',
    recommendedOffer: 'Criação de site responsivo com cardápio digital',
    commercialAngle: 'Abordar destacando visibilidade no Google',
    warnings: ['Verificar se não mudou de endereço'],
  };

  beforeEach(() => {
    llmProviderMock = {
      generateStructured: jest.fn(),
      isAiEnabled: jest.fn().mockReturnValue(true),
    };
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'opportunityAi.enabled') return true;
        if (key === 'opportunityAi.model') return undefined;
        return undefined;
      }),
    };
    service = new StructuredAiService(
      configMock as unknown as ConfigService,
      llmProviderMock as unknown as LlmProviderService,
    );
  });

  describe('isOpportunityAiEnabled', () => {
    it('returns true when opportunityAi.enabled is true and llmProvider.isAiEnabled is true', () => {
      configMock.get.mockReturnValue(true);
      llmProviderMock.isAiEnabled.mockReturnValue(true);
      expect(service.isOpportunityAiEnabled()).toBe(true);
    });

    it('returns false when opportunityAi.enabled is false', () => {
      configMock.get.mockReturnValue(false);
      llmProviderMock.isAiEnabled.mockReturnValue(true);
      expect(service.isOpportunityAiEnabled()).toBe(false);
    });

    it('returns false when opportunityAi.enabled is string "false"', () => {
      configMock.get.mockReturnValue('false');
      llmProviderMock.isAiEnabled.mockReturnValue(true);
      expect(service.isOpportunityAiEnabled()).toBe(false);
    });

    it('returns false when opportunityAi.enabled is "0"', () => {
      configMock.get.mockReturnValue('0');
      llmProviderMock.isAiEnabled.mockReturnValue(true);
      expect(service.isOpportunityAiEnabled()).toBe(false);
    });

    it('returns false when llmProvider.isAiEnabled is false (AI_PROVIDER=disabled)', () => {
      configMock.get.mockReturnValue(true);
      llmProviderMock.isAiEnabled.mockReturnValue(false);
      expect(service.isOpportunityAiEnabled()).toBe(false);
    });
  });

  describe('buildOpportunityProfile', () => {
    it('generates a valid profile and preserves prompt version opportunity-profile:v2', async () => {
      llmProviderMock.generateStructured.mockResolvedValueOnce({
        data: validProfileData,
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 400,
        fallbackUsed: false,
        retriesCount: 0,
      });

      const input = {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      };

      const result = await service.buildOpportunityProfile(defaultContext, input);

      expect(result).toEqual(validProfileData);
      expect(llmProviderMock.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            organizationId: 'org-test-1',
            userId: 'user-test-1',
            opportunityRunId: 'run-test-1',
            task: 'OPPORTUNITY_PROFILE',
            promptVersion: OPPORTUNITY_PROFILE_PROMPT_VERSION,
          }),
          task: 'OPPORTUNITY_PROFILE',
          promptVersion: OPPORTUNITY_PROFILE_PROMPT_VERSION,
          temperature: 0.2,
          maxTokens: 900,
        }),
        undefined,
      );
      expect(OPPORTUNITY_PROFILE_PROMPT_VERSION).toBe('opportunity-profile:v2');
    });

    it('returns null immediately when opportunity AI is disabled', async () => {
      configMock.get.mockReturnValue(false);

      const result = await service.buildOpportunityProfile(defaultContext, {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      });

      expect(result).toBeNull();
      expect(llmProviderMock.generateStructured).not.toHaveBeenCalled();
    });

    it('passes custom model override when opportunityAi.model is configured', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'opportunityAi.enabled') return true;
        if (key === 'opportunityAi.model') return '@cf/qwen/qwen3-30b-a3b-fp8';
        return undefined;
      });

      llmProviderMock.generateStructured.mockResolvedValueOnce({
        data: validProfileData,
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        provider: 'cloudflare',
        model: '@cf/qwen/qwen3-30b-a3b-fp8',
        durationMs: 300,
        fallbackUsed: false,
        retriesCount: 0,
      });

      await service.buildOpportunityProfile(defaultContext, {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      });

      expect(llmProviderMock.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          model: '@cf/qwen/qwen3-30b-a3b-fp8',
        }),
        undefined,
      );
    });
  });

  describe('buildSearchStrategy', () => {
    it('generates a valid search strategy and preserves prompt version search-strategy:v2', async () => {
      llmProviderMock.generateStructured.mockResolvedValueOnce({
        data: validStrategyData,
        usage: { promptTokens: 60, completionTokens: 80, totalTokens: 140 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 350,
        fallbackUsed: false,
        retriesCount: 0,
      });

      const result = await service.buildSearchStrategy(defaultContext, validProfileData as never);

      expect(result).toEqual(validStrategyData);
      expect(llmProviderMock.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            task: 'SEARCH_STRATEGY',
            promptVersion: OPPORTUNITY_STRATEGY_PROMPT_VERSION,
          }),
          task: 'SEARCH_STRATEGY',
          promptVersion: OPPORTUNITY_STRATEGY_PROMPT_VERSION,
        }),
        undefined,
      );
      expect(OPPORTUNITY_STRATEGY_PROMPT_VERSION).toBe('search-strategy:v2');
    });
  });

  describe('explainOpportunity', () => {
    it('generates explanation and tags source as AI with opportunity-explanation:v1', async () => {
      llmProviderMock.generateStructured.mockResolvedValueOnce({
        data: validExplanationData,
        usage: { promptTokens: 100, completionTokens: 90, totalTokens: 190 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 450,
        fallbackUsed: false,
        retriesCount: 0,
      });

      const input = {
        service: 'Criação de sites',
        company: { companyName: 'Restaurante Sabor' },
        signals: [],
        scoreBreakdown: {
          version: 'opportunity-score-v1' as const,
          dna: { need: 80, quality: 70, reach: 60, timing: 50, fit: 90 },
          reasons: [],
        },
      };

      const result = await service.explainOpportunity(defaultContext, input);

      expect(result).toEqual({
        ...validExplanationData,
        source: 'AI',
      });
      expect(llmProviderMock.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            task: 'OPPORTUNITY_EXPLANATION',
            promptVersion: OPPORTUNITY_EXPLANATION_PROMPT_VERSION,
          }),
          task: 'OPPORTUNITY_EXPLANATION',
          promptVersion: OPPORTUNITY_EXPLANATION_PROMPT_VERSION,
        }),
        undefined,
      );
      expect(OPPORTUNITY_EXPLANATION_PROMPT_VERSION).toBe('opportunity-explanation:v1');
    });
  });

  describe('JSON inválido, nova tentativa e queda limpa (graceful fallback)', () => {
    it('does not log sensitive messages from unexpected provider errors', async () => {
      const sensitiveMessage = 'provider response with private@example.com and bearer-secret';
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      llmProviderMock.generateStructured.mockRejectedValueOnce(new Error(sensitiveMessage));

      try {
        await expect(
          service.buildOpportunityProfile(defaultContext, {
            service: 'Criação de sites',
            niche: 'restaurantes',
            categories: ['restaurant' as ProspectingCategory],
          }),
        ).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.objectContaining({ code: 'AI_FAILED' }));
        expect(JSON.stringify(warn.mock.calls)).not.toContain(sensitiveMessage);
      } finally {
        warn.mockRestore();
      }
    });

    it('returns data when provider succeeds on retry after initial invalid JSON', async () => {
      llmProviderMock.generateStructured.mockResolvedValueOnce({
        data: validProfileData,
        usage: { promptTokens: 80, completionTokens: 120, totalTokens: 200 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 700,
        fallbackUsed: false,
        retriesCount: 1,
      });

      const result = await service.buildOpportunityProfile(defaultContext, {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      });

      expect(result).toEqual(validProfileData);
    });

    it('falls back cleanly (returns null) when retry also fails with invalid JSON', async () => {
      llmProviderMock.generateStructured.mockRejectedValueOnce(
        new AiInvalidStructuredOutputException(
          'AI output failed structured schema validation after retry',
        ),
      );

      const result = await service.buildOpportunityProfile(defaultContext, {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      });

      expect(result).toBeNull();
    });

    it('falls back cleanly (returns null) on AiTimeoutException', async () => {
      llmProviderMock.generateStructured.mockRejectedValueOnce(
        new AiTimeoutException('AI request timed out', 25000),
      );

      const result = await service.buildSearchStrategy(defaultContext, validProfileData as never);

      expect(result).toBeNull();
    });

    it('falls back cleanly (returns null) on AiRateLimitException', async () => {
      llmProviderMock.generateStructured.mockRejectedValueOnce(
        new AiRateLimitException('Rate limit exceeded', 429),
      );

      const result = await service.explainOpportunity(defaultContext, {
        service: 'Criação de sites',
        company: { companyName: 'Restaurante Sabor' },
        signals: [],
        scoreBreakdown: {
          version: 'opportunity-score-v1' as const,
          dna: { need: 80, quality: 70, reach: 60, timing: 50, fit: 90 },
          reasons: [],
        },
      });

      expect(result).toBeNull();
    });

    it('falls back cleanly (returns null) on AiProviderUnavailableException', async () => {
      llmProviderMock.generateStructured.mockRejectedValueOnce(
        new AiProviderUnavailableException('All AI provider attempts failed'),
      );

      const result = await service.buildOpportunityProfile(defaultContext, {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      });

      expect(result).toBeNull();
    });

    it('falls back cleanly (returns null) on AiDisabledException', async () => {
      llmProviderMock.generateStructured.mockRejectedValueOnce(
        new AiDisabledException('AI provider is currently disabled'),
      );

      const result = await service.buildOpportunityProfile(defaultContext, {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
      });

      expect(result).toBeNull();
    });
  });

  describe('Sanitização de payload', () => {
    it('sanitizes input before passing to generateStructured to prevent PII leakage', async () => {
      llmProviderMock.generateStructured.mockResolvedValueOnce({
        data: validProfileData,
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        provider: 'cloudflare',
        model: '@cf/openai/gpt-oss-120b',
        durationMs: 400,
        fallbackUsed: false,
        retriesCount: 0,
      });

      const inputWithSensitiveData = {
        service: 'Criação de sites',
        niche: 'restaurantes',
        categories: ['restaurant' as ProspectingCategory],
        email: 'secret@empresa.com.br',
        phone: '11999999999',
        password: 'super-secret-password',
      };

      await service.buildOpportunityProfile(defaultContext, inputWithSensitiveData as never);

      expect(llmProviderMock.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            service: 'Criação de sites',
            niche: 'restaurantes',
            categories: ['restaurant'],
          },
        }),
        undefined,
      );
    });
  });
});
