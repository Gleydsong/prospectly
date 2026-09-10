import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LeadWebsiteGap, resolveWebsitePitch } from './lead-website-gap';

describe('resolveWebsitePitch', () => {
  it('returns digital menu copy for restaurant/gastronomy niches', () => {
    const pitch = resolveWebsitePitch('restaurant', null, 'Jaboatão dos Guararapes');
    expect(pitch).toContain('cardápio digital ou pedidos online');
    expect(pitch).toContain('em Jaboatão dos Guararapes');
  });

  it('returns online booking copy for beauty/salon/health niches', () => {
    const pitch = resolveWebsitePitch('hairdresser', 'Salão de beleza', 'Recife');
    expect(pitch).toContain('agendamento online ou catálogo de serviços');
    expect(pitch).toContain('em Recife');
    expect(pitch).not.toContain('cardápio digital');
  });

  it('returns institutional site copy for general services without specific category', () => {
    const pitch = resolveWebsitePitch(null, 'Oficina mecânica', 'Olinda');
    expect(pitch).toContain('presença online no Google ou site institucional');
    expect(pitch).toContain('em Olinda');
  });
});

describe('LeadWebsiteGap', () => {
  it('renders customized pitch based on lead category and lets user input URL', async () => {
    const user = userEvent.setup();
    const onSaveUrl = vi.fn();

    render(
      <LeadWebsiteGap
        companyName="Studio Bella"
        category="beauty_salon"
        city="Jaboatão dos Guararapes"
        googleHref="https://google.com/search?q=Studio+Bella"
        onSaveUrl={onSaveUrl}
      />,
    );

    expect(
      screen.getByText(/agendamento online ou catálogo de serviços em Jaboatão dos Guararapes/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /inserir url/i }));
    const input = screen.getByLabelText(/url do site/i);
    await user.type(input, 'https://studiobella.com.br');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(onSaveUrl).toHaveBeenCalledWith('https://studiobella.com.br/');
  });
});
