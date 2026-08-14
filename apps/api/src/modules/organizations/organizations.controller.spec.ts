import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { OrganizationsController } from './organizations.controller';

describe('OrganizationsController', () => {
  it('requires OWNER or ADMIN to list members', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OrganizationsController.prototype.listMembers) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN']);
  });
});
