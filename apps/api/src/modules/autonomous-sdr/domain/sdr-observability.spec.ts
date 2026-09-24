import { InvalidSdrAuditError } from './sdr-errors';
import { SdrAuditLog } from './sdr-observability';

describe('SdrAuditLog', () => {
  it('records a traced decision and hides it from another organization', () => {
    const audit = new SdrAuditLog();
    audit.record({
      organizationId: 'org-a',
      traceId: 'trace-1',
      action: 'sdr.send.blocked',
      resource: 'prospect-1',
      reason: 'suppression',
      costCents: 0,
    });

    expect(audit.read('org-a')).toEqual([
      {
        organizationId: 'org-a',
        traceId: 'trace-1',
        action: 'sdr.send.blocked',
        resource: 'prospect-1',
        reason: 'suppression',
        costCents: 0,
      },
    ]);
    expect(audit.read('org-b')).toEqual([]);
    expect(audit.metrics('org-a')).toEqual({ 'sdr.send.blocked': 1, costCents: 0 });
  });

  it('rejects a missing trace or a secret in the reason', () => {
    const audit = new SdrAuditLog();
    expect(() =>
      audit.record({
        organizationId: 'org-a',
        traceId: ' ',
        action: 'sdr.send.blocked',
        resource: 'prospect-1',
        reason: 'suppression',
        costCents: 0,
      }),
    ).toThrow(InvalidSdrAuditError);
    expect(() =>
      audit.record({
        organizationId: 'org-a',
        traceId: 'trace-1',
        action: 'sdr.send.blocked',
        resource: 'prospect-1',
        reason: 'Authorization: Bearer secret-token',
        costCents: 0,
      }),
    ).toThrow(InvalidSdrAuditError);
    expect(audit.read('org-a')).toEqual([]);
  });
});
