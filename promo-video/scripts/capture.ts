/**
 * Playwright capture script for Prospectly promo video assets.
 * Requires landing (:3001), web (:5173) and API (:3000) running.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'captures');

const LANDING_URL = process.env.LANDING_URL ?? 'http://localhost:3001';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@prospectly.dev';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo123!';

const VIEWPORT = { width: 1600, height: 900 } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await page.fill(selector, '');
  for (const char of text) {
    await page.type(selector, char, { delay: 55 + Math.random() * 40 });
  }
}

async function shot(page: Page, name: string) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, type: 'png' });
  console.log(`✓ ${name}`);
}

async function captureLanding(page: Page) {
  await page.goto(LANDING_URL, { waitUntil: 'networkidle' });
  await sleep(1200);
  await page.getByRole('button', { name: /entendi/i }).click().catch(() => undefined);
  await sleep(400);
  await shot(page, 'landing-hero.png');
  await page.evaluate(() => window.scrollBy({ top: 700, behavior: 'smooth' }));
  await sleep(900);
  await shot(page, 'landing-scroll.png');
}

async function captureApp(page: Page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await sleep(800);
  await shot(page, 'app-login.png');

  await humanType(page, 'input[type="email"]', DEMO_EMAIL);
  await sleep(300);
  await humanType(page, 'input[type="password"]', DEMO_PASSWORD);
  await sleep(400);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 20000,
  });
  await sleep(1500);
  await shot(page, 'app-dashboard.png');

  // Feature 1: Search
  await page.click('a[href="/search"], a[href*="search"]').catch(async () => {
    await page.goto(`${APP_URL}/search`, { waitUntil: 'networkidle' });
  });
  await page.waitForURL('**/search', { timeout: 15000 }).catch(() => undefined);
  await sleep(1200);
  await shot(page, 'app-search.png');

  // Try to fill search form fields slowly
  const selects = page.locator('select');
  const selectCount = await selects.count();
  if (selectCount > 0) {
    for (let i = 0; i < Math.min(selectCount, 3); i++) {
      const options = await selects.nth(i).locator('option').all();
      if (options.length > 1) {
        const value = await options[1].getAttribute('value');
        if (value) {
          await selects.nth(i).selectOption(value);
          await sleep(450);
        }
      }
    }
  }

  const textInputs = page.locator(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
  );
  const inputCount = await textInputs.count();
  if (inputCount > 0) {
    const first = textInputs.first();
    const type = await first.getAttribute('type');
    if (type !== 'file') {
      await first.click();
      await first.fill('');
      await first.type('Lisboa', { delay: 70 });
      await sleep(500);
    }
  }
  await sleep(800);
  await shot(page, 'app-search-filled.png');

  // Feature 2: Leads
  await page.goto(`${APP_URL}/leads`, { waitUntil: 'networkidle' });
  await sleep(1400);
  await shot(page, 'app-leads.png');

  // Feature 3: Pipeline
  await page.goto(`${APP_URL}/pipeline`, { waitUntil: 'networkidle' });
  await sleep(1400);
  await shot(page, 'app-pipeline.png');
}

async function captureSignup(page: Page) {
  await page.goto(`${APP_URL}/register`, { waitUntil: 'networkidle' });
  await sleep(900);
  const languageSelect = page.locator('select').first();
  if ((await languageSelect.count()) > 0) {
    await languageSelect.selectOption('pt').catch(() => undefined);
    await sleep(400);
  }
  await shot(page, 'app-register-empty.png');

  // Fill without submitting — avoids creating disposable accounts on every capture.
  await humanType(page, 'input[name="name"]', 'Ana Silva');
  await sleep(250);
  await humanType(page, 'input[name="email"]', 'ana.silva@agencia.pt');
  await sleep(250);
  await humanType(page, 'input[name="password"]', 'SenhaForte1');
  await sleep(250);
  await humanType(page, 'input[name="organizationName"]', 'Agência Norte');
  await sleep(300);
  await page.locator('input[name="acceptTerms"]').check();
  await sleep(500);
  await shot(page, 'app-register-filled.png');
}

async function captureWalkthroughVideo() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: OUT_DIR,
      size: VIEWPORT,
    },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await sleep(600);
  await humanType(page, 'input[type="email"]', DEMO_EMAIL);
  await humanType(page, 'input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 20000,
  });
  await sleep(1200);
  await page.goto(`${APP_URL}/search`, { waitUntil: 'networkidle' });
  await sleep(1500);
  await page.goto(`${APP_URL}/leads`, { waitUntil: 'networkidle' });
  await sleep(1500);
  await page.goto(`${APP_URL}/pipeline`, { waitUntil: 'networkidle' });
  await sleep(1800);

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const rawPath = await video.path();
    const target = path.join(OUT_DIR, 'demo-walkthrough.webm');
    const { rename, copyFile, unlink } = await import('node:fs/promises');
    try {
      await rename(rawPath, target);
    } catch {
      await copyFile(rawPath, target);
      await unlink(rawPath).catch(() => undefined);
    }
    console.log('✓ demo-walkthrough.webm');
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });

  try {
    await captureLanding(page);
    await captureSignup(page);
    await captureApp(page);
  } finally {
    await browser.close();
  }

  try {
    await captureWalkthroughVideo();
  } catch (error) {
    console.warn('Walkthrough video capture skipped:', error);
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    landingUrl: LANDING_URL,
    appUrl: APP_URL,
    viewport: VIEWPORT,
    files: [
      'landing-hero.png',
      'landing-scroll.png',
      'app-register-empty.png',
      'app-register-filled.png',
      'app-login.png',
      'app-dashboard.png',
      'app-search.png',
      'app-search-filled.png',
      'app-leads.png',
      'app-pipeline.png',
      'demo-walkthrough.webm',
    ],
  };
  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  console.log('\nCapture complete → public/captures/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
