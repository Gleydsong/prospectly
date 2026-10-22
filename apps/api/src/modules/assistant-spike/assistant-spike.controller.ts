import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AssistantSpikeGuard } from './assistant-spike.guard';
import { AssistantSpikeService } from './assistant-spike.service';
import {
  AssistantDecisionDto,
  AssistantStreamRequestDto,
} from './dto/assistant-spike.dto';

@ApiTags('assistant-spike')
@ApiBearerAuth()
@Controller({ path: 'assistant/spike', version: '1' })
@UseGuards(AssistantSpikeGuard)
export class AssistantSpikeController {
  private readonly logger = new Logger(AssistantSpikeController.name);

  constructor(private readonly service: AssistantSpikeService) {}

  private sanitizeErrorForClient(err: unknown): { code: string; message: string } {
    if (err instanceof Error) {
      if (err.name === 'AiTimeoutException') {
        return {
          code: 'AI_TIMEOUT',
          message:
            'O tempo limite para resposta do assistente foi atingido. Tente novamente em instantes.',
        };
      }
      if (err.name === 'AiProviderUnavailableException') {
        return {
          code: 'AI_PROVIDER_UNAVAILABLE',
          message:
            'O serviço do assistente está temporariamente indisponível. Tente novamente mais tarde.',
        };
      }
      if (err.name === 'AiRateLimitException') {
        return {
          code: 'AI_RATE_LIMIT',
          message:
            'Limite de requisições atingido. Aguarde alguns instantes antes de enviar nova mensagem.',
        };
      }
      if (err.name === 'AiDisabledException') {
        return {
          code: 'AI_DISABLED',
          message: 'O assistente de inteligência artificial está desativado no momento.',
        };
      }
    }
    return {
      code: 'INTERNAL',
      message: 'Ocorreu um erro interno ao processar a resposta do assistente.',
    };
  }

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  async stream(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrg() organizationId: string,
    @Body() dto: AssistantStreamRequestDto,
  ): Promise<void> {
    // SSE response headers with buffering disabled for proxy compatibility
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abortController = new AbortController();
    // In Node.js, listen to ServerResponse 'close' event to detect client disconnects during streaming.
    // (IncomingMessage 'close' fires early as soon as the request body is consumed).
    const onClose = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    res.on('close', onClose);

    try {
      for await (const event of this.service.streamConversation({
        organizationId,
        userId: user.id,
        messages: dto.messages,
        signal: abortController.signal,
        simulateTool: dto.simulateTool,
        simulateCustomerName: dto.simulateCustomerName,
      })) {
        if (res.writableEnded || abortController.signal.aborted) {
          break;
        }
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        (res as { flush?: () => void }).flush?.();
      }
    } catch (err: unknown) {
      if (
        abortController.signal.aborted ||
        (err as Error)?.name === 'AiRequestAbortedException'
      ) {
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }
      const errorMeta = this.sanitizeErrorForClient(err);
      this.logger.error({
        message: 'Erro durante o streaming do assistente',
        error: err instanceof Error ? err.stack ?? err.message : String(err),
        code: errorMeta.code,
      });
      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ code: errorMeta.code, message: errorMeta.message })}\n\n`,
        );
      }
    } finally {
      res.off('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Post('actions/:intentId/decision')
  @HttpCode(HttpStatus.OK)
  async decide(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrg() organizationId: string,
    @Param('intentId') intentId: string,
    @Body() dto: AssistantDecisionDto,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abortController = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    res.on('close', onClose);

    try {
      for await (const event of this.service.resumeDecision({
        organizationId,
        userId: user.id,
        intentId,
        decision: dto.decision,
        signal: abortController.signal,
      })) {
        if (res.writableEnded || abortController.signal.aborted) {
          break;
        }
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        (res as { flush?: () => void }).flush?.();
      }
    } catch (err: unknown) {
      if (
        abortController.signal.aborted ||
        (err as Error)?.name === 'AiRequestAbortedException'
      ) {
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }
      const errorMeta = this.sanitizeErrorForClient(err);
      this.logger.error({
        message: 'Erro durante retomada de decisão do assistente',
        error: err instanceof Error ? err.stack ?? err.message : String(err),
        code: errorMeta.code,
      });
      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ code: errorMeta.code, message: errorMeta.message })}\n\n`,
        );
      }
    } finally {
      res.off('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
