import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { CustomFieldsController } from './custom-fields.controller';

describe('CustomFieldsController', () => {
  it('lets VIEWER GET definitions (no extra @Roles on list)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, CustomFieldsController.prototype.list) as
      | string[]
      | undefined;
    expect(roles).toBeUndefined();
  });

  it('restricts schema mutate to OWNER and ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomFieldsController.prototype.create)).toEqual([
      'OWNER',
      'ADMIN',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, CustomFieldsController.prototype.update)).toEqual([
      'OWNER',
      'ADMIN',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, CustomFieldsController.prototype.archive)).toEqual([
      'OWNER',
      'ADMIN',
    ]);
  });
});
