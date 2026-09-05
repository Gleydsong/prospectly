export const SAVED_VIEW_NAME_MAX = 120;
export const SAVED_VIEW_COPY_SUFFIX = ' (cópia)';

export function copiedSavedViewName(name: string): string {
  const trimmed = name.trim();
  if (`${trimmed}${SAVED_VIEW_COPY_SUFFIX}`.length <= SAVED_VIEW_NAME_MAX) {
    return `${trimmed}${SAVED_VIEW_COPY_SUFFIX}`;
  }
  const base = trimmed.slice(0, SAVED_VIEW_NAME_MAX - SAVED_VIEW_COPY_SUFFIX.length).trimEnd();
  return `${base}${SAVED_VIEW_COPY_SUFFIX}`;
}
