import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadStatus } from '@/types';
import { LeadStatusBadge } from './lead-status-badge';

describe('LeadStatusBadge', () => {
  it('renders NEW status with sky colors and pulsing dot', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.NEW} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-sky-50');
    expect(badge.className).toContain('text-sky-700');
    expect(badge.className).toContain('border-sky-200');
    expect(container.querySelector('.animate-ping')).toBeInTheDocument();
  });

  it('renders CONTACTED status with amber colors', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.CONTACTED} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-amber-50');
    expect(badge.className).toContain('text-amber-800');
    expect(badge.className).toContain('border-amber-200');
  });

  it('renders QUALIFIED status with blue colors', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.QUALIFIED} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-blue-50');
    expect(badge.className).toContain('text-blue-700');
    expect(badge.className).toContain('border-blue-200');
  });

  it('renders WON status with emerald colors and check icon', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.WON} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-emerald-50');
    expect(badge.className).toContain('text-emerald-700');
    expect(badge.className).toContain('border-emerald-300');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders LOST status with rose colors', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.LOST} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-rose-50');
    expect(badge.className).toContain('text-rose-700');
    expect(badge.className).toContain('border-rose-200');
  });
});
