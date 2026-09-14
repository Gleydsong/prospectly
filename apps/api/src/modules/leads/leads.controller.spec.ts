import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { LeadsController } from './leads.controller';

describe('LeadsController websites', () => {
  it('forbids VIEWER from creating lead websites', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LeadsController.prototype.createLeadWebsite,
    ) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN', 'SALES', 'MEMBER']);
    expect(roles).not.toContain('VIEWER');
  });

  it('forbids VIEWER from mutating lead websites', () => {
    const patchRoles = Reflect.getMetadata(
      ROLES_KEY,
      LeadsController.prototype.updateLeadWebsite,
    ) as string[];
    const deleteRoles = Reflect.getMetadata(
      ROLES_KEY,
      LeadsController.prototype.removeLeadWebsite,
    ) as string[];
    expect(patchRoles).toEqual(['OWNER', 'ADMIN', 'SALES', 'MEMBER']);
    expect(deleteRoles).toEqual(['OWNER', 'ADMIN', 'SALES', 'MEMBER']);
  });
});
