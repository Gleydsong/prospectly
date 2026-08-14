import { persistableUser } from './auth.store';
import { Role, type AuthUser } from '@/types';

const user: AuthUser = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@example.com',
  organizationId: 'org-1',
  organizationName: 'Acme',
  role: Role.OWNER,
  avatarUrl: 'https://cdn.example/a.png',
  locale: 'pt',
  emailVerifiedAt: '2026-08-01T00:00:00.000Z',
};

describe('persistableUser', () => {
  it('omits role from the persisted snapshot', () => {
    const snapshot = persistableUser(user);
    expect(snapshot).not.toHaveProperty('role');
    expect(snapshot).toMatchObject({
      id: 'u1',
      email: 'ana@example.com',
      organizationId: 'org-1',
    });
  });
});
