/** Pricing copy aligned with apps/landing — keep in sync with DISPLAY_PRICES. */
export const PRICING = {
  planName: 'Starter',
  freeHook: '3 buscas grátis para validar',
  monthly: {
    label: 'Mensal',
    price: 'R$ 97',
    suffix: '/mês',
    cta: 'Assinar mensal',
  },
  lifetime: {
    label: 'Vitalício',
    price: 'R$ 997',
    suffix: 'pagamento único',
    cta: 'Comprar vitalício',
  },
  currencies: [
    { code: 'BRL', monthly: 'R$ 97', lifetime: 'R$ 997' },
    { code: 'EUR', monthly: '€ 19', lifetime: '€ 197' },
    { code: 'USD', monthly: '$ 29', lifetime: '$ 297' },
  ],
  features: [
    'Buscas OSM + Google Places',
    'Filtro sem website',
    'Importação CSV',
    'Pipeline e tarefas',
    'Suporte por e-mail',
  ],
} as const;
