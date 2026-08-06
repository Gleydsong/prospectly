/** User-facing label for Conversion Studio draft origin (manual / template). */
export function generationModeLabel(mode?: string | null): string {
  if (!mode) return 'Manual';
  const normalized = mode.trim().toLowerCase();
  if (normalized.includes('template')) return 'Modelo';
  return 'Manual';
}

export function generationFormatLabel(): string {
  return 'Blocos';
}
