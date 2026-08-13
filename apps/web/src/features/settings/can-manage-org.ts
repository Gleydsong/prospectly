import { Role } from '@/types';

export function canManageOrg(role: Role | string | undefined): boolean {
  return role === Role.OWNER || role === Role.ADMIN || role === 'OWNER' || role === 'ADMIN';
}
