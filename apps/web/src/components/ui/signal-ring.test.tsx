import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignalRing } from './signal-ring';

describe('SignalRing', () => {
  it('renders with aria-hidden="true"', () => {
    render(<SignalRing />);
    const el = screen.getByTestId('signal-ring');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders preset sizes correctly', () => {
    const { rerender } = render(<SignalRing size="sm" />);
    let el = screen.getByTestId('signal-ring');
    expect(el).toHaveAttribute('width', '48');
    expect(el).toHaveAttribute('height', '48');

    rerender(<SignalRing size="xl" />);
    el = screen.getByTestId('signal-ring');
    expect(el).toHaveAttribute('width', '180');
    expect(el).toHaveAttribute('height', '180');
  });

  it('accepts a custom pixel size number', () => {
    render(<SignalRing size={96} />);
    const el = screen.getByTestId('signal-ring');
    expect(el).toHaveAttribute('width', '96');
    expect(el).toHaveAttribute('height', '96');
  });

  it('applies custom className', () => {
    render(<SignalRing className="custom-ring-class" />);
    const el = screen.getByTestId('signal-ring');
    expect(el).toHaveClass('custom-ring-class');
  });
});
