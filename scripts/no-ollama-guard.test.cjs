const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SELF_FILE = path.resolve(__filename);

/**
 * Recursively find all files in dir
 */
function findFiles(dir, filterFn = () => true) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === '.next' ||
      entry.name === 'coverage'
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, filterFn));
    } else if (entry.isFile() && filterFn(fullPath, entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Returns all target files guarded against ollama references:
 * - apps/ * /src
 * - packages/ * /src
 * - .env.example (root and subprojects)
 * - docker-compose*
 * - README.md (root and subprojects)
 * - docs/privacy
 */
function getGuardedFiles(rootDir = ROOT_DIR) {
  const files = new Set();

  // apps/*/src
  const appsDir = path.join(rootDir, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir)) {
      const srcDir = path.join(appsDir, app, 'src');
      if (fs.existsSync(srcDir)) {
        for (const file of findFiles(srcDir)) {
          files.add(file);
        }
      }
    }
  }

  // packages/*/src
  const packagesDir = path.join(rootDir, 'packages');
  if (fs.existsSync(packagesDir)) {
    for (const pkg of fs.readdirSync(packagesDir)) {
      const srcDir = path.join(packagesDir, pkg, 'src');
      if (fs.existsSync(srcDir)) {
        for (const file of findFiles(srcDir)) {
          files.add(file);
        }
      }
    }
  }

  // docs/privacy
  const privacyDir = path.join(rootDir, 'docs', 'privacy');
  if (fs.existsSync(privacyDir)) {
    for (const file of findFiles(privacyDir)) {
      files.add(file);
    }
  }

  // .env.example files
  for (const file of findFiles(rootDir, (_p, name) => name === '.env.example' || name.endsWith('.env.example'))) {
    files.add(file);
  }

  // docker-compose* files
  for (const file of findFiles(rootDir, (_p, name) => name.startsWith('docker-compose') || name.startsWith('compose'))) {
    files.add(file);
  }

  // README.md (root, apps/*, packages/*)
  for (const file of findFiles(rootDir, (_p, name) => name.toLowerCase() === 'readme.md')) {
    const rel = path.relative(rootDir, file);
    if (rel === 'README.md' || rel.startsWith('apps/') || rel.startsWith('packages/')) {
      files.add(file);
    }
  }

  // Exclude self if somehow matched
  files.delete(SELF_FILE);

  return Array.from(files).sort();
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

test('guard: apps/*/src, packages/*/src, .env.example, docker-compose*, README.md and docs/privacy must not contain ollama', () => {
  const guardedFiles = getGuardedFiles();
  assert.ok(guardedFiles.length > 0, 'Expected to scan guarded files across production paths');

  // Verify key critical files are in the scanned list
  const relativeFiles = guardedFiles.map((f) => path.relative(ROOT_DIR, f));
  assert.ok(relativeFiles.includes('README.md'), 'README.md must be guarded');
  assert.ok(relativeFiles.includes('docker-compose.yml'), 'docker-compose.yml must be guarded');
  assert.ok(relativeFiles.includes('apps/api/.env.example'), 'apps/api/.env.example must be guarded');
  assert.ok(
    relativeFiles.some((f) => f.startsWith('apps/api/src/')),
    'apps/api/src must be guarded',
  );
  assert.ok(
    relativeFiles.some((f) => f.startsWith('docs/privacy/')),
    'docs/privacy must be guarded',
  );

  const matches = findOllamaOccurrences(guardedFiles);

  if (matches.length > 0) {
    const details = matches.map((m) => `  - ${m.file}:${m.line} -> ${m.content}`).join('\n');
    assert.fail(`Forbidden references to "ollama" found in guarded production paths:\n${details}`);
  }
});

module.exports = {
  getGuardedFiles,
  findOllamaOccurrences,
};
