import { ArgumentsHost, HttpException, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const makeHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/v1/auth/login', id: 'corr-1' }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives the error label from the status when the exception body is a plain string', () => {
    const { host, status, json } = makeHost();

    new HttpExceptionFilter().catch(
      new HttpException('Too many attempts. Wait a moment and try again.', HttpStatus.TOO_MANY_REQUESTS),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many attempts. Wait a moment and try again.',
        error: 'Too Many Requests',
        path: '/api/v1/auth/login',
        correlationId: 'corr-1',
      }),
    );
  });

  it('keeps the label and code provided by the exception body', () => {
    const { host, json } = makeHost();

    new HttpExceptionFilter().catch(
      new HttpException(
        { statusCode: 403, message: 'Verify your email', error: 'Forbidden', code: 'EMAIL_NOT_VERIFIED' },
        HttpStatus.FORBIDDEN,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden', code: 'EMAIL_NOT_VERIFIED' }),
    );
  });

  it('labels built-in exceptions without leaking the class name', () => {
    const { host, json } = makeHost();

    new HttpExceptionFilter().catch(new UnauthorizedException('Invalid credentials'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid credentials',
        error: 'Unauthorized',
      }),
    );
  });

  it('maps Prisma unique constraint violations to 409', () => {
    const { host, status, json } = makeHost();

    new HttpExceptionFilter().catch(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Conflict' }));
  });

  it('falls back to 500 for unknown failures', () => {
    const { host, status, json } = makeHost();

    new HttpExceptionFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal Server Error', message: 'Internal server error' }),
    );
  });
});
