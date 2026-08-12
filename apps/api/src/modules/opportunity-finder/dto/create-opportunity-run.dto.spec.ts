import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateOpportunityRunDto } from './create-opportunity-run.dto';

describe('CreateOpportunityRunDto', () => {
  it('normalizes a valid Brazil-only request', async () => {
    const dto = plainToInstance(CreateOpportunityRunDto, {
      service: '  Criação de sites  ', city: '  Curitiba ', state: 'pr', country: 'br',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ service: 'Criação de sites', city: 'Curitiba', state: 'PR', country: 'BR' });
  });

  it('rejects non-Brazil country and invalid UF', async () => {
    const dto = plainToInstance(CreateOpportunityRunDto, {
      service: 'Criação de sites', city: 'Lisboa', state: 'LX', country: 'PT',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
