import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { QueryFunnelConversionDto } from './query-funnel-conversion.dto';
import { QueryFunnelConversionLeadsDto } from './query-funnel-conversion-leads.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
});

describe('QueryFunnelConversionDto', () => {
  it('rejects all-time period', async () => {
    await expect(
      pipe.transform({ period: 'all' }, { type: 'query', metatype: QueryFunnelConversionDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults to 30d when period is omitted', async () => {
    const result = (await pipe.transform(
      {},
      { type: 'query', metatype: QueryFunnelConversionDto },
    )) as QueryFunnelConversionDto;
    expect(result.period).toBe('30d');
  });

  it('rejects a client-supplied organizationId instead of scoping by query', async () => {
    await expect(
      pipe.transform(
        { organizationId: 'other-org' },
        { type: 'query', metatype: QueryFunnelConversionDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('QueryFunnelConversionLeadsDto', () => {
  it('rejects a bucket that is not inflow, wins or losses', async () => {
    await expect(
      pipe.transform(
        { period: '30d', bucket: 'rate' },
        { type: 'query', metatype: QueryFunnelConversionLeadsDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
