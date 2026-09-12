import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { CreateSavedReportDto } from './create-saved-report.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
});

describe('CreateSavedReportDto', () => {
  it('rejects a definition with an extra field', async () => {
    await expect(
      pipe.transform(
        { name: '30d', definition: { period: '30d', filter: 'free-ast' } },
        { type: 'body', metatype: CreateSavedReportDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a client-supplied organizationId', async () => {
    await expect(
      pipe.transform(
        {
          name: '30d',
          organizationId: 'other-org',
          definition: { period: '30d' },
        },
        { type: 'body', metatype: CreateSavedReportDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
