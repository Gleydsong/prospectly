import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IntegrationsController } from './integrations.controller';

describe('IntegrationsController', () => {
  it('requires OWNER or ADMIN to manage PluginTokens', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.listPluginTokens),
    ).toEqual(['OWNER', 'ADMIN']);
    expect(
      Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.createPluginToken),
    ).toEqual(['OWNER', 'ADMIN']);
    expect(
      Reflect.getMetadata(ROLES_KEY, IntegrationsController.prototype.revokePluginToken),
    ).toEqual(['OWNER', 'ADMIN']);
  });

  it('does not expose outbound webhook routes', () => {
    expect(IntegrationsController.prototype).not.toHaveProperty('upsertWebhook');
    expect(IntegrationsController.prototype).not.toHaveProperty('rotateWebhookSecret');
    expect(IntegrationsController.prototype).not.toHaveProperty('listWebhookDeliveries');
    expect(IntegrationsController.prototype).not.toHaveProperty('list');
  });
});
