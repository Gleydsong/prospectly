import {
  chargeId,
  extractOrgIdFromExternalId,
  isConfirmedPaid,
  isSubscriptionCheckout,
  normalizeAbacateWebhook,
  resolveCustomerId,
  resolveSubscriptionId,
} from './abacate-webhook';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('normalizeAbacateWebhook', () => {
  it('reads nested transparent.completed from official v2 shape', () => {
    const normalized = normalizeAbacateWebhook({
      id: 'log_pix_1',
      event: 'transparent.completed',
      apiVersion: 2,
      data: {
        transparent: {
          id: 'pix_credits_1',
          externalId: `org:${ORG_ID}:credits:purchase_1`,
          amount: 999,
          paidAmount: 999,
          status: 'PAID',
          metadata: { organizationId: ORG_ID, purpose: 'credits', purchaseId: 'purchase_1' },
        },
      },
    });
    expect(normalized?.eventId).toBe('log_pix_1');
    expect(normalized?.transparent?.id).toBe('pix_credits_1');
    expect(normalized?.metadata.purchaseId).toBe('purchase_1');
    expect(isConfirmedPaid(normalized!.transparent)).toBe(true);
  });

  it('reads nested checkout.completed and does not treat data.id as checkout id', () => {
    const normalized = normalizeAbacateWebhook({
      event: 'checkout.completed',
      apiVersion: 2,
      data: {
        checkout: {
          id: 'bill_abc123xyz',
          externalId: 'org:org1:credits:purchase_1',
          amount: 999,
          paidAmount: 999,
          frequency: 'ONE_TIME',
          status: 'PAID',
          methods: ['CARD'],
          customerId: 'cust_abc123',
          metadata: { purchaseId: 'purchase_1', purpose: 'credits' },
        },
        customer: { id: 'cust_abc123', name: 'João Silva', email: 'joao@exemplo.com' },
      },
    });
    expect(normalized?.eventId).toBe('checkout.completed:bill_abc123xyz');
    expect(chargeId(normalized!)).toBe('bill_abc123xyz');
    expect(resolveCustomerId(normalized!)).toBe('cust_abc123');
    expect(isSubscriptionCheckout(normalized!)).toBe(false);
  });

  it('extracts subscription and customer ids from nested subscription.completed', () => {
    const normalized = normalizeAbacateWebhook({
      id: 'log_taQArRTApemxwcbw5EJeF3hS',
      event: 'subscription.completed',
      apiVersion: 2,
      data: {
        subscription: {
          id: 'subs_tAFqDWBhcEYTjQh2K0ZYDHau',
          status: 'ACTIVE',
          frequency: 'MONTHLY',
        },
        customer: { id: 'cust_def456', name: 'Maria Santos' },
        payment: { id: 'char_xyz789', status: 'PAID', paidAmount: 2990, amount: 2990 },
        checkout: {
          id: 'bill_jskd3TMfScHZDJe5NSZjTmQ4',
          frequency: 'SUBSCRIPTION',
          status: 'PAID',
          customerId: 'cust_def456',
          metadata: { organizationId: ORG_ID, purpose: 'plan', interval: 'monthly' },
        },
      },
    });
    expect(resolveSubscriptionId(normalized!)).toBe('subs_tAFqDWBhcEYTjQh2K0ZYDHau');
    expect(resolveCustomerId(normalized!)).toBe('cust_def456');
    expect(isSubscriptionCheckout(normalized!)).toBe(true);
    expect(normalized?.metadata.organizationId).toBe(ORG_ID);
  });

  it('extracts org id from controlled externalId', () => {
    expect(extractOrgIdFromExternalId(`org:${ORG_ID}:monthly:abc`)).toBe(ORG_ID);
  });
});
