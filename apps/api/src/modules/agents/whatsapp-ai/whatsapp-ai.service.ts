import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { LlmProviderService } from '../../ai/llm-provider/llm-provider.service';
import {
  ANGLE_LABELS,
  WHATSAPP_VARIANT_ANGLES,
  type LeadContextForWhatsappAi,
  type WhatsappVariant,
  type WhatsappVariantAngle,
} from './whatsapp-ai.types';

export const whatsappVariantsResponseSchema = z.object({
  variants: z.array(
    z.object({
      angle: z.string(),
      body: z.string(),
    }),
  ),
});

export type WhatsappVariantsResponse = z.infer<typeof whatsappVariantsResponseSchema>;

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);

  constructor(private readonly llmProvider: LlmProviderService) {}

  isEnabled(): boolean {
    return this.llmProvider.isAiEnabled();
  }

  async generateVariants(
    lead: LeadContextForWhatsappAi,
    count: number,
    seed = 0,
    organizationId = 'default',
    userId?: string,
  ): Promise<WhatsappVariant[] | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const generationSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
    const angles = WHATSAPP_VARIANT_ANGLES.slice(0, count);
    const stage = lead.sequenceStage ?? 'FIRST_MESSAGE';

    const stageInstruction =
      stage === 'FOLLOW_UP_1'
        ? 'Você escreve uma mensagem de 1º follow-up suave (48h após primeiro contato sem resposta), lembrando da mensagem anterior de forma breve e sem cobrança.'
        : stage === 'FOLLOW_UP_2'
          ? 'Você escreve uma mensagem de 2º follow-up com agregação de valor para o nicho (96h após sem resposta), rápida e objetiva.'
          : stage === 'BREAKUP'
            ? 'Você escreve uma mensagem de encerramento educada (break-up message), tirando a pressão e deixando a porta aberta.'
            : 'Você escreve 1ª mensagens de WhatsApp em português do Brasil para prospecção B2B local (negócios de rua/cidade).';

    const system = [
      stageInstruction,
      'Responda APENAS JSON válido: {"variants":[{"angle":"...","body":"..."}]}',
      'Boas práticas: 3 linhas no máximo; personalize com dados reais; uma pergunta suave no fim;',
      'não peça reunião longa no 1º contacto; sem links, anexos, urgência falsa ou emojis excessivos;',
      'sem inventar telefone/email/preço/resultados; tom humano e profissional.',
      'Se houver auditSignals com falhas (ex: sem botão de WhatsApp ou lento), aproveite esse gancho no ângulo dor_site.',
      'Estrutura: (1) contexto da empresa/cidade (2) motivo relevante (3) pergunta aberta de baixo compromisso.',
      'Se senderName existir, apresente-se com esse nome (utilizador logado). Não use outro nome.',
      `Use exatamente estes ângulos nesta ordem: ${angles.join(', ')}.`,
      `Variação #${generationSeed}: mude o wording em relação a gerações anteriores; não repita a mesma frase-base.`,
    ].join(' ');

    const userPayload = {
      companyName: lead.companyName,
      tradeName: lead.tradeName ?? null,
      city: lead.city ?? null,
      segment: lead.segment ?? null,
      website: lead.website ?? null,
      senderName: lead.senderName ?? null,
      sequenceStage: stage,
      auditSignals: lead.auditSignals ?? null,
      seed: generationSeed,
      angles,
    };

    try {
      const response = await this.llmProvider.generateStructured({
        context: {
          organizationId,
          userId,
          task: 'WHATSAPP_VARIANTS',
          promptVersion: 'v1',
        },
        schema: whatsappVariantsResponseSchema,
        system,
        input: userPayload,
        temperature: 0.85,
      });

      return this.parseVariants(response.data, angles, generationSeed);
    } catch {
      this.logger.warn('WhatsApp AI unavailable, using deterministic fallback');
      return null;
    }
  }

  private parseVariants(
    data: WhatsappVariantsResponse,
    expectedAngles: readonly WhatsappVariantAngle[],
    seed = 0,
  ): WhatsappVariant[] | null {
    const list = Array.isArray(data.variants) ? data.variants : [];
    const byAngle = new Map<string, string>();
    for (const item of list) {
      const angle = String(item.angle ?? '').trim();
      const body = String(item.body ?? '').trim();
      if (angle && body) byAngle.set(angle, body);
    }

    const variants: WhatsappVariant[] = [];
    for (const [index, angle] of expectedAngles.entries()) {
      const body = byAngle.get(angle);
      if (!body) continue;
      variants.push({
        id: `ai-${seed}-${angle}-${index + 1}`,
        angle,
        label: ANGLE_LABELS[angle],
        body,
      });
    }

    return variants.length >= Math.min(3, expectedAngles.length) ? variants : null;
  }
}
