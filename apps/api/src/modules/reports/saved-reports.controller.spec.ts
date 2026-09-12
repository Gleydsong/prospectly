import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { SavedReportsController } from './saved-reports.controller';

describe('SavedReportsController', () => {
  it('lets VIEWER GET Relatórios salvos (no extra @Roles on list)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SavedReportsController.prototype.list) as
      | string[]
      | undefined;
    expect(roles).toBeUndefined();
  });

  it('restricts create to OWNER ADMIN SALES MEMBER', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SavedReportsController.prototype.create)).toEqual([
      'OWNER',
      'ADMIN',
      'SALES',
      'MEMBER',
    ]);
  });
});
