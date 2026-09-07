import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GoogleConnectionsController } from './google-connections.controller';

describe('GoogleConnectionsController', () => {
  it('lets any authenticated member GET me, including VIEWER', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, GoogleConnectionsController.prototype.me) as
      | string[]
      | undefined;
    expect(roles).toBeUndefined();
  });

  it('restricts start and disconnect to MEMBER and above', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GoogleConnectionsController.prototype.start)).toEqual([
      'MEMBER',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, GoogleConnectionsController.prototype.disconnect)).toEqual(
      ['MEMBER'],
    );
  });

  it('restricts org list and revoke to ADMIN and above', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GoogleConnectionsController.prototype.listOrg)).toEqual([
      'ADMIN',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, GoogleConnectionsController.prototype.revoke)).toEqual([
      'ADMIN',
    ]);
  });

  it('exposes the OAuth callback without a session', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, GoogleConnectionsController.prototype.callback)).toBe(
      true,
    );
  });
});
