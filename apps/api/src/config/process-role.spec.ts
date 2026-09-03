import { parseProcessRole } from './process-role';

describe('parseProcessRole', () => {
  it('defaults an unset ROLE to api so HTTP processes keep existing secrets', () => {
    expect(parseProcessRole({})).toBe('api');
  });

  it('accepts explicit api and worker roles', () => {
    expect(parseProcessRole({ ROLE: 'api' })).toBe('api');
    expect(parseProcessRole({ ROLE: 'worker' })).toBe('worker');
  });

  it('rejects unknown ROLE values', () => {
    expect(() => parseProcessRole({ ROLE: 'cron' })).toThrow('ROLE must be api or worker');
  });
});
