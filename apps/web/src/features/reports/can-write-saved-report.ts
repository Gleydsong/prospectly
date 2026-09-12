import { Role } from '@/types';

export function canWriteSavedReport(role: Role | string | undefined): boolean {
  return role === Role.OWNER || role === Role.ADMIN || role === Role.SALES || role === Role.MEMBER
    || role === 'OWNER' || role === 'ADMIN' || role === 'SALES' || role === 'MEMBER';
}
