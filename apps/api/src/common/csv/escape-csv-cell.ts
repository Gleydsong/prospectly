/**
 * Escape a CSV cell for Excel/Sheets formula injection and RFC quoting.
 * Prefixes values that would be interpreted as formulas.
 */
export function escapeCsvCell(value: string): string {
  let next = value;
  if (/^[=+\-@|\t\r]/.test(next)) {
    next = `'${next}`;
  }
  if (/[",\n\r]/.test(next)) {
    return `"${next.replace(/"/g, '""')}"`;
  }
  return next;
}
