import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateOpportunityRunDto } from './create-opportunity-run.dto';

describe('CreateOpportunityRunDto', () => {
  it('normalizes a valid Brazil-only request', async () => {
    const dto = plainToInstance(CreateOpportunityRunDto, {
      service: '  Criação de sites  ', niche: '  Roupas no atacado  ', city: '  Curitiba ', state: 'pr', country: 'br',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ service: 'Criação de sites', niche: 'Roupas no atacado', city: 'Curitiba', state: 'PR', country: 'BR' });
  });

  it('rejects non-Brazil country and invalid UF', async () => {
    const dto = plainToInstance(CreateOpportunityRunDto, {
      service: 'Criação de sites', city: 'Lisboa', state: 'LX', country: 'PT',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('keeps niche optional for legacy clients and rejects an empty explicit niche', async () => {
    const legacy = plainToInstance(CreateOpportunityRunDto, {
      service: 'Marketing para restaurantes', city: 'Curitiba', state: 'PR', country: 'BR',
    });
    await expect(validate(legacy)).resolves.toHaveLength(0);

    const emptyNiche = plainToInstance(CreateOpportunityRunDto, {
      service: 'Criação de sites', niche: '   ', city: 'Curitiba', state: 'PR', country: 'BR',
    });
    expect(await validate(emptyNiche)).not.toHaveLength(0);
  });
});
