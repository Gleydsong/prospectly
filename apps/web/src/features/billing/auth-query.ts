export function billingAuthQuery(input: {
  offer?: string | null;
  plan?: string | null;
  method?: string | null;
}): string {
  if (!input.offer && !input.plan) return '';
  const params = new URLSearchParams();
  if (input.offer) params.set('offer', input.offer);
  if (input.plan) params.set('plan', input.plan);
  if (input.method === 'pix' || input.method === 'card') params.set('method', input.method);
  const query = params.toString();
  return query ? `?${query}` : '';
}
