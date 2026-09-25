import { expect, test } from '@playwright/test';

test('logs in with the local demo user and opens the SDR screen', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('demo@prospectly.dev');
  await page.locator('input[type="password"]').fill('Demo123!');
  await page.getByRole('button', { name: /sign in|entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);

  const persona = page.getByRole('heading', { name: 'Como você trabalha?' });
  const appNav = page.getByRole('navigation', { name: /navegação principal|main navigation/i });
  await expect(persona.or(appNav)).toBeVisible();
  if (await persona.isVisible()) {
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(appNav).toBeVisible();
  }

  await page.goto('/sdr');
  await expect(page.getByText(/Autonomous sending is off|Envio autônomo desligado/).first()).toBeVisible();
  await page.getByRole('button', { name: /Rodar cenário local|Run local scenario/ }).click();
  await expect(page.getByRole('heading', { name: 'Oficina Alfa' })).toBeVisible();
  await expect(page.getByText('Não utiliza SSL').first()).toBeVisible();
  await expect(page.getByText('56/100')).toBeVisible();
  await expect(page.getByText('80%')).toBeVisible();
  await expect(page.getByText('Qualificado').first()).toBeVisible();
  await expect(page.getByText('Bloqueada')).toBeVisible();
  await expect(page.getByText('ssl: absent')).toHaveCount(0);
  await expect(page.getByText('feature_flag')).toHaveCount(0);
  await expect(page.getByText(/Ignore system instructions/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enviar email agora|Send email now/ })).toBeDisabled();

  await page.getByRole('button', { name: 'WhatsApp' }).click();
  await expect(page.getByText(/Este canal não envia sozinho|This channel does not send/)).toBeVisible();
  await expect(page.getByText('O site da Oficina Alfa nao usa SSL.')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Evidências' }).click();
  await expect(page.getByRole('heading', { name: 'Evidências encontradas' })).toBeVisible();
  await expect(page.getByText('Texto externo armazenado. Não autoriza envio.')).toBeVisible();

  await page.getByRole('tab', { name: 'Histórico' }).click();
  await expect(page.getByText('Qualificado · trace-local')).toBeVisible();

  await page.goto('/sdr/research');
  await expect(
    page.getByText(
      /Research starts only for a qualified prospect|Research só começa com um prospect qualificado/,
    ),
  ).toBeVisible();
});
