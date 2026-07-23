import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<{ id?: string }>();
    return request.id;
  },
);
