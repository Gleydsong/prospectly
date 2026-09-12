import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadStatus } from '@/types';
import { LeadStatusBadge } from './lead-status-badge';

describe('LeadStatusBadge', () => {
  it('renders NEW status with a live indicator', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.NEW} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveAttribute('data-status', LeadStatus.NEW);
    expect(container.querySelector('.animate-ping')).toBeInTheDocument();
  });

  it('renders CONTACTED status', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.CONTACTED} />);
    expect(container.firstChild).toHaveAttribute('data-status', LeadStatus.CONTACTED);
  });

  it('renders QUALIFIED status', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.QUALIFIED} />);
    expect(container.firstChild).toHaveAttribute('data-status', LeadStatus.QUALIFIED);
  });

  it('renders WON status with a check icon', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.WON} />);
    expect(container.firstChild).toHaveAttribute('data-status', LeadStatus.WON);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders LOST status', () => {
    const { container } = render(<LeadStatusBadge status={LeadStatus.LOST} />);
    expect(container.firstChild).toHaveAttribute('data-status', LeadStatus.LOST);
  });
});
