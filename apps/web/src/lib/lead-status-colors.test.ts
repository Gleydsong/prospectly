import { describe, expect, it } from 'vitest';

import { LEAD_STATUS_COLORS } from './lead-status-colors';
import { LeadStatus } from '@/types';
import { applyThemeClass } from '@/features/theme/theme-storage';

function channels(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(ink: string, background: string) {
  const alpha = background.length === 9 ? parseInt(background.slice(7), 16) / 255 : 1;
  const surface = channels('#172237');
  const composed = channels(background).map((v, index) => alpha * v + (1 - alpha) * surface[index]);
  const a = luminance(channels(ink));
  const b = luminance(composed);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('LeadStatus palette', () => {
  it('keeps shared accent text and white action labels readable in both themes', () => {
    for (const background of ['#172237', '#1e3a67', '#213149']) {
      expect(contrast('#93bfff', background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of ['#ffffff', '#e6efff', '#f4f6fb']) {
      expect(contrast('#1d4ed8', background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of ['#2563eb', '#1d4ed8']) {
      expect(contrast('#ffffff', background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('covers all 12 domain states with distinct pin families', () => {
    expect(Object.keys(LEAD_STATUS_COLORS).sort()).toEqual(Object.values(LeadStatus).sort());
    expect(Object.keys(LEAD_STATUS_COLORS)).toHaveLength(12);
    expect(new Set(Object.values(LEAD_STATUS_COLORS).map((colors) => colors.light.pin)).size).toBe(
      12,
    );
  });

  it.each(Object.values(LeadStatus))(
    '%s has accessible day/night pills and translucent night fill',
    (status) => {
      const { light, dark } = LEAD_STATUS_COLORS[status];
      expect(contrast(light.ink, light.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.ink, dark.background)).toBeGreaterThanOrEqual(4.5);
      expect(dark.background).toBe(`${dark.pin}29`);
      for (const mode of ['light', 'dark'] as const) {
        applyThemeClass(mode);
        for (const [token, value] of Object.entries(LEAD_STATUS_COLORS[status][mode])) {
          expect(
            document.documentElement.style.getPropertyValue(`--lead-status-${status}-${token}`),
          ).toBe(value);
        }
      }
      applyThemeClass('light');
    },
  );
});
