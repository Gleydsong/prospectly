import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { OrganizationFlagKeyParamDto, UpdateOrganizationFlagDto } from './update-organization-flag.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
});

describe('OrganizationFlagKeyParamDto', () => {
  it('accepts an allowlisted key', async () => {
    const result = (await pipe.transform(
      { key: 'saved_report' },
      { type: 'param', metatype: OrganizationFlagKeyParamDto },
    )) as OrganizationFlagKeyParamDto;
    expect(result.key).toBe('saved_report');
  });

  it('rejects an unknown key', async () => {
    await expect(
      pipe.transform({ key: 'gmail' }, { type: 'param', metatype: OrganizationFlagKeyParamDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects shipped R6 keys that must not be flagged', async () => {
    await expect(
      pipe.transform({ key: 'reports_v1' }, { type: 'param', metatype: OrganizationFlagKeyParamDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateOrganizationFlagDto', () => {
  it('rejects a client-supplied organizationId', async () => {
    await expect(
      pipe.transform(
        { enabled: true, organizationId: 'other-org' },
        { type: 'body', metatype: UpdateOrganizationFlagDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
