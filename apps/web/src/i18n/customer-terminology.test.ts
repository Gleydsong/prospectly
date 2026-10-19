import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import pt from './locales/pt.json';

// Technical interpolation parameters are replaced before display. Keep exceptions
// scoped to the exact key and token so new visible uses cannot slip through.
const technicalAllowlist: Record<string, string[]> = {
  'pipeline.moveToStageFor': ['{{lead}}'],
  'pipeline.movedAnnouncement': ['{{lead}}'],
};

function visibleValues(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    visibleValues(child, path ? `${path}.${key}` : key),
  );
}

describe('Customer terminology in translations', () => {
  it.each([
    ['pt', pt],
    ['en', en],
  ] as const)('uses customer terminology in %s display values', (_, locale) => {
    const violations = visibleValues(locale).filter(([path, value]) => {
      const visible = (technicalAllowlist[path] ?? []).reduce(
        (text, token) => text.replaceAll(token, ''),
        value,
      );
      return /\bleads?\b|\bcliente(?:s|\(s\))?\s+potencia(?:l|is|l\(is\))/i.test(visible);
    });
    expect(violations).toEqual([]);
  });
});
