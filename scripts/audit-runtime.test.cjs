const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

// Path to script under test
const SCRIPT_PATH = path.resolve(__dirname, 'audit-runtime.cjs');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

test('audit-runtime rejects JSON errors instead of treating them as clean audits', () => {
  const { checkAudit } = require('./audit-runtime.cjs');
  for (const audit of [{ error: { code: 'AUDIT_FAILED' } }, {}, null, { advisories: [] }]) {
    assert.equal(checkAudit(audit).exitCode, 2);
  }
});

test('braces exception is toolchain-only and expires', () => {
  const { checkAudit } = require('./audit-runtime.cjs');
  const advisory = {
    module_name: 'braces',
    severity: 'high',
    github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
    findings: [{ paths: ['apps/api > express > braces'] }],
  };
  assert.equal(checkAudit({ advisories: { 1: advisory } }).exitCode, 1);
  advisory.findings[0].paths = ['. > lint-staged > micromatch > braces'];
  const RealDate = global.Date;
  try {
    global.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : ['2027-02-01T00:00:00Z']));
      }
    };
    assert.equal(checkAudit({ advisories: { 1: advisory } }).exitCode, 1);
  } finally {
    global.Date = RealDate;
  }
});

test('npm vulnerabilities with node_modules paths still block runtime packages', () => {
  const { checkAudit } = require('./audit-runtime.cjs');
  assert.equal(
    checkAudit({
      vulnerabilities: {
        multer: { severity: 'high', nodes: ['node_modules/multer'] },
      },
    }).exitCode,
    1,
  );
});

test('audit-runtime CLI with clean pnpm 9 fixture exits 0', () => {
  const cleanFixture = path.join(FIXTURES_DIR, 'audit-pnpm9-clean.json');
  const result = execFileSync(process.execPath, [SCRIPT_PATH, cleanFixture], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(result, /OK — no unmitigated runtime high\/critical/);
});

test('audit-runtime CLI with runtime high pnpm 9 fixture exits 1', () => {
  const highFixture = path.join(FIXTURES_DIR, 'audit-pnpm9-runtime-high.json');
  let exitCode = 0;
  let stdout = '';
  let stderr = '';
  try {
    stdout = execFileSync(process.execPath, [SCRIPT_PATH, highFixture], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    exitCode = err.status;
    stdout = err.stdout?.toString?.() || '';
    stderr = err.stderr?.toString?.() || '';
  }

  assert.equal(exitCode, 1, `Expected exit code 1, got ${exitCode}`);
  assert.match(stderr, /BLOCKING runtime high\/critical/);
  assert.match(stderr, /multer/);
});

test('audit-runtime evaluates audit data directly via export', () => {
  const auditModule = require('./audit-runtime.cjs');
  assert.equal(
    typeof auditModule.checkAudit,
    'function',
    'audit-runtime.cjs should export checkAudit',
  );

  const cleanData = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, 'audit-pnpm9-clean.json'), 'utf8'),
  );
  const cleanResult = auditModule.checkAudit(cleanData);
  assert.equal(cleanResult.blockers.length, 0, 'Clean fixture should have 0 blockers');
  assert.equal(cleanResult.exitCode, 0);

  const highData = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, 'audit-pnpm9-runtime-high.json'), 'utf8'),
  );
  const highResult = auditModule.checkAudit(highData);
  assert.ok(highResult.blockers.length > 0, 'Runtime high fixture should have blockers');
  assert.equal(highResult.exitCode, 1);
  assert.ok(highResult.blockers.some((b) => b.name === 'multer'));
});

test('audit-runtime supports npm v7/v8 vulnerabilities format as fallback', () => {
  const auditModule = require('./audit-runtime.cjs');
  const legacyData = {
    vulnerabilities: {
      multer: {
        name: 'multer',
        severity: 'high',
        via: [{ title: 'Arbitrary file write in multer' }],
        nodes: ['apps/api > @nestjs/platform-express > multer'],
      },
    },
  };
  const result = auditModule.checkAudit(legacyData);
  assert.equal(result.exitCode, 1);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].name, 'multer');
});

test('audit-runtime ignores documented react-router GHSA-qwww-vcr4-c8h2 but blocks unknown react-router high', () => {
  const auditModule = require('./audit-runtime.cjs');

  // Documented react-router advisory (SPA without RSC)
  const allowedData = {
    advisories: {
      100: {
        id: 100,
        module_name: 'react-router',
        severity: 'high',
        github_advisory_id: 'GHSA-qwww-vcr4-c8h2',
        title: 'React Router RSC bug',
        findings: [
          {
            version: '7.18.2',
            paths: ['apps/web > react-router-dom > react-router'],
          },
        ],
      },
    },
  };
  const allowedResult = auditModule.checkAudit(allowedData);
  assert.equal(allowedResult.blockers.length, 0, 'Documented GHSA-qwww-vcr4-c8h2 should not block');
  assert.equal(allowedResult.exitCode, 0);

  // Unknown react-router high advisory
  const blockedData = {
    advisories: {
      101: {
        id: 101,
        module_name: 'react-router',
        severity: 'high',
        github_advisory_id: 'GHSA-unknown-danger',
        title: 'New unmitigated vulnerability in react-router',
        findings: [
          {
            version: '7.18.2',
            paths: ['apps/web > react-router-dom > react-router'],
          },
        ],
      },
    },
  };
  const blockedResult = auditModule.checkAudit(blockedData);
  assert.equal(blockedResult.blockers.length, 1, 'Unknown react-router high must block');
  assert.equal(blockedResult.exitCode, 1);
});

test('audit-runtime does not block toolchain-only high advisories', () => {
  const auditModule = require('./audit-runtime.cjs');
  const toolchainData = {
    advisories: {
      200: {
        id: 200,
        module_name: 'micromatch',
        severity: 'high',
        github_advisory_id: 'GHSA-fake-micromatch',
        title: 'ReDoS in micromatch',
        findings: [{ version: '4.0.5', paths: ['. > lint-staged > micromatch'] }],
      },
    },
  };
  const result = auditModule.checkAudit(toolchainData);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.exitCode, 0);
  assert.equal(result.allowedToolchain.length, 1);
});
