#!/usr/bin/env node
/**
 * Fails CI on high/critical advisories that affect production dependency paths.
 * Toolchain-only highs must be listed in docs/security/audit-exceptions.md and
 * matched here by GHSA — review expiration dates regularly.
 *
 * Usage: node scripts/audit-runtime.cjs [path-to-audit.json]
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
  'lodash',
  'js-yaml',
  '@nestjs/platform-express',
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/config',
  '@nestjs/swagger',
  'express',
  'body-parser',
]);

/**
 * Documented exceptions (high allowed until expiry).
 * Prefer pnpm.overrides or package.json auditConfig.ignoreGhsas over script exceptions.
 * Keep in sync with docs/security/audit-exceptions.md
 */
const TOOLCHAIN_EXCEPTIONS = new Map([
  // React Router: false positive in npm advisory DB (GHSA-qwww-vcr4-c8h2 only affects RSC; apps/web is Vite SPA)
  [
    'GHSA-qwww-vcr4-c8h2',
    {
      name: 'react-router',
      allowRuntime: true,
      expires: '2027-01-01',
      reason:
        'Vite SPA without RSC; false positive in npm advisory DB (see docs/security/audit-exceptions.md)',
    },
  ],
  // Braces via lint-staged / chokidar / micromatch — toolchain only, approved in #344
  [
    'GHSA-vfj7-8cjw-p6xm',
    {
      name: 'braces',
      expires: '2026-11-17',
      reason: 'toolchain-only (lint-staged/micromatch/chokidar); approved in #344',
    },
  ],
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

function loadAudit(fixturePath) {
  if (fixturePath) {
    try {
      const content = fs.readFileSync(path.resolve(process.cwd(), fixturePath), 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('audit-runtime: failed to read fixture file', err.message);
      process.exit(2);
    }
  }

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

function checkAudit(audit) {
  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isRecord(audit) || (!isRecord(audit.advisories) && !isRecord(audit.vulnerabilities))) {
    console.error('audit-runtime: invalid audit JSON (expected advisories or vulnerabilities)');
    return { exitCode: 2, blockers: [], allowedToolchain: [] };
  }
  const advisoriesList = [];

  if (audit.advisories && typeof audit.advisories === 'object') {
    // Build a map of action resolves by advisory id (pnpm 9 format)
    const resolvesByAdvId = new Map();
    if (Array.isArray(audit.actions)) {
      for (const action of audit.actions) {
        if (Array.isArray(action.resolves)) {
          for (const res of action.resolves) {
            if (res.id != null && res.path) {
              const key = String(res.id);
              if (!resolvesByAdvId.has(key)) resolvesByAdvId.set(key, []);
              resolvesByAdvId.get(key).push(res.path);
            }
          }
        }
      }
    }

    for (const [id, adv] of Object.entries(audit.advisories)) {
      if (!adv) continue;
      const findings = Array.isArray(adv.findings) ? adv.findings : [];
      let paths = findings.flatMap((f) => (Array.isArray(f.paths) ? f.paths : []));
      if (paths.length === 0 && resolvesByAdvId.has(String(id))) {
        paths = resolvesByAdvId.get(String(id));
      }
      advisoriesList.push({
        id: adv.id || id,
        name: adv.module_name || adv.name || '',
        severity: adv.severity || '',
        githubAdvisoryId: adv.github_advisory_id || '',
        title: adv.title || adv.overview || 'runtime advisory',
        url: adv.url || '',
        paths,
      });
    }
  } else if (audit.vulnerabilities && typeof audit.vulnerabilities === 'object') {
    // Fallback for npm v7+ audit format
    for (const [name, v] of Object.entries(audit.vulnerabilities)) {
      if (!v) continue;
      const nodes = Array.isArray(v.nodes) ? v.nodes : [];
      const effects = Array.isArray(v.effects) ? v.effects : [];
      const dependents = Array.isArray(v.dependents) ? v.dependents : [];
      const paths = [...nodes, ...effects, ...dependents];
      advisoriesList.push({
        id: v.name || name,
        name: v.name || name,
        severity: v.severity || '',
        githubAdvisoryId: v.via?.[0]?.url?.match(/GHSA-[\w-]+/)?.[0] || '',
        title: v.via?.[0]?.title || v.via?.[0]?.url || 'runtime advisory',
        url: v.via?.[0]?.url || '',
        paths,
      });
    }
  }

  const blockers = [];
  const allowedToolchain = [];

  for (const adv of advisoriesList) {
    if (adv.severity !== 'high' && adv.severity !== 'critical') continue;

    const exception = TOOLCHAIN_EXCEPTIONS.get(adv.githubAdvisoryId);

    const hasRuntimePath = adv.paths.some(isRuntimePath);
    const isRuntimePackage = RUNTIME_ROOTS.has(adv.name);
    const viaRuntime = hasRuntimePath || isRuntimePackage;

    if (exception && new Date(exception.expires) < new Date()) {
      blockers.push({
        name: adv.name,
        severity: adv.severity,
        note: `exception expired ${exception.expires}`,
      });
      continue;
    }

    if (viaRuntime) {
      if (exception?.allowRuntime) {
        allowedToolchain.push({ name: adv.name, severity: adv.severity, ...exception });
        continue;
      }

      blockers.push({
        name: adv.name,
        severity: adv.severity,
        note: adv.title || adv.url || 'runtime advisory',
      });
      continue;
    }

    if (exception) {
      allowedToolchain.push({ name: adv.name, severity: adv.severity, ...exception });
      continue;
    }

    // Non-runtime, undocumented high → still report but do not block (toolchain noise)
    allowedToolchain.push({
      name: adv.name,
      severity: adv.severity,
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
    return { exitCode: 1, blockers, allowedToolchain };
  }

  console.log('\naudit-runtime: OK — no unmitigated runtime high/critical');
  return { exitCode: 0, blockers, allowedToolchain };
}

function main() {
  const fixturePath = process.argv[2] || process.env.AUDIT_JSON_PATH;
  const audit = loadAudit(fixturePath);
  const { exitCode } = checkAudit(audit);
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  loadAudit,
  checkAudit,
  isRuntimePath,
  RUNTIME_ROOTS,
  TOOLCHAIN_EXCEPTIONS,
};
