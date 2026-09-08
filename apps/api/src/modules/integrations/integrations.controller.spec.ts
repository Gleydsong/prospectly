import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IntegrationsController } from './integrations.controller';

describe('IntegrationsController', () => {
  it('requires OWNER or ADMIN to list integrations', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.list) as string[];
    expect(roles).toEqual(['OWNER', 'ADMIN']);
  });

  it('requires OWNER or ADMIN to rotate the signing secret and list Entregas', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.rotateWebhookSecret),
    ).toEqual(['OWNER', 'ADMIN']);
    expect(
      Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.listWebhookDeliveries),
    ).toEqual(['OWNER', 'ADMIN']);
  });
});
