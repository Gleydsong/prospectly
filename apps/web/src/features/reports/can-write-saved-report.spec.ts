import { canWriteSavedReport } from './can-write-saved-report';
import { Role } from '@/types';

describe('canWriteSavedReport', () => {
  it('lets OWNER ADMIN SALES MEMBER create a Relatório salvo', () => {
    expect(canWriteSavedReport(Role.OWNER)).toBe(true);
    expect(canWriteSavedReport(Role.ADMIN)).toBe(true);
    expect(canWriteSavedReport(Role.SALES)).toBe(true);
    expect(canWriteSavedReport(Role.MEMBER)).toBe(true);
  });

  it('blocks VIEWER', () => {
    expect(canWriteSavedReport(Role.VIEWER)).toBe(false);
    expect(canWriteSavedReport(undefined)).toBe(false);
  });
});
