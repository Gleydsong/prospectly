import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

describe('SegmentedControl', () => {
  const options = [
    { value: 'lista', label: 'Lista' },
    { value: 'quadro', label: 'Quadro' },
    { value: 'mapa', label: 'Mapa' },
  ];

  it('renders all options with appropriate aria-pressed states', () => {
    render(
      <SegmentedControl
        ariaLabel="Visualização"
        options={options}
        value="lista"
        onChange={vi.fn()}
      />,
    );

    const listaBtn = screen.getByRole('button', { name: 'Lista' });
    const quadroBtn = screen.getByRole('button', { name: 'Quadro' });
    const mapaBtn = screen.getByRole('button', { name: 'Mapa' });

    expect(listaBtn).toHaveAttribute('aria-pressed', 'true');
    expect(quadroBtn).toHaveAttribute('aria-pressed', 'false');
    expect(mapaBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the selected value on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Visualização"
        options={options}
        value="lista"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Quadro' }));
    expect(onChange).toHaveBeenCalledWith('quadro');
  });

  it('does not call onChange when clicking disabled option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const disabledOptions = [
      { value: 'lista', label: 'Lista' },
      { value: 'quadro', label: 'Quadro', disabled: true },
    ];
    render(
      <SegmentedControl
        options={disabledOptions}
        value="lista"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Quadro' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports role="tablist" with arrow key navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        role="tablist"
        ariaLabel="Abas de visualização"
        options={options}
        value="lista"
        onChange={onChange}
      />,
    );

    const listaTab = screen.getByRole('tab', { name: 'Lista' });
    const quadroTab = screen.getByRole('tab', { name: 'Quadro' });
    const mapaTab = screen.getByRole('tab', { name: 'Mapa' });

    expect(listaTab).toHaveAttribute('aria-selected', 'true');
    expect(quadroTab).toHaveAttribute('aria-selected', 'false');
    expect(mapaTab).toHaveAttribute('aria-selected', 'false');

    listaTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('quadro');

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('mapa');

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('lista');
  });
});
