import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { LeadFormModal } from './lead-form-modal';

vi.mock('@/features/leads/hooks', () => ({
  useCreateLead: () => ({ mutateAsync: vi.fn() }),
}));

describe('Customer creation modal terminology', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('pt');
  });

  it.each([
    ['pt', 'Novo cliente', 'Criar cliente'],
    ['en', 'New customer', 'Create customer'],
  ])('uses customer labels in %s', async (locale, title, action) => {
    await i18n.changeLanguage(locale);
    renderWithProviders(<LeadFormModal open onClose={vi.fn()} />, { withGoogle: false });
    expect(screen.getByRole('dialog')).toHaveAccessibleName(title);
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
  });
});
