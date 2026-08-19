import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { TenantScopeError } from '../prisma/tenant-guard';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const payload = body as { message?: string | string[]; error?: string; code?: string };
        message = payload.message ?? exception.message;
        error = payload.error ?? exception.name;
        code = payload.code;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `UnhandledException prisma ${exception.code}: ${exception.message}`,
        exception.stack,
      );
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Unable to complete registration with the provided data';
        error = 'Conflict';
      }
    } else if (exception instanceof TenantScopeError) {
      this.logger.error(`UnhandledException tenant scope: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
        'UnhandledException',
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      ...(code ? { code } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: request.id,
    };

    response.status(status).json(body);
  }
}
