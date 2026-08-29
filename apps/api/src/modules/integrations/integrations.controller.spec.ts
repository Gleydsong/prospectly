import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IntegrationsController } from './integrations.controller';

describe('IntegrationsController', () => {
  it('requires OWNER or ADMIN to list integrations', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.list) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN']);
  });
});
