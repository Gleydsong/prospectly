import { canManageOrg } from './can-manage-org';
import { Role } from '@/types';

describe('canManageOrg', () => {
  it('allows OWNER and ADMIN', () => {
    expect(canManageOrg(Role.OWNER)).toBe(true);
    expect(canManageOrg(Role.ADMIN)).toBe(true);
  });

  it('hides billing actions for VIEWER', () => {
    expect(canManageOrg(Role.VIEWER)).toBe(false);
    expect(canManageOrg(Role.SALES)).toBe(false);
    expect(canManageOrg(undefined)).toBe(false);
  });
});
