import { PROSPECTING_CATEGORIES } from '@/types';

const CATEGORY_LABEL = Object.fromEntries(
  PROSPECTING_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<string, string>;

export function formatCategoryTag(category: string): string {
  const label = CATEGORY_LABEL[category] ?? category.replace(/_/g, ' ');
  const trimmed = label.trim();
  if (!trimmed) return category;
  return trimmed.charAt(0).toLocaleUpperCase('pt-BR') + trimmed.slice(1);
}
