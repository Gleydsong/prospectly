import { REQUIRE_EMAIL_VERIFIED_KEY } from '../../common/decorators/require-email-verified.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { OrganizationFlagsController } from './organization-flags.controller';

describe('OrganizationFlagsController', () => {
  it('lets VIEWER GET allowlisted flags (no extra @Roles on list)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OrganizationFlagsController.prototype.list) as
      | string[]
      | undefined;
    expect(roles).toBeUndefined();
  });

  it('restricts PUT to OWNER and ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OrganizationFlagsController.prototype.update)).toEqual([
      'OWNER',
      'ADMIN',
    ]);
  });

  it('requires a verified email to mutate flags', () => {
    expect(
      Reflect.getMetadata(REQUIRE_EMAIL_VERIFIED_KEY, OrganizationFlagsController.prototype.update),
    ).toBe(true);
  });
});
