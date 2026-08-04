import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  assertPublishableBlocks,
  defaultBlocksFromLead,
  type PageBlock,
} from '../../page-blocks.schema';
import { blocksToSimpleHtml } from '../blocks-to-html';
import {
  assertPublishableLandingHtml,
  sanitizeLandingHtml,
} from '../html-sanitize';
import {
  buildRefineHtmlUserPrompt,
  buildUserPrompt,
  LANDING_SYSTEM_PROMPT,
} from '../landing-generation.prompts';
import type {
  LandingGenerationContext,
  LandingGenerationProvider,
  LandingGenerationResult,
} from './landing-generation.provider';

@Injectable()
export class OllamaLandingProvider implements LandingGenerationProvider {
  readonly name = 'ollama' as const;
  private readonly logger = new Logger(OllamaLandingProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generate(context: LandingGenerationContext): Promise<LandingGenerationResult> {
    const raw = await this.chat([
      { role: 'system', content: LANDING_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(context) },
    ]);
    return this.parseHtmlResult(raw, context, true);
  }

  async refine(
    context: LandingGenerationContext & {
      currentBlocks: PageBlock[];
      currentHtml?: string | null;
      currentTitle: string;
      instruction: string;
    },
  ): Promise<LandingGenerationResult> {
    const currentHtml =
      context.currentHtml?.trim() ||
      blocksToSimpleHtml({
        title: context.currentTitle || context.companyName,
        companyName: context.companyName,
        blocks: context.currentBlocks,
      });

    const raw = await this.chat([
      { role: 'system', content: LANDING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildRefineHtmlUserPrompt({
          companyName: context.companyName,
          instruction: context.instruction,
          currentHtml,
          photos: context.photos,
          designReference: context.designReference,
        }),
      },
    ]);
    return this.parseHtmlResult(raw, context, true, context.currentTitle);
  }

  private async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const baseUrl = (this.config.get<string>('landingAi.baseUrl') ?? 'http://127.0.0.1:11434').replace(
      /\/$/,
      '',
    );
    const model = this.config.get<string>('landingAi.model') ?? 'llama3.1';
    const timeoutMs = this.config.get<number>('landingAi.timeoutMs') ?? 120_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          messages,
          options: {
            temperature: 0.55,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Ollama HTTP ${response.status}: ${body.slice(0, 200)}`);
      }
      const payload = (await response.json()) as { message?: { content?: string } };
      const content = payload.message?.content?.trim();
      if (!content) throw new Error('Ollama returned empty content');
      return content;
    } catch (error) {
      this.logger.warn({
        message: 'Ollama HTML generation failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseHtmlResult(
    raw: string,
    context: LandingGenerationContext,
    usedAi: boolean,
    fallbackTitle?: string,
  ): LandingGenerationResult {
    const parsed = this.parseJson(raw) as { title?: unknown; html?: unknown };
    if (typeof parsed.html !== 'string' || !parsed.html.trim()) {
      throw new Error('Model response missing html');
    }
    const html = sanitizeLandingHtml(parsed.html);
    assertPublishableLandingHtml(html, context.companyName);

    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim().slice(0, 160)
        : fallbackTitle || context.companyName;

    // Keep a minimal block snapshot for legado/editor fallback
    const blocks = defaultBlocksFromLead({
      companyName: context.companyName,
      category: context.category,
      city: context.city,
      phone: context.phone,
      address: context.address,
      photos: context.photos,
      googleReviews: context.googleReviews,
    });
    assertPublishableBlocks(blocks);

    return {
      title,
      html,
      blocks,
      provider: 'ollama',
      usedAi,
    };
  }

  private parseJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(raw.slice(start, end + 1));
      }
      throw new Error('Model response is not JSON');
    }
  }
}
