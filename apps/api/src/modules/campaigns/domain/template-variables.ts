/** Allowed template placeholders — never evaluate arbitrary expressions. */
export const SAFE_TEMPLATE_VARIABLES = [
  'companyName',
  'tradeName',
  'contactName',
  'email',
  'phone',
  'city',
  'website',
  'ownerName',
] as const;

export type SafeTemplateVariable = (typeof SAFE_TEMPLATE_VARIABLES)[number];

export type TemplateVariableValues = Partial<Record<SafeTemplateVariable, string | null | undefined>>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function listTemplateVariables(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1]!);
  }
  return [...found];
}

export function validateTemplateVariables(text: string): { valid: boolean; unknown: string[] } {
  const used = listTemplateVariables(text);
  const allowed = new Set<string>(SAFE_TEMPLATE_VARIABLES);
  const unknown = used.filter((name) => !allowed.has(name));
  return { valid: unknown.length === 0, unknown };
}

/**
 * Safe Mustache-like substitution. Unknown variables are left intact.
 * No code evaluation, no nested lookups, no HTML auto-escape beyond plain replace.
 */
export function renderTemplate(
  template: string,
  values: TemplateVariableValues,
): { rendered: string; missing: string[]; unknown: string[] } {
  const allowed = new Set<string>(SAFE_TEMPLATE_VARIABLES);
  const missing: string[] = [];
  const unknown: string[] = [];
  const seenMissing = new Set<string>();
  const seenUnknown = new Set<string>();

  const rendered = template.replace(VARIABLE_PATTERN, (full, name: string) => {
    if (!allowed.has(name)) {
      if (!seenUnknown.has(name)) {
        seenUnknown.add(name);
        unknown.push(name);
      }
      return full;
    }
    const value = values[name as SafeTemplateVariable];
    if (value == null || String(value).trim() === '') {
      if (!seenMissing.has(name)) {
        seenMissing.add(name);
        missing.push(name);
      }
      return full;
    }
    return String(value);
  });

  return { rendered, missing, unknown };
}
