import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.metrics.recordHttp(request.method, response.statusCode || 200, Date.now() - started);
        },
        error: (error: { status?: number; statusCode?: number }) => {
          const status = error?.status ?? error?.statusCode ?? response.statusCode ?? 500;
          this.metrics.recordHttp(request.method, status, Date.now() - started);
        },
      }),
    );
  }
}
