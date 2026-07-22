import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreBadge } from './score-badge';

describe('ScoreBadge', () => {
  it('renders score points', () => {
    render(<ScoreBadge score={85} />);
    expect(screen.getByText('85 pts')).toBeInTheDocument();
  });

  it('labels high priority scores', () => {
    render(<ScoreBadge score={92} />);
    expect(screen.getByTitle('Alta prioridade')).toBeInTheDocument();
  });

  it('labels low scores', () => {
    render(<ScoreBadge score={10} />);
    expect(screen.getByTitle('Baixa')).toBeInTheDocument();
  });
});
