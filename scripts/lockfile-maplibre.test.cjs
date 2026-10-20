const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lockfile = fs.readFileSync(path.join(__dirname, '..', 'pnpm-lock.yaml'), 'utf8');

test('adding MapLibre preserves the existing Vite jiti peer resolution', () => {
  const viteResolutions = lockfile.split('\n').filter((line) => /vite(?:-node|st)?[@:]/.test(line));
  assert.ok(viteResolutions.some((line) => line.includes('(jiti@2.7.0)')));
  assert.ok(viteResolutions.every((line) => !line.includes('(jiti@1.21.7)')));
});

test('adding MapLibre preserves the existing ESLint resolver peer snapshot', () => {
  assert.ok(
    lockfile.includes(
      'eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0(@typescript-eslint/parser@8.65.0',
    ),
  );
});
