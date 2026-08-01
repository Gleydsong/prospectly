#!/usr/bin/env node
/**
 * Fails CI on high/critical advisories that affect production dependency paths.
 * Toolchain-only highs must be listed in docs/security/audit-exceptions.md and
 * matched here by package name — review expiration dates regularly.
 *
 * Usage: node scripts/audit-runtime.cjs
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/** Production/runtime package names (or prefixes) that must never carry unmitigated high+. */
const RUNTIME_ROOTS = new Set([
  'multer',
  'next',
  'react-router',
  'react-router-dom',
  'postcss',
  'sharp',
  '@nestjs/platform-express',
  '@nestjs/common',
  '@nestjs/core',
  'express',
  'body-parser',
]);

/**
 * Documented toolchain exceptions (high allowed until expiry).
 * Keep in sync with docs/security/audit-exceptions.md
 */
const TOOLCHAIN_EXCEPTIONS = new Map([
  // brace-expansion via eslint / nest-cli / webpack — not shipped in API/web/landing runtime images
  ['brace-expansion', { expires: '2026-10-01', reason: 'devDependency chain (eslint/nest-cli)' }],
]);

function isRuntimePath(pnpmPath) {
  if (!pnpmPath || typeof pnpmPath !== 'string') return false;
  const parts = pnpmPath.split(/\s*>\s*/).map((p) => p.replace(/@[\d].*$/, '').trim());
  // First package after apps/* is the workspace package; look at any dep that is a runtime root
  return parts.some((name) => {
    const bare = name.replace(/@.*/, '');
    return RUNTIME_ROOTS.has(bare) || RUNTIME_ROOTS.has(name);
  });
}

function loadAudit() {
  try {
    const raw = execSync('pnpm audit --audit-level=high --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(raw);
  } catch (err) {
    // pnpm audit exits non-zero when vulns exist; stdout still has JSON
    const out = err.stdout?.toString?.() || '';
    if (!out.trim()) {
      console.error('audit-runtime: failed to run pnpm audit', err.message);
      process.exit(2);
    }
    try {
      return JSON.parse(out);
    } catch {
      console.error('audit-runtime: could not parse audit JSON');
      process.exit(2);
    }
  }
}

function main() {
  const audit = loadAudit();
  const vulns = audit.vulnerabilities || {};
  const blockers = [];
  const allowedToolchain = [];

  for (const [name, v] of Object.entries(vulns)) {
    if (v.severity !== 'high' && v.severity !== 'critical') continue;

    const exception = TOOLCHAIN_EXCEPTIONS.get(name);
    const paths = Array.isArray(v.nodes)
      ? v.nodes
      : (v.effects || []).concat(v.nodes || []);

    // pnpm v9 structure: v.via, and path info in audit.actions or use `pnpm why`
    const viaRuntime =
      (v.dependents || []).some?.(isRuntimePath) ||
      (typeof v.range === 'string' && RUNTIME_ROOTS.has(name));

    // Heuristic: if package itself is a runtime root → block
    const isRuntimePackage = RUNTIME_ROOTS.has(name);

    if (isRuntimePackage || viaRuntime) {
      if (exception) {
        const expired = new Date(exception.expires) < new Date();
        if (expired) {
          blockers.push({ name, severity: v.severity, note: `exception expired ${exception.expires}` });
        } else {
          allowedToolchain.push({ name, severity: v.severity, ...exception });
        }
        continue;
      }
      blockers.push({
        name,
        severity: v.severity,
        note: v.via?.[0]?.title || v.via?.[0]?.url || 'runtime advisory',
      });
      continue;
    }

    if (exception) {
      allowedToolchain.push({ name, severity: v.severity, ...exception });
      continue;
    }

    // Non-runtime, undocumented high → still report but do not block (toolchain noise)
    allowedToolchain.push({
      name,
      severity: v.severity,
      expires: 'review',
      reason: 'non-runtime path (toolchain); document if persists',
    });
  }

  console.log('audit-runtime: toolchain allowed / deferred:');
  for (const a of allowedToolchain) {
    console.log(`  - ${a.severity} ${a.name}: ${a.reason || ''} (expires ${a.expires || 'n/a'})`);
  }

  if (blockers.length) {
    console.error('\naudit-runtime: BLOCKING runtime high/critical:');
    for (const b of blockers) {
      console.error(`  - ${b.severity} ${b.name}: ${b.note}`);
    }
    console.error('\nSee docs/security/audit-exceptions.md');
    process.exit(1);
  }

  console.log('\naudit-runtime: OK — no unmitigated runtime high/critical');
  process.exit(0);
}

main();
