import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  it('provides an accessible entry point for CSV imports', () => {
    render(
      <MemoryRouter>
        <Sidebar open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Importar CSV' })).toHaveAttribute('href', '/imports');
  });
});
