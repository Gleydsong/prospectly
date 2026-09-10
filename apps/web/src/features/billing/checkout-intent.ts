export type CheckoutIntent = {
  purpose: 'credits' | 'plan';
  offer?: 'credits-2000' | 'credits-5000';
  plan?: 'monthly';
  baselineCreditBalance?: number;
  provider: 'ASAAS';
  externalCheckoutId?: string;
};

const KEY = 'prospectly.checkoutIntent';

export function saveCheckoutIntent(intent: CheckoutIntent): void {
  sessionStorage.setItem(KEY, JSON.stringify(intent));
}

export function readCheckoutIntent(): CheckoutIntent | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutIntent;
    if (parsed.purpose !== 'credits' && parsed.purpose !== 'plan') return null;
    if (parsed.provider !== 'ASAAS') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  sessionStorage.removeItem(KEY);
}
