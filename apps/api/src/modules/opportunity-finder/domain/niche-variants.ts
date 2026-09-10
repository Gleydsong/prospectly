import { PROSPECTING_CATEGORIES, type ProspectingCategory } from '@prospectly/shared-types';

export const MAX_OPPORTUNITY_SEARCH_VARIANTS = 4;

export type OpportunityNicheResolution =
  | { status: 'RESOLVED'; category: ProspectingCategory }
  | { status: 'NOT_IDENTIFIED' }
  | { status: 'AMBIGUOUS'; categories: ProspectingCategory[] };

export const NICHE_ALIASES: Record<ProspectingCategory, readonly string[]> = {
  restaurant: [
    'restaurante', 'restaurantes', 'pizzaria', 'pizzarias', 'lanchonete', 'lanchonetes',
    'churrascaria', 'churrascarias', 'hamburgueria', 'hamburguerias', 'pastelaria', 'pastelarias',
    'marmitaria', 'marmitarias', 'food truck', 'food trucks', 'self service', 'comida caseira',
    'bistro', 'bistros', 'cantina', 'cantinas', 'bar e restaurante',
  ],
  cafe: [
    'cafe', 'cafes', 'cafeteria', 'cafeterias', 'cafeteria gourmet', 'casa de cha', 'casas de cha',
    'acai', 'acaiteria', 'acaiterias', 'sorveteria', 'sorveterias', 'confeitaria de cafe',
  ],
  bar: [
    'bar', 'bares', 'boteco', 'botecos', 'botequim', 'botequins', 'pub', 'pubs',
    'chopperia', 'chopperias', 'cervejaria', 'cervejarias', 'petiscaria', 'petiscarias',
  ],
  pharmacy: [
    'farmacia', 'farmacias', 'drogaria', 'drogarias', 'drugstore', 'farmacia de manipulação',
    'farmacia de manipulacao',
  ],
  hospital: [
    'hospital', 'hospitais', 'pronto socorro', 'pronto atendimento', 'upa', 'santa casa',
    'santa casas', 'hospital municipal', 'hospital regional',
  ],
  clinic: [
    'clinica', 'clinicas', 'consultorio', 'consultorios', 'dentista', 'dentistas', 'odontologia',
    'clinica odontologica', 'clinicas odontologicas', 'consultorio odontologico',
    'clinica medica', 'clinicas medicas', 'consultorio medico', 'centro medico', 'centros medicos',
    'policlinica', 'policlinicas', 'fisioterapia', 'fisioterapeuta', 'psicologo', 'psicologos',
    'psicologia', 'nutricionista', 'nutricionistas', 'oftalmologia', 'dermatologia', 'pediatria',
    'cardiologia', 'laboratorio de analises', 'posto de saude',
    'ortodontia', 'implante dentario',
  ],
  supermarket: [
    'supermercado', 'supermercados', 'hipermercado', 'hipermercados', 'mercearia', 'mercearias',
    'mercado', 'mercados', 'minimercado', 'minimercados', 'hortifruti', 'hortifrutis',
    'atacado de alimentos',
  ],
  bakery: [
    'padaria', 'padarias', 'panificadora', 'panificadoras', 'panificacao', 'confeitaria',
    'confeitarias', 'casa de paes',
  ],
  butcher: [
    'acougue', 'acougues', 'casa de carne', 'casa de carnes', 'casas de carne', 'casas de carnes',
  ],
  clothes: [
    'roupa', 'roupas', 'vestuario', 'vestuarios', 'moda', 'confeccao', 'confeccoes',
    'loja de roupa', 'loja de roupas', 'lojas de roupa', 'lojas de roupas', 'boutique', 'boutiques',
    'moda feminina', 'moda masculina', 'moda infantil', 'atacado de roupa', 'atacado de roupas',
    'roupas no atacado', 'roupas de atacado', 'roupas de atacados',
  ],
  hairdresser: [
    'cabeleireiro', 'cabeleireiros', 'cabelereiro', 'cabelereiros', 'barbearia', 'barbearias',
    'salao', 'saloes', 'salao de beleza', 'saloes de beleza', 'estetica', 'clinica de estetica',
    'clinicas de estetica', 'clinica estetica', 'manicure', 'manicures', 'pedicure', 'spa de beleza',
    'salao de cabeleireiro',
  ],
  carpenter: [
    'marcenaria', 'marcenarias', 'marceneiro', 'marceneiros', 'moveis planejados',
    'moveis sob medida', 'marceneiro de moveis',
  ],
  electrician: [
    'eletricista', 'eletricistas', 'instalacao eletrica', 'instalacoes eletricas',
    'eletricista residencial', 'servicos eletricos',
  ],
  accountant: [
    'contabilidade', 'contabilidades', 'contador', 'contadores', 'escritorio contabil',
    'escritorios contabeis', 'escritorio de contabilidade', 'escritorios de contabilidade',
  ],
  lawyer: [
    'advocacia', 'advocacias', 'advogado', 'advogados', 'escritorio juridico',
    'escritorios juridicos', 'escritorio de advocacia', 'escritorios de advocacia',
  ],
  hotel: [
    'hotel', 'hoteis', 'aparthotel', 'aparthoteis', 'hotel fazenda',
  ],
  hostel: [
    'hostel', 'hostels', 'albergue', 'albergues',
  ],
  guest_house: [
    'pousada', 'pousadas', 'hospedaria', 'hospedarias', 'bed and breakfast',
  ],
};

const LABEL_BY_CATEGORY = Object.fromEntries(
  PROSPECTING_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<ProspectingCategory, string>;

export function normalizeNiche(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isPhraseMatch(normalizedHaystack: string, alias: string): boolean {
  const hay = ` ${normalizedHaystack} `;
  const needle = ` ${alias} `;
  if (hay.includes(needle)) return true;
  if (alias.length < 5 || alias.includes(' ')) return false;
  return normalizedHaystack.split(' ').some((token) => token === alias || token.startsWith(alias));
}

export function resolveOpportunityNiche(niche: string): OpportunityNicheResolution {
  const normalized = normalizeNiche(niche);
  if (!normalized) return { status: 'NOT_IDENTIFIED' };

  const matches: Array<{ category: ProspectingCategory; alias: string }> = [];
  for (const [category, aliases] of Object.entries(NICHE_ALIASES) as Array<
    [ProspectingCategory, readonly string[]]
  >) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeNiche(alias);
      if (!normalizedAlias) continue;
      if (isPhraseMatch(normalized, normalizedAlias)) {
        matches.push({ category, alias: normalizedAlias });
      }
    }
  }

  if (matches.length === 0) return { status: 'NOT_IDENTIFIED' };

  const dominant = matches.filter((match) => (
    !matches.some((other) => (
      other.alias.length > match.alias.length
      && other.alias.includes(match.alias)
    ))
  ));
  const categories = [...new Set(dominant.map((match) => match.category))];
  if (categories.length === 0) return { status: 'NOT_IDENTIFIED' };
  if (categories.length > 1) return { status: 'AMBIGUOUS', categories };
  return { status: 'RESOLVED', category: categories[0]! };
}

export function buildOpportunitySearchPhrases(
  niche: string,
  category: ProspectingCategory,
): string[] {
  const original = niche.trim();
  const canonical = LABEL_BY_CATEGORY[category] ?? category;
  const aliases = NICHE_ALIASES[category] ?? [];
  const candidates = [original, canonical, ...[...aliases].sort((left, right) => right.length - left.length)];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const phrase of candidates) {
    const key = normalizeNiche(phrase);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(phrase);
    if (unique.length >= MAX_OPPORTUNITY_SEARCH_VARIANTS) break;
  }
  return unique;
}
