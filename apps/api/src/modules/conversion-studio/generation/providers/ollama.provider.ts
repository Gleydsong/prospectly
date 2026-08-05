import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  assertPublishableBlocks,
  parsePageBlocks,
  type PageBlock,
} from '../../page-blocks.schema';
import {
  buildRefineUserPrompt,
  buildUserPrompt,
  LANDING_SYSTEM_PROMPT,
} from '../landing-generation.prompts';
import {
  applyRefineResponse,
  ensureBlockIds,
  type RefineModelResponse,
} from '../refine-ops';
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
    return this.parseBlocksResult(raw, context, true);
  }

  async refine(
    context: LandingGenerationContext & {
      currentBlocks: PageBlock[];
      currentHtml?: string | null;
      currentTitle: string;
      instruction: string;
    },
  ): Promise<LandingGenerationResult> {
    const raw = await this.chat([
      { role: 'system', content: LANDING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildRefineUserPrompt({
          companyName: context.companyName,
          instruction: context.instruction,
          currentBlocks: context.currentBlocks,
          photos: context.photos,
          designReference: context.designReference,
        }),
      },
    ]);
    const parsed = this.parseJson(raw) as RefineModelResponse;
    const { title, blocks } = applyRefineResponse(
      context.currentBlocks,
      context.currentTitle,
      parsed,
    );
    return {
      title,
      blocks,
      provider: 'ollama',
      usedAi: true,
    };
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
        message: 'Ollama React Aura generation failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseBlocksResult(
    raw: string,
    context: LandingGenerationContext,
    usedAi: boolean,
    fallbackTitle?: string,
  ): LandingGenerationResult {
    const parsed = this.parseJson(raw) as { title?: unknown; blocks?: unknown };
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      throw new Error('Model response missing blocks');
    }
    const withIds = ensureBlockIds(parsed.blocks);
    const blocks = parsePageBlocks(withIds);
    assertPublishableBlocks(blocks);

    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim().slice(0, 160)
        : fallbackTitle || context.companyName;

    return {
      title,
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
