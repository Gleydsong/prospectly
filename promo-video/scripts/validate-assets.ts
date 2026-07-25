import { access, constants } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CAPTURES = path.join(ROOT, 'public', 'captures');

const REQUIRED = [
  'landing-hero.png',
  'landing-scroll.png',
  'app-login.png',
  'app-dashboard.png',
  'app-search.png',
  'app-search-filled.png',
  'app-leads.png',
  'app-pipeline.png',
  'app-register-empty.png',
  'app-register-filled.png',
] as const;

const OPTIONAL = ['demo-walkthrough.webm'] as const;

async function exists(file: string): Promise<boolean> {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const missing: string[] = [];
  for (const name of REQUIRED) {
    const full = path.join(CAPTURES, name);
    if (!(await exists(full))) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.error('Missing required capture assets:');
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
    console.error('\nRun: npm run capture');
    process.exit(1);
  }

  for (const name of OPTIONAL) {
    const full = path.join(CAPTURES, name);
    if (!(await exists(full))) {
      console.warn(`Optional asset missing (ok): ${name}`);
    } else {
      console.log(`✓ optional ${name}`);
    }
  }

  console.log(`Validated ${REQUIRED.length} required assets in public/captures/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
