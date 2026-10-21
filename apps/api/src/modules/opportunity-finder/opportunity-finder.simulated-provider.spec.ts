import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OpportunityRunStatus, OpportunityCandidateStatus, AiRunStatus } from '@prisma/client';
import type { ProspectingCategory } from '@prospectly/shared-types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmBudgetService } from '../ai/llm-provider/llm-budget.service';
import { LlmProviderService } from '../ai/llm-provider/llm-provider.service';
import { LlmTelemetryService } from '../ai/llm-provider/llm-telemetry.service';
import { OpenAiCompatibleClient } from '../ai/llm-provider/openai-compatible.client';
import { StructuredAiService } from '../ai/structured-ai.service';
import {
  OPPORTUNITY_EXPLANATION_PROMPT_VERSION,
  OPPORTUNITY_PROFILE_PROMPT_VERSION,
  OPPORTUNITY_STRATEGY_PROMPT_VERSION,
} from './opportunity-finder.constants';
import { buildDeterministicOpportunityProfile } from './domain/opportunity-profile';
import { OpportunityFinderService } from './opportunity-finder.service';

describe('OpportunityFinderService with simulated Cloudflare provider (#371)', () => {
  const now = new Date('2026-10-20T10:00:00.000Z');

  const sampleProfilePayload = {
    service: 'Criação de sites',
    niche: 'restaurantes',
    categories: ['restaurant' as ProspectingCategory],
    targetCustomer: ['Restaurantes familiares', 'Bistrôs locais'],
    relevantSignals: ['MISSING_WEBSITE' as const, 'MISSING_HTTPS' as const],
  };

  const sampleStrategyPayload = {
    categories: ['restaurant' as ProspectingCategory],
    minimumRating: 4.0,
    minimumReviews: 10,
    relevantSignals: ['MISSING_WEBSITE' as const],
  };

  const sampleExplanationPayload = {
    summary: 'Restaurante tradicional com alta reputação mas sem presença na web',
    whyOpportunity: 'Possui 4.5 estrelas no Maps mas não tem site oficial próprio',
    recommendedOffer: 'Desenvolvimento de site com cardápio integrado e reservas',
    commercialAngle: 'Destacar aumento de reservas diretas sem comissões de delivery',
    warnings: ['Confirmar telefone antes de ligar'],
  };

  function createSimulatedHarness(options?: {
    opportunityAiEnabled?: boolean;
    aiProvider?: string;
    mockFetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  }) {
    const configData: Record<string, unknown> = {
      'ai.provider': options?.aiProvider ?? 'cloudflare',
      'ai.model': '@cf/openai/gpt-oss-120b',
      'ai.fallbackProvider': 'groq',
      'ai.fallbackModel': 'openai/gpt-oss-120b',
      'ai.cloudflare.accountId': 'cf-account-test',
      'ai.cloudflare.apiToken': 'cf-token-test',
      'ai.cloudflare.baseUrl': 'https://api.cloudflare.com/client/v4/accounts/cf-account-test/ai/v1',
      'ai.timeoutMs': 5000,
      'ai.maxRetries': 1,
      'ai.dailyBudgetTokens': 50000,
      'opportunityAi.enabled': options?.opportunityAiEnabled ?? true,
    };

    const configService = {
      get: jest.fn((key: string) => configData[key]),
    } as unknown as ConfigService;

    const prismaAiRuns: Array<Record<string, unknown>> = [];
    const candidateStore = new Map<string, Record<string, unknown>>();

    const prismaMock = {
      aiRun: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `ai-run-${prismaAiRuns.length + 1}`, ...data, createdAt: now };
          prismaAiRuns.push(row);
          return row;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const index = prismaAiRuns.findIndex((r) => r.id === where.id);
          if (index !== -1) {
            prismaAiRuns[index] = { ...prismaAiRuns[index], ...data };
            return prismaAiRuns[index];
          }
          return { id: where.id, ...data };
        }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { inputTokens: 50, outputTokens: 50 },
        }),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({ userId: 'user-sim-1' }),
      },
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      suppressionEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      opportunityRun: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
      },
      opportunityCandidate: {
        upsert: jest.fn().mockImplementation(async ({ create, update, where }: { create: Record<string, unknown>; update: Record<string, unknown>; where: { runId_externalId: { externalId: string } } }) => {
          const id = `cand-${where.runId_externalId.externalId}`;
          const existing = candidateStore.get(id);
          const merged = existing ? { ...existing, ...update } : { id, ...create };
          candidateStore.set(id, merged);
          return merged;
        }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockImplementation(async () => Array.from(candidateStore.values())),
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = candidateStore.get(where.id) ?? {
            id: where.id,
            runId: 'run-explain',
            status: OpportunityCandidateStatus.SCORED,
            company: { companyName: 'Restaurante Sabor' },
            signals: [],
            scoreBreakdown: {},
            overallScore: 85,
            confidenceScore: 80,
            dataCompleteness: 70,
            rankingCategory: 'restaurant',
            importedLeadId: null,
            analyzedAt: now,
          };
          const updated = { ...existing, ...data };
          candidateStore.set(where.id, updated);
          return updated;
        }),
      },
    };

    const defaultMockFetch = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      const systemMessage = body.messages?.find((m: { role: string }) => m.role === 'system')?.content ?? '';
      let content: unknown = sampleProfilePayload;
      if (systemMessage.includes('estratégia de descoberta')) {
        content = sampleStrategyPayload;
      } else if (systemMessage.includes('Explique uma oportunidade')) {
        content = sampleExplanationPayload;
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
          usage: { prompt_tokens: 30, completion_tokens: 40, total_tokens: 70 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const mockFetch = jest.fn(options?.mockFetchImpl ?? defaultMockFetch);

    const budgetService = new LlmBudgetService(configService, prismaMock as unknown as PrismaService);
    const telemetryService = new LlmTelemetryService(prismaMock as unknown as PrismaService);
    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    const llmProvider = new LlmProviderService(configService, budgetService, telemetryService, client);
    const aiService = new StructuredAiService(configService, llmProvider);

    const queue = { add: jest.fn().mockResolvedValue({}) };
    const provider = {
      search: jest.fn().mockResolvedValue([
        {
          externalId: 'place-rest-1',
          source: 'GOOGLE_PLACES' as const,
          companyName: 'Restaurante Sabor',
          address: 'Rua das Flores 123',
          city: 'Curitiba',
          state: 'PR',
          country: 'BR' as const,
          rating: 4.5,
          reviewCount: 30,
          category: 'restaurant',
          website: 'https://restaurantesabor.com.br',
          websitePresence: 'WEBSITE_FOUND' as const,
        },
      ]),
    };
    const providers = {
      list: jest.fn().mockReturnValue([{ id: 'GOOGLE_PLACES', label: 'Google', available: true }]),
      resolve: jest.fn().mockReturnValue(provider),
    };
    const prospecting = {
      listCategories: jest.fn().mockResolvedValue({
        categories: [{ value: 'restaurant', label: 'Restaurante', available: true }],
        requiredPlan: 'STARTER_MONTHLY',
      }),
    };
    const websiteAnalyzer = {
      analyze: jest.fn().mockResolvedValue({
        status: 'UP',
        hasSsl: true,
        metaTitle: 'Restaurante Sabor',
        metaDescription: 'Comida boa',
      }),
    };
    const billing = {
      assertCanCreateSearch: jest.fn().mockResolvedValue(undefined),
      consumeCreditForOpportunityRun: jest.fn().mockResolvedValue(undefined),
      refundOpportunityRunCredit: jest.fn().mockResolvedValue(undefined),
      consumeCreditForExplain: jest.fn().mockResolvedValue(undefined),
      refundExplainCredit: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const metrics = { recordJobRecovered: jest.fn() };

    const opportunityFinderService = new OpportunityFinderService(
      prismaMock as unknown as PrismaService,
      queue as never,
      providers as never,
      websiteAnalyzer as never,
      prospecting as never,
      billing as never,
      aiService,
      {} as never,
      audit as never,
      metrics as never,
    );

    return {
      service: opportunityFinderService,
      aiService,
      llmProvider,
      prisma: prismaMock,
      prismaAiRuns,
      mockFetch,
      billing,
      candidateStore,
    };
  }

  describe('1. Happy path com provedor Cloudflare simulado', () => {
    it('executes processRun, generates profile + strategy via Cloudflare Workers AI and preserves prompt versions', async () => {
      const harness = createSimulatedHarness();

      const initialRun = {
        id: 'run-happy-path',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        status: OpportunityRunStatus.PREPARING,
        service: 'Criação de sites',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
        profile: buildDeterministicOpportunityProfile('Criação de sites', 'restaurantes', 'restaurant'),
        searchStrategy: null,
      };
      harness.prisma.opportunityRun.findUnique.mockResolvedValue(initialRun);

      await harness.service.processRun('run-happy-path');

      // Verify that Cloudflare endpoint was called
      expect(harness.mockFetch).toHaveBeenCalled();
      const firstCallUrl = String(harness.mockFetch.mock.calls[0]?.[0] ?? '');
      expect(firstCallUrl).toContain('https://api.cloudflare.com/client/v4/accounts/cf-account-test/ai/v1/chat/completions');

      // Verify prompt versions were preserved in opportunity run update
      expect(harness.prisma.opportunityRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-happy-path' },
          data: expect.objectContaining({
            status: OpportunityRunStatus.SEARCHING,
            profile: expect.objectContaining({
              service: 'Criação de sites',
              niche: 'restaurantes',
              categories: ['restaurant'],
              targetCustomer: sampleProfilePayload.targetCustomer,
            }),
            searchStrategy: expect.objectContaining({
              categories: ['restaurant'],
              minimumRating: sampleStrategyPayload.minimumRating,
            }),
            profilePromptVersion: OPPORTUNITY_PROFILE_PROMPT_VERSION,
            strategyPromptVersion: OPPORTUNITY_STRATEGY_PROMPT_VERSION,
          }),
        }),
      );

      expect(OPPORTUNITY_PROFILE_PROMPT_VERSION).toBe('opportunity-profile:v2');
      expect(OPPORTUNITY_STRATEGY_PROMPT_VERSION).toBe('search-strategy:v2');

      // Verify AiRun records were persisted with proper task and status
      expect(harness.prisma.aiRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-sim-1',
            opportunityRunId: 'run-happy-path',
            task: 'OPPORTUNITY_PROFILE',
            promptVersion: OPPORTUNITY_PROFILE_PROMPT_VERSION,
            provider: 'cloudflare',
            model: '@cf/openai/gpt-oss-120b',
            status: AiRunStatus.PENDING,
          }),
        }),
      );

      expect(harness.prisma.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AiRunStatus.COMPLETED,
          }),
        }),
      );
    });
  });

  describe('2. JSON inválido com nova tentativa (retry)', () => {
    it('retries when initial output is invalid JSON and succeeds with corrected JSON on retry', async () => {
      let profileAttempt = 0;
      const mockFetch = jest.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        const systemMessage = body.messages?.find((m: { role: string }) => m.role === 'system')?.content ?? '';

        if (systemMessage.includes('perfil de prospecção')) {
          profileAttempt++;
          if (profileAttempt === 1) {
            // Attempt 1 for profile: returns invalid JSON
            return new Response(
              JSON.stringify({
                choices: [{ message: { content: 'Não sou um JSON válido: { quebrado' } }],
                usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }
          // Attempt 2 for profile (correction retry): returns valid JSON
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: JSON.stringify(sampleProfilePayload) } }],
              usage: { prompt_tokens: 35, completion_tokens: 45, total_tokens: 80 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        let content: unknown = sampleProfilePayload;
        if (systemMessage.includes('estratégia de descoberta')) {
          content = sampleStrategyPayload;
        } else if (systemMessage.includes('Explique uma oportunidade')) {
          content = sampleExplanationPayload;
        }

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(content) } }],
            usage: { prompt_tokens: 30, completion_tokens: 30, total_tokens: 60 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findUnique.mockResolvedValue({
        id: 'run-retry',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        status: OpportunityRunStatus.PREPARING,
        service: 'Criação de sites',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
        profile: buildDeterministicOpportunityProfile('Criação de sites', 'restaurantes', 'restaurant'),
        searchStrategy: null,
      });

      await harness.service.processRun('run-retry');

      // Expect profileAttempt was 2 (initial + retry)
      expect(profileAttempt).toBe(2);
      const secondCallBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body ?? '{}'));
      expect(secondCallBody.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('A resposta anterior não obedeceu ao formato JSON esperado'),
          }),
        ]),
      );

      // Successfully updated with AI profile after retry
      expect(harness.prisma.opportunityRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-retry' },
          data: expect.objectContaining({
            profile: expect.objectContaining({
              targetCustomer: sampleProfilePayload.targetCustomer,
            }),
          }),
        }),
      );
    });
  });

  describe('3. JSON inválido em ambas tentativas com queda limpa (graceful fallback)', () => {
    it('falls back cleanly to deterministic profile and strategy when retry also fails', async () => {
      // Mock fetch always returns invalid JSON for structured requests
      const mockFetch = jest.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Sinto muito, não consegui gerar JSON' } }],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findUnique.mockResolvedValue({
        id: 'run-fallback',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        status: OpportunityRunStatus.PREPARING,
        service: 'Criação de sites',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
        profile: buildDeterministicOpportunityProfile('Criação de sites', 'restaurantes', 'restaurant'),
        searchStrategy: null,
      });

      // Does not throw an unhandled error; completes gracefully with deterministic fallback
      await expect(harness.service.processRun('run-fallback')).resolves.not.toThrow();

      // Verified deterministic profile was used
      expect(harness.prisma.opportunityRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-fallback' },
          data: expect.objectContaining({
            status: OpportunityRunStatus.SEARCHING,
            profile: expect.objectContaining({
              service: 'Criação de sites',
              niche: 'restaurantes',
              categories: ['restaurant'],
              targetCustomer: ['restaurantes'],
            }),
            searchStrategy: expect.objectContaining({
              categories: ['restaurant'],
            }),
          }),
        }),
      );

      // Q371-01: When structured AI fails validation after retries, all AiRuns must end in FAILED status (not COMPLETED)
      expect(harness.prismaAiRuns).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: AiRunStatus.FAILED })]),
      );
      expect(harness.prismaAiRuns.length).toBeGreaterThan(0);
      expect(harness.prismaAiRuns.every((r) => r.status === AiRunStatus.FAILED)).toBe(true);
      expect(harness.prismaAiRuns.every((r) => r.errorCode === 'AI_INVALID_STRUCTURED_OUTPUT')).toBe(true);
    });
  });

  describe('4. Explicação de oportunidade com provedor simulado', () => {
    it('generates explanation via simulated Cloudflare provider and tags source as AI', async () => {
      const mockFetch = jest.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(sampleExplanationPayload) } }],
            usage: { prompt_tokens: 40, completion_tokens: 50, total_tokens: 90 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findFirst.mockResolvedValue({
        id: 'run-explain',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        service: 'Criação de sites',
      });
      harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
        id: 'cand-explain-1',
        runId: 'run-explain',
        status: OpportunityCandidateStatus.SCORED,
        company: { companyName: 'Restaurante Sabor', websitePresence: 'NO_WEBSITE_REPORTED' },
        signals: [],
        scoreBreakdown: {},
        overallScore: 85,
        confidenceScore: 80,
        dataCompleteness: 70,
        rankingCategory: 'restaurant',
        explanation: null,
        importedLeadId: null,
        analyzedAt: now,
      });

      const candidateView = await harness.service.explainCandidate(
        'org-sim-1',
        'user-sim-1',
        'run-explain',
        'cand-explain-1',
      );

      expect(candidateView.explanation).toEqual(
        expect.objectContaining({
          summary: sampleExplanationPayload.summary,
          whyOpportunity: sampleExplanationPayload.whyOpportunity,
          recommendedOffer: sampleExplanationPayload.recommendedOffer,
          source: 'AI',
        }),
      );

      expect(harness.prisma.opportunityCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cand-explain-1' },
          data: expect.objectContaining({
            explanationPromptVersion: OPPORTUNITY_EXPLANATION_PROMPT_VERSION,
          }),
        }),
      );
    });

    it('refunds credit and throws ServiceUnavailableException on paid explain failure after retry', async () => {
      const mockFetch = jest.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Não sou JSON válido' } }],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findFirst.mockResolvedValue({
        id: 'run-explain-fail',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        service: 'Criação de sites',
      });
      harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
        id: 'cand-explain-2',
        runId: 'run-explain-fail',
        status: OpportunityCandidateStatus.SCORED,
        company: { companyName: 'Restaurante Sabor', websitePresence: 'NO_WEBSITE_REPORTED' },
        signals: [],
        scoreBreakdown: {},
        overallScore: 85,
        confidenceScore: 80,
        dataCompleteness: 70,
        rankingCategory: 'restaurant',
        explanation: null,
        importedLeadId: null,
        analyzedAt: now,
      });

      await expect(
        harness.service.explainCandidate(
          'org-sim-1',
          'user-sim-1',
          'run-explain-fail',
          'cand-explain-2',
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // Verified credit consumption and refund occurred
      expect(harness.billing.consumeCreditForExplain).toHaveBeenCalledWith('org-sim-1', 'cand-explain-2', 'run-explain-fail');
      expect(harness.billing.refundExplainCredit).toHaveBeenCalledWith('org-sim-1', 'cand-explain-2');
    });
  });

  describe('5. Comportamento com opportunityAi.enabled = false', () => {
    it('uses deterministic profile and strategy immediately without making any HTTP calls', async () => {
      const mockFetch = jest.fn();
      const harness = createSimulatedHarness({
        opportunityAiEnabled: false,
        mockFetchImpl: mockFetch,
      });

      harness.prisma.opportunityRun.findUnique.mockResolvedValue({
        id: 'run-disabled',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        status: OpportunityRunStatus.PREPARING,
        service: 'Criação de sites',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
        profile: buildDeterministicOpportunityProfile('Criação de sites', 'restaurantes', 'restaurant'),
        searchStrategy: null,
      });

      await harness.service.processRun('run-disabled');

      // No HTTP fetch was made to any AI provider
      expect(mockFetch).not.toHaveBeenCalled();

      // Deterministic profile and strategy were used
      expect(harness.prisma.opportunityRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-disabled' },
          data: expect.objectContaining({
            status: OpportunityRunStatus.SEARCHING,
            profile: expect.objectContaining({
              service: 'Criação de sites',
              niche: 'restaurantes',
              targetCustomer: ['restaurantes'],
            }),
          }),
        }),
      );
    });
  });

  describe('6. Restrição de contato (DNC e supressão - Q371-02)', () => {
    it.each(['dnc', 'suppressed'])(
      'blocks commercial advice, provider call and credit consumption when candidate is %s',
      async (restriction) => {
        const mockFetch = jest.fn();
        const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

        harness.prisma.opportunityRun.findFirst.mockResolvedValue({
          id: 'run-explain',
          organizationId: 'org-sim-1',
          userId: 'user-sim-1',
          service: 'Criação de sites',
        });

        harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
          id: 'cand-restricted',
          runId: 'run-explain',
          status: OpportunityCandidateStatus.SCORED,
          company: {
            companyName: 'Restaurante Restrito',
            email: 'restricted@example.com',
            websitePresence: 'NO_WEBSITE_REPORTED',
          },
          signals: [],
          scoreBreakdown: {},
          overallScore: 85,
          confidenceScore: 80,
          dataCompleteness: 70,
          rankingCategory: 'restaurant',
          explanation: null,
          importedLeadId: 'lead-restricted',
          analyzedAt: now,
        });

        Object.assign(harness.prisma, {
          lead: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'lead-restricted',
              organizationId: 'org-sim-1',
              doNotContact: restriction === 'dnc',
              email: 'restricted@example.com',
            }),
          },
          suppressionEntry: {
            findFirst: jest.fn().mockResolvedValue(
              restriction === 'suppressed' ? { id: 'suppression-1' } : null,
            ),
          },
        });

        const candidateView = await harness.service.explainCandidate(
          'org-sim-1',
          'user-sim-1',
          'run-explain',
          'cand-restricted',
        );

        // Q371-02: Zero AI provider calls and zero credits consumed for restricted candidates
        expect(mockFetch).not.toHaveBeenCalled();
        expect(harness.billing.consumeCreditForExplain).not.toHaveBeenCalled();

        // Q371-02: No commercial advice or contact suggestion given
        expect(candidateView.explanation?.commercialAngle).toBeUndefined();
        expect(candidateView.explanation?.recommendedOffer).toBeUndefined();
        expect(candidateView.explanation?.source).toBe('DETERMINISTIC_FALLBACK');
        expect(candidateView.explanation?.warnings).toEqual(
          expect.arrayContaining([expect.stringContaining('do-not-contact')]),
        );
      },
    );

    it('blocks commercial advice when company email is directly suppressed without importedLeadId', async () => {
      const mockFetch = jest.fn();
      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findFirst.mockResolvedValue({
        id: 'run-explain',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        service: 'Criação de sites',
      });

      harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
        id: 'cand-company-suppressed',
        runId: 'run-explain',
        status: OpportunityCandidateStatus.SCORED,
        company: {
          companyName: 'Empresa Suprimida',
          email: 'direct-suppressed@example.com',
          websitePresence: 'NO_WEBSITE_REPORTED',
        },
        signals: [],
        scoreBreakdown: {},
        overallScore: 80,
        confidenceScore: 75,
        dataCompleteness: 60,
        rankingCategory: 'restaurant',
        explanation: null,
        importedLeadId: null,
        analyzedAt: now,
      });

      Object.assign(harness.prisma, {
        suppressionEntry: {
          findFirst: jest.fn().mockResolvedValue({ id: 'suppression-match' }),
        },
      });

      const candidateView = await harness.service.explainCandidate(
        'org-sim-1',
        'user-sim-1',
        'run-explain',
        'cand-company-suppressed',
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(harness.billing.consumeCreditForExplain).not.toHaveBeenCalled();
      expect(candidateView.explanation?.commercialAngle).toBeUndefined();
      expect(candidateView.explanation?.recommendedOffer).toBeUndefined();
    });

    it('replaces existing cached explanation with restricted explanation when candidate is restricted', async () => {
      const mockFetch = jest.fn();
      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findFirst.mockResolvedValue({
        id: 'run-explain',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        service: 'Criação de sites',
      });

      // Candidate has pre-existing commercial explanation in DB
      harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
        id: 'cand-cached-dnc',
        runId: 'run-explain',
        status: OpportunityCandidateStatus.SCORED,
        company: { companyName: 'Empresa DNC' },
        signals: [],
        scoreBreakdown: {},
        overallScore: 80,
        confidenceScore: 75,
        dataCompleteness: 60,
        rankingCategory: 'restaurant',
        explanation: {
          summary: 'Resumo antigo',
          whyOpportunity: 'Oportunidade antiga',
          recommendedOffer: 'Oferta comercial antiga',
          commercialAngle: 'Abordagem comercial antiga',
          warnings: [],
          source: 'AI',
        },
        importedLeadId: 'lead-dnc-1',
        analyzedAt: now,
      });

      Object.assign(harness.prisma, {
        lead: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'lead-dnc-1',
            organizationId: 'org-sim-1',
            doNotContact: true,
          }),
        },
      });

      const candidateView = await harness.service.explainCandidate(
        'org-sim-1',
        'user-sim-1',
        'run-explain',
        'cand-cached-dnc',
      );

      // Pre-existing commercial explanation must NOT be returned
      expect(mockFetch).not.toHaveBeenCalled();
      expect(harness.billing.consumeCreditForExplain).not.toHaveBeenCalled();
      expect(candidateView.explanation?.commercialAngle).toBeUndefined();
      expect(candidateView.explanation?.recommendedOffer).toBeUndefined();
    });

    it('allows AI explanation and debits credit when candidate is not restricted', async () => {
      const mockFetch = jest.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(sampleExplanationPayload) } }],
            usage: { prompt_tokens: 40, completion_tokens: 50, total_tokens: 90 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const harness = createSimulatedHarness({ mockFetchImpl: mockFetch });

      harness.prisma.opportunityRun.findFirst.mockResolvedValue({
        id: 'run-explain-allowed',
        organizationId: 'org-sim-1',
        userId: 'user-sim-1',
        service: 'Criação de sites',
      });

      harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
        id: 'cand-allowed',
        runId: 'run-explain-allowed',
        status: OpportunityCandidateStatus.SCORED,
        company: { companyName: 'Restaurante Permitido', websitePresence: 'NO_WEBSITE_REPORTED' },
        signals: [],
        scoreBreakdown: {},
        overallScore: 85,
        confidenceScore: 80,
        dataCompleteness: 70,
        rankingCategory: 'restaurant',
        explanation: null,
        importedLeadId: 'lead-allowed',
        analyzedAt: now,
      });

      Object.assign(harness.prisma, {
        lead: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'lead-allowed',
            organizationId: 'org-sim-1',
            doNotContact: false,
            email: 'allowed@example.com',
          }),
        },
        suppressionEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      });

      const candidateView = await harness.service.explainCandidate(
        'org-sim-1',
        'user-sim-1',
        'run-explain-allowed',
        'cand-allowed',
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(harness.billing.consumeCreditForExplain).toHaveBeenCalledWith(
        'org-sim-1',
        'cand-allowed',
        'run-explain-allowed',
      );
      expect(candidateView.explanation?.commercialAngle).toBe(sampleExplanationPayload.commercialAngle);
      expect(candidateView.explanation?.recommendedOffer).toBe(sampleExplanationPayload.recommendedOffer);
      expect(candidateView.explanation?.source).toBe('AI');
    });
  });
});
