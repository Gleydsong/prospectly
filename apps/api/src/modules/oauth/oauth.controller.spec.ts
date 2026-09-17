import { Public } from '../../common/decorators/public.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { OauthController } from './oauth.controller';

describe('OauthController', () => {
  it('exposes DCR, authorize, token and revoke as public routes', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, OauthController.prototype.register)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, OauthController.prototype.authorize)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, OauthController.prototype.token)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, OauthController.prototype.revoke)).toBe(true);
    expect(Public).toBeDefined();
  });
});
