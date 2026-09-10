export type OsmTagMap = Readonly<Partial<Record<'amenity' | 'shop' | 'craft' | 'office' | 'tourism', readonly string[]>>>;

const CATEGORY_MAP: Readonly<Record<string, OsmTagMap>> = {
  restaurant: { amenity: ['restaurant'] },
  restaurante: { amenity: ['restaurant'] },
  cafe: { amenity: ['cafe'] },
  cafeteria: { amenity: ['cafe'] },
  bar: { amenity: ['bar'] },
  pharmacy: { amenity: ['pharmacy'] },
  farmacia: { amenity: ['pharmacy'] },
  hospital: { amenity: ['hospital'] },
  clinic: { amenity: ['clinic', 'dentist', 'doctors'] },
  clinica: { amenity: ['clinic'] },
  supermarket: { shop: ['supermarket'] },
  mercado: { shop: ['supermarket'] },
  bakery: { shop: ['bakery'] },
  padaria: { shop: ['bakery'] },
  butcher: { shop: ['butcher'] },
  clothes: { shop: ['clothes'] },
  hairdresser: { shop: ['hairdresser'] },
  carpenter: { craft: ['carpenter'] },
  marceneiro: { craft: ['carpenter'] },
  electrician: { craft: ['electrician'] },
  accountant: { office: ['accountant'] },
  contador: { office: ['accountant'] },
  lawyer: { office: ['lawyer'] },
  advogado: { office: ['lawyer'] },
  hotel: { tourism: ['hotel'] },
  hostel: { tourism: ['hostel'] },
  guest_house: { tourism: ['guest_house'] },
};

function normalizeCategory(category: string): string {
  return category.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function mapCategoryToOsmTags(category: string): OsmTagMap {
  const mapped = CATEGORY_MAP[normalizeCategory(category)];

  if (!mapped) {
    throw new Error(`Unsupported OpenStreetMap category: ${category.trim() || '(empty)'}`);
  }

  return mapped;
}
