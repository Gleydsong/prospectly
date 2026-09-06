import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  it('lets VIEWER GET funnel conversion (no extra @Roles on the handler)', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ReportsController.prototype.funnelConversion,
    ) as string[] | undefined;
    expect(roles).toBeUndefined();
  });

  it('lets VIEWER GET funnel conversion lead ids (no extra @Roles on the handler)', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ReportsController.prototype.funnelConversionLeads,
    ) as string[] | undefined;
    expect(roles).toBeUndefined();
  });
});
