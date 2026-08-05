/** User-facing label for Conversion Studio generation modes (React Aura pipeline). */
export function generationModeLabel(mode?: string | null): string {
  if (!mode) return 'React Aura';
  if (mode === 'TEMPLATE' || mode === 'TEMPLATE_FALLBACK' || mode.startsWith('AI_')) {
    return 'React Aura';
  }
  return 'React Aura';
}

export function generationFormatLabel(): string {
  return 'React Aura';
}
