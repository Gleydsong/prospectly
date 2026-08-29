#!/usr/bin/env node
/**
 * Heuristic secret scan for CI. Does not replace a dedicated scanner in production git history.
 * Skips lockfiles, node_modules, migrations SQL dumps of policies, and .env.example placeholders.
 */
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const SKIP = [
  /(^|\/)node_modules\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)\.git\//,
  /\.env\.example$/,
  /auditoria-.*\.html$/,
  /secret-scan\.cjs$/,
  /\.spec\.ts$/,
  /\.test\.ts$/,
  /\.spec\.tsx$/,
  /\.test\.tsx$/,
];

const PATTERNS = [
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'stripe-live', re: /sk_live_[0-9a-zA-Z]{20,}/ },
  { name: 'generic-bearer', re: /(?:api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{32,}['"]/i },
];

function trackedFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

const hits = [];
for (const file of trackedFiles()) {
  if (SKIP.some((re) => re.test(file))) continue;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of PATTERNS) {
    if (pattern.re.test(content)) {
      hits.push(`${file}: ${pattern.name}`);
    }
  }
}

if (hits.length > 0) {
  console.error('Possible secrets in tracked files:');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log('Secret scan: no high-confidence patterns in tracked files.');
