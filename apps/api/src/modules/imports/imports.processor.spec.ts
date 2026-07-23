import { Logger } from '@nestjs/common';

import { ImportsProcessor } from './imports.processor';

describe('ImportsProcessor', () => {
  const jobData = {
    importId: 'import-1',
    correlationId: 'corr-1',
  };

  it('records a sanitized failure only after the final BullMQ attempt', async () => {
    const imports = {
      getJobContext: jest.fn().mockResolvedValue({ organizationId: 'org-1', correlationId: 'corr-1' }),
      process: jest.fn().mockRejectedValue(new Error('redis password=super-secret')),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new ImportsProcessor(imports as never);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(
      processor.process({ data: jobData, attemptsMade: 2, opts: { attempts: 3 } } as never),
    ).rejects.toThrow('CSV import processing failed. Please try again later.');

    expect(imports.recordFailure).toHaveBeenCalledWith('import-1');
    expect(warn).toHaveBeenCalledWith({
      message: 'CSV import processing failed',
      importId: 'import-1',
      organizationId: 'org-1',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('super-secret');
    warn.mockRestore();
  });

  it('leaves the import processing while BullMQ will retry', async () => {
    const imports = {
      getJobContext: jest.fn().mockResolvedValue({ organizationId: 'org-1', correlationId: 'corr-1' }),
      process: jest.fn().mockRejectedValue(new Error('temporary failure')),
      recordFailure: jest.fn(),
    };
    const processor = new ImportsProcessor(imports as never);

    await expect(
      processor.process({ data: jobData, attemptsMade: 0, opts: { attempts: 3 } } as never),
    ).rejects.toThrow('CSV import processing failed. Please try again later.');

    expect(imports.recordFailure).not.toHaveBeenCalled();
  });
});
