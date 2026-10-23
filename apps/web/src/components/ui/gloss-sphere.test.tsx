import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlossSphere, type GlossSphereVariant } from './gloss-sphere';

describe('GlossSphere', () => {
  it('renders with aria-hidden="true"', () => {
    render(<GlossSphere />);
    const el = screen.getByTestId('gloss-sphere');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(['azul', 'sinal', 'lima', 'tinta'] as GlossSphereVariant[])(
    'renders variant %s',
    (variant) => {
      render(<GlossSphere variant={variant} />);
      const el = screen.getByTestId('gloss-sphere');
      expect(el).toHaveAttribute('data-variant', variant);
    },
  );

  it('renders configured sizes', () => {
    const { rerender } = render(<GlossSphere size="sm" />);
    let el = screen.getByTestId('gloss-sphere');
    expect(el).toHaveAttribute('width', '18');

    rerender(<GlossSphere size="xl" />);
    el = screen.getByTestId('gloss-sphere');
    expect(el).toHaveAttribute('width', '72');

    rerender(<GlossSphere size={50} />);
    el = screen.getByTestId('gloss-sphere');
    expect(el).toHaveAttribute('width', '50');
  });
});
