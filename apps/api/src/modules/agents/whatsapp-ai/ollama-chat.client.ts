import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sanitizeLlmPayload } from '../../privacy/llm-privacy.sanitizer';
import {
  ANGLE_LABELS,
  WHATSAPP_VARIANT_ANGLES,
  type LeadContextForWhatsappAi,
  type WhatsappVariant,
  type WhatsappVariantAngle,
} from './whatsapp-ai.types';

type OllamaChatResponse = {
  message?: { content?: string };
};

@Injectable()
export class OllamaChatClient {
  private readonly logger = new Logger(OllamaChatClient.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const raw = this.config.get<string | boolean>('whatsappAi.enabled');
    if (raw === false || raw === 'false' || raw === '0') return false;
    return true;
  }

  async generateVariants(
    lead: LeadContextForWhatsappAi,
    count: number,
    seed = 0,
  ): Promise<WhatsappVariant[] | null> {
    if (!this.isEnabled()) return null;

    const baseUrl = (
      this.config.get<string>('whatsappAi.baseUrl') ?? 'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
    const model = this.config.get<string>('whatsappAi.model') ?? 'qwen3:8b';
    const timeoutMs = Number(this.config.get<number>('whatsappAi.timeoutMs') ?? 30000);
    const apiKey = this.config.get<string>('whatsappAi.apiKey') ?? '';
    const generationSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;

    const angles = WHATSAPP_VARIANT_ANGLES.slice(0, count);
    const system = [
      'Você escreve 1ª mensagens de WhatsApp em português do Brasil para prospecção B2B local (negócios de rua/cidade).',
      'Responda APENAS JSON válido: {"variants":[{"angle":"...","body":"..."}]}',
      'Boas práticas: 3 linhas no máximo; personalize com dados reais; uma pergunta suave no fim;',
      'não peça reunião longa no 1º contacto; sem links, anexos, urgência falsa ou emojis excessivos;',
      'sem inventar telefone/email/preço/resultados; tom humano e profissional.',
      'Estrutura: (1) contexto da empresa/cidade (2) motivo relevante (3) pergunta aberta de baixo compromisso.',
      `Se senderName existir, apresente-se com esse nome (utilizador logado). Não use outro nome.`,
      `Use exatamente estes ângulos nesta ordem: ${angles.join(', ')}.`,
      `Variação #${generationSeed}: mude o wording em relação a gerações anteriores; não repita a mesma frase-base.`,
    ].join(' ');

    const user = [
      'Gere variantes personalizadas com estes dados:',
      JSON.stringify(
        sanitizeLlmPayload({
          companyName: lead.companyName,
          tradeName: lead.tradeName ?? null,
          city: lead.city ?? null,
          segment: lead.segment ?? null,
          website: lead.website ?? null,
          senderName: lead.senderName ?? null,
          seed: generationSeed,
          angles,
        }),
      ),
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.85,
            seed: generationSeed,
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Ollama chat HTTP ${response.status}`);
        return null;
      }

      const payload = (await response.json()) as OllamaChatResponse;
      const content = payload.message?.content?.trim();
      if (!content) return null;

      return this.parseVariants(content, angles, generationSeed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Ollama unavailable, using fallback: ${message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseVariants(
    content: string,
    expectedAngles: readonly WhatsappVariantAngle[],
    seed = 0,
  ): WhatsappVariant[] | null {
    try {
      const parsed = JSON.parse(content) as {
        variants?: Array<{ angle?: string; body?: string }>;
      };
      const list = Array.isArray(parsed.variants) ? parsed.variants : [];
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
          id: `ollama-${seed}-${angle}-${index + 1}`,
          angle,
          label: ANGLE_LABELS[angle],
          body,
        });
      }

      return variants.length >= 3 ? variants : null;
    } catch {
      this.logger.warn('Ollama returned invalid JSON for WhatsApp variants');
      return null;
    }
  }
}
