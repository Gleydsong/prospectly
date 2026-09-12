import {
  PROSPECTING_CATEGORIES,
  type SearchStatus,
} from '@/types';

export const CATEGORY_LABEL = Object.fromEntries(
  PROSPECTING_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<string, string>;

CATEGORY_LABEL.hostel = 'Albergue';

export const STATUS_LABEL: Record<SearchStatus, string> = {
  PENDING: 'Na fila',
  PROCESSING: 'A pesquisar',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
};

export function formatSearchHeading(input: {
  categories?: string[];
  category?: string;
  city: string;
}): string {
  const values =
    input.categories && input.categories.length > 0
      ? input.categories
      : input.category
        ? [input.category]
        : [];
  const labels = values.map((value) => CATEGORY_LABEL[value] ?? value);
  const categoryText = labels.length > 0 ? labels.join(', ') : 'Pesquisa';
  return `${categoryText} / ${input.city}`;
}

export function statusTone(status: SearchStatus): 'amber' | 'blue' | 'green' | 'red' {
  if (status === 'PENDING') return 'amber';
  if (status === 'PROCESSING') return 'blue';
  return status === 'COMPLETED' ? 'green' : 'red';
}
