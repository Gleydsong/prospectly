import { ForbiddenException } from '@nestjs/common';

export class SuppressedContactException extends ForbiddenException {
  constructor(message = 'Cliente na lista de supressão.') {
    super({
      code: 'SUPPRESSED',
      message,
    });
  }
}
