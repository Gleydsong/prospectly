import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadScore } from './lead-score';

describe('LeadScore', () => {
  it('renders explicit scale and high temperature tag for score >= 80', () => {
    render(<LeadScore score={84} />);

    expect(screen.getByText('84/100')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '84');
  });

  it('renders medium temperature tag for score between 50 and 79', () => {
    render(<LeadScore score={65} />);

    expect(screen.getByText('65/100')).toBeInTheDocument();
    expect(screen.getByText('Médio')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '65');
  });

  it('renders cold temperature tag for score < 50', () => {
    render(<LeadScore score={30} />);

    expect(screen.getByText('30/100')).toBeInTheDocument();
    expect(screen.getByText('Frio')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '30');
  });

  it('renders dash when score is null or undefined', () => {
    const { rerender } = render(<LeadScore score={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();

    rerender(<LeadScore score={undefined} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
