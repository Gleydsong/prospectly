export function billingAuthQuery(input: { offer?: string | null; plan?: string | null }): string {
  if (!input.offer && !input.plan) return '';
  const params = new URLSearchParams();
  if (input.offer) params.set('offer', input.offer);
  if (input.plan) params.set('plan', input.plan);
  const query = params.toString();
  return query ? `?${query}` : '';
}
