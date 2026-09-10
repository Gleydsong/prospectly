import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Compensação de AI_CONSUME: falha nossa (5xx, timeout, fila) devolve crédito.
 * 4xx de validação / cancelamento / entitlement do actor não devolve.
 */
export function shouldRefundAiConsume(error: unknown): boolean {
  if (error instanceof HttpException) {
    return error.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR;
  }
  return true;
}
