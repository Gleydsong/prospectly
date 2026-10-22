const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SELF_FILE = path.resolve(__filename);

// Única exceção fora do histórico: este guard precisa citar o termo para procurá-lo.
// Registros históricos (ADRs e planos arquivados) podem manter menções antigas.
const ALLOWED_PREFIXES = ['docs/decisions/', 'docs/superpowers/'];

/**
 * Returns every tracked file in the repo, except the historical allowlist and this guard.
 */
function getGuardedFiles(rootDir = ROOT_DIR) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: rootDir, encoding: 'utf8' });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix)))
    .map((rel) => path.join(rootDir, rel))
    .filter(
      (file) =>
        path.resolve(file) !== SELF_FILE && fs.existsSync(file) && fs.statSync(file).isFile(),
    )
    .sort();
}

/**
 * Scans given files for case-insensitive 'ollama'
 */
function findOllamaOccurrences(files, rootDir = ROOT_DIR) {
  const matches = [];
  const OLLAMA_PATTERN = /ollama/i;

  for (const file of files) {
    if (path.resolve(file) === SELF_FILE) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('\0')) continue;
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (OLLAMA_PATTERN.test(line)) {
        matches.push({
          file: path.relative(rootDir, file),
          line: index + 1,
          content: line.trim(),
        });
      }
    });
  }

  return matches;
}

test('guard: scanner correctly detects case-insensitive occurrences in memory/content', () => {
  const testFile = path.join(ROOT_DIR, '.guard-test-sample.tmp');
  try {
    fs.writeFileSync(testFile, 'line 1\nOLLAMA_HOST=localhost\nline 3\n');
    const found = findOllamaOccurrences([testFile]);
    assert.equal(found.length, 1);
    assert.equal(found[0].line, 2);
    assert.equal(found[0].content, 'OLLAMA_HOST=localhost');
  } finally {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  }
});

test('guard: tracked files outside docs/decisions and docs/superpowers must not contain ollama', () => {
  const guardedFiles = getGuardedFiles();
  assert.ok(guardedFiles.length > 0, 'Expected to scan guarded files across production paths');

  // Verify key critical files are in the scanned list
  const relativeFiles = guardedFiles.map((f) => path.relative(ROOT_DIR, f));
  assert.ok(relativeFiles.includes('README.md'), 'README.md must be guarded');
  assert.ok(relativeFiles.includes('docker-compose.yml'), 'docker-compose.yml must be guarded');
  assert.ok(
    relativeFiles.includes('apps/api/.env.example'),
    'apps/api/.env.example must be guarded',
  );
  assert.ok(
    relativeFiles.some((f) => f.startsWith('apps/api/src/')),
    'apps/api/src must be guarded',
  );
  for (const prefix of [
    'docs/privacy/',
    'docs/deploy/',
    'docs/architecture/',
    'apps/api/scripts/',
  ]) {
    assert.ok(
      relativeFiles.some((f) => f.startsWith(prefix)),
      `${prefix} must be guarded`,
    );
  }
  assert.ok(relativeFiles.includes('render.yaml'), 'render.yaml must be guarded');
  assert.ok(
    !relativeFiles.some((f) => ALLOWED_PREFIXES.some((prefix) => f.startsWith(prefix))),
    'historical docs stay outside the guard',
  );

  const matches = findOllamaOccurrences(guardedFiles);

  if (matches.length > 0) {
    const details = matches.map((m) => `  - ${m.file}:${m.line} -> ${m.content}`).join('\n');
    assert.fail(
      `Forbidden references to "ollama" found outside the historical allowlist:\n${details}`,
    );
  }
});

module.exports = {
  getGuardedFiles,
  findOllamaOccurrences,
};
