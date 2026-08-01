import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import { SearchProviderError } from './domain/search-provider-error';
import { ProspectingProcessor } from './prospecting.processor';

describe('ProspectingProcessor', () => {
  it('records a sanitized failure only after the final BullMQ attempt', async () => {
    const prospecting = {
      getJobContext: jest.fn().mockResolvedValue({ organizationId: 'org-1', correlationId: 'corr-1' }),
      process: jest.fn().mockRejectedValue(new Error('provider secret response')),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new ProspectingProcessor(prospecting as never, metrics as never);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(
      processor.process({ data: { searchId: 'search-1' }, attemptsMade: 2, opts: { attempts: 3 } } as never),
    ).rejects.toThrow('Search processing failed. Please try again later.');

    expect(prospecting.recordFailure).toHaveBeenCalledWith('search-1', undefined);
    expect(warn).toHaveBeenCalledWith({
      message: 'Search processing failed',
      searchId: 'search-1',
      organizationId: 'org-1',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('provider secret response');
    warn.mockRestore();
  });

  it('leaves the search processing while BullMQ will retry', async () => {
    const prospecting = {
      getJobContext: jest.fn().mockResolvedValue({ organizationId: 'org-1', correlationId: 'corr-1' }),
      process: jest.fn().mockRejectedValue(new Error('temporary provider failure')),
      recordFailure: jest.fn(),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new ProspectingProcessor(prospecting as never, metrics as never);

    await expect(
      processor.process({ data: { searchId: 'search-1' }, attemptsMade: 0, opts: { attempts: 3 } } as never),
    ).rejects.toThrow('Search processing failed. Please try again later.');

    expect(prospecting.recordFailure).not.toHaveBeenCalled();
  });

  it('fails permanently without BullMQ retries for non-retryable provider errors', async () => {
    const prospecting = {
      getJobContext: jest.fn().mockResolvedValue({ organizationId: 'org-1', correlationId: 'corr-1' }),
      process: jest.fn().mockRejectedValue(
        new SearchProviderError({
          provider: 'GOOGLE_PLACES',
          message: 'Google Places provider request failed',
          publicMessage: 'Google Places API (New) is disabled or the API key lacks permission (PERMISSION_DENIED). Enable places.googleapis.com in Google Cloud.',
          retryable: false,
          statusCode: 403,
          reason: 'SERVICE_DISABLED',
        }),
      ),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new ProspectingProcessor(prospecting as never, metrics as never);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(
      processor.process({ data: { searchId: 'search-1' }, attemptsMade: 0, opts: { attempts: 3 } } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(prospecting.recordFailure).toHaveBeenCalledWith(
      'search-1',
      expect.stringContaining('Places API (New) is disabled'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        reason: 'SERVICE_DISABLED',
        retryable: false,
        provider: 'GOOGLE_PLACES',
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
    warn.mockRestore();
  });
});
