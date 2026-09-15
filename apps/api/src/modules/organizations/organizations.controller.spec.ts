import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { OrganizationsController } from './organizations.controller';

describe('OrganizationsController', () => {
  it('requires OWNER or ADMIN to list members', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OrganizationsController.prototype.listMembers) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN']);
  });

  it('requires OWNER or ADMIN to patch organization default persona', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      OrganizationsController.prototype.updateDefaultPersona,
    ) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN']);
  });

  it('forbids VIEWER from patching persona override', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      OrganizationsController.prototype.updatePersonaOverride,
    ) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN', 'SALES', 'MEMBER']);
    expect(roles).not.toContain('VIEWER');
  });
});
