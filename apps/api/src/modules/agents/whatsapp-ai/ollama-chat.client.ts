import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  ): Promise<WhatsappVariant[] | null> {
    if (!this.isEnabled()) return null;

    const baseUrl = (
      this.config.get<string>('whatsappAi.baseUrl') ?? 'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
    const model = this.config.get<string>('whatsappAi.model') ?? 'llama3.2';
    const timeoutMs = Number(this.config.get<number>('whatsappAi.timeoutMs') ?? 8000);
    const apiKey = this.config.get<string>('whatsappAi.apiKey') ?? '';

    const angles = WHATSAPP_VARIANT_ANGLES.slice(0, count);
    const system = [
      'Você escreve 1ª mensagens de WhatsApp em português do Brasil para prospecção B2B local.',
      'Responda APENAS JSON válido no formato: {"variants":[{"angle":"...","body":"..."}]}',
      'Regras: mensagens curtas (2-4 frases), tom humano e assistido, sem inventar telefone/email/preço,',
      'sem links enganosos, sem prometer resultados garantidos, sem markdown.',
      `Use exatamente estes ângulos nesta ordem: ${angles.join(', ')}.`,
    ].join(' ');

    const user = [
      'Gere variantes personalizadas com estes dados do lead:',
      JSON.stringify({
        companyName: lead.companyName,
        tradeName: lead.tradeName ?? null,
        city: lead.city ?? null,
        segment: lead.segment ?? null,
        website: lead.website ?? null,
        ownerName: lead.ownerName ?? null,
        angles,
      }),
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

      return this.parseVariants(content, angles);
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
          id: `ollama-${angle}-${index + 1}`,
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
