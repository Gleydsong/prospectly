export type JsonRecord = Record<string, unknown>;

export type NormalizedAbacateWebhook = {
  eventId: string;
  event: string;
  checkout: JsonRecord | null;
  transparent: JsonRecord | null;
  subscription: JsonRecord | null;
  customer: JsonRecord | null;
  payment: JsonRecord | null;
  metadata: Record<string, string>;
};

export function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export function readString(record: JsonRecord | null | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function readNumber(record: JsonRecord | null | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readMetadata(record: JsonRecord | null | undefined): Record<string, string> {
  const raw = record?.metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export function mergeMetadata(...records: Array<JsonRecord | null | undefined>): Record<string, string> {
  return Object.assign({}, ...records.map((record) => readMetadata(record)));
}

export function extractOrgIdFromExternalId(externalId: string | undefined): string | undefined {
  if (!externalId) return undefined;
  const match = /^org:([^:]+):/.exec(externalId);
  return match?.[1] || undefined;
}

export function isConfirmedPaid(record: JsonRecord | null): boolean {
  if (!record) return false;
  const status = readString(record, 'status')?.toUpperCase();
  if (status === 'PAID' || status === 'APPROVED') return true;
  const paidAmount = readNumber(record, 'paidAmount');
  const amount = readNumber(record, 'amount');
  return (
    typeof paidAmount === 'number' &&
    typeof amount === 'number' &&
    amount > 0 &&
    paidAmount >= amount
  );
}

export function checkoutFrequency(normalized: NormalizedAbacateWebhook): string | undefined {
  return readString(normalized.checkout, 'frequency');
}

export function isSubscriptionCheckout(normalized: NormalizedAbacateWebhook): boolean {
  return checkoutFrequency(normalized) === 'SUBSCRIPTION';
}

export function isCreditPurpose(metadata: Record<string, string>): boolean {
  return (
    metadata.purpose === 'credits' ||
    Boolean(metadata.purchaseId) ||
    metadata.offer === 'credits-2000' ||
    metadata.offer === 'credits-5000'
  );
}

export function chargeId(normalized: NormalizedAbacateWebhook): string | undefined {
  return (
    readString(normalized.checkout, 'id') ??
    readString(normalized.transparent, 'id') ??
    readString(normalized.payment, 'id')
  );
}

export function chargeExternalId(normalized: NormalizedAbacateWebhook): string | undefined {
  return (
    readString(normalized.checkout, 'externalId') ??
    readString(normalized.transparent, 'externalId') ??
    readString(normalized.payment, 'externalId')
  );
}

export function resolveCustomerId(normalized: NormalizedAbacateWebhook): string | undefined {
  return (
    readString(normalized.customer, 'id') ??
    readString(normalized.checkout, 'customerId') ??
    readString(normalized.subscription, 'customerId') ??
    readString(normalized.transparent, 'customerId')
  );
}

export function resolveSubscriptionId(normalized: NormalizedAbacateWebhook): string | undefined {
  return readString(normalized.subscription, 'id');
}

export function toChargeLookup(normalized: NormalizedAbacateWebhook): JsonRecord {
  const primary = normalized.checkout ?? normalized.transparent ?? {};
  return {
    ...primary,
    id: chargeId(normalized),
    externalId: chargeExternalId(normalized),
    metadata: normalized.metadata,
    customerId: resolveCustomerId(normalized),
  };
}

export function normalizeAbacateWebhook(body: unknown): NormalizedAbacateWebhook | null {
  const root = asRecord(body);
  if (!root) return null;
  const event = readString(root, 'event');
  if (!event) return null;

  const data = asRecord(root.data) ?? {};
  let checkout = asRecord(data.checkout);
  let transparent = asRecord(data.transparent);
  const subscription = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const payment = asRecord(data.payment);

  // Legacy flat payloads (pre-v2 nesting) — only when the nested object is absent.
  if (!transparent && event.startsWith('transparent.') && readString(data, 'id')) {
    transparent = data;
  }
  if (!checkout && event.startsWith('checkout.') && readString(data, 'id')) {
    checkout = data;
  }

  const metadata = mergeMetadata(checkout, transparent, subscription, payment, data);
  const nestedId =
    readString(checkout, 'id') ??
    readString(transparent, 'id') ??
    readString(subscription, 'id');
  const eventId = readString(root, 'id') ?? (nestedId ? `${event}:${nestedId}` : undefined);
  if (!eventId) return null;

  return {
    eventId,
    event,
    checkout,
    transparent,
    subscription,
    customer,
    payment,
    metadata,
  };
}
