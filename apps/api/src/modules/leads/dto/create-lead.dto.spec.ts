import { ValidationPipe, BadRequestException } from '@nestjs/common';

import { CreateLeadDto } from './create-lead.dto';
import { UpdateLeadDto } from './update-lead.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

describe('CreateLeadDto / UpdateLeadDto identity fields', () => {
  it('rejects client-supplied source and externalId on create', async () => {
    await expect(
      pipe.transform(
        {
          companyName: 'Loja Manual',
          source: 'CSV_IMPORT',
          externalId: 'csv-import:import-1:2',
        },
        { type: 'body', metatype: CreateLeadDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects client-supplied websitePresence and websiteCheckSource on create', async () => {
    await expect(
      pipe.transform(
        {
          companyName: 'Loja Manual',
          websitePresence: 'WEBSITE_FOUND',
          websiteCheckSource: 'OpenStreetMap',
        },
        { type: 'body', metatype: CreateLeadDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects client-supplied ownerId on update (mass assignment)', async () => {
    await expect(
      pipe.transform(
        {
          companyName: 'Loja',
          ownerId: 'someone-else',
        },
        { type: 'body', metatype: UpdateLeadDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
