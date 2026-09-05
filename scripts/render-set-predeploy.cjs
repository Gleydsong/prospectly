#!/usr/bin/env node
/**
 * Sets the Render Pre-Deploy Command on the live `prospectly-api` service so that
 * `prisma migrate deploy` runs exactly once per deploy, after the build and before
 * the new revision goes live. See docs/deploy/migrations.md.
 *
 * The live API is a Node-runtime service managed by "operação dirigida" (Dashboard /
 * API), not by Blueprint sync — hence a script instead of a render.yaml change.
 *
 * Dry-run by default: prints the current commands and the planned change.
 *
 * Usage:
 *   RENDER_API_KEY=... node scripts/render-set-predeploy.cjs            # dry-run
 *   RENDER_API_KEY=... node scripts/render-set-predeploy.cjs --apply    # PATCH + verify
 *   RENDER_API_KEY=... node scripts/render-set-predeploy.cjs --clear --apply
 */
const API_BASE = process.env.RENDER_API_BASE ?? 'https://api.render.com/v1';
const SERVICE_NAME = 'prospectly-api';
const PRE_DEPLOY_COMMAND = 'pnpm --filter @prospectly/api exec prisma migrate deploy';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const clear = args.has('--clear');
const token = process.env.RENDER_API_KEY;

if (!token) {
  console.error('RENDER_API_KEY is required (create one in Render → Account Settings → API Keys).');
  process.exit(2);
}

async function render(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function findApiService() {
  const params = new URLSearchParams({ name: SERVICE_NAME, type: 'web_service', limit: '20' });
  const items = await render(`/services?${params}`);
  const matches = items.map((item) => item.service ?? item).filter((s) => s.name === SERVICE_NAME);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one web service named ${SERVICE_NAME}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function describe(details) {
  return {
    runtime: details.runtime ?? details.env,
    plan: details.plan,
    buildCommand: details.envSpecificDetails?.buildCommand,
    preDeployCommand: details.envSpecificDetails?.preDeployCommand ?? '',
    startCommand: details.envSpecificDetails?.startCommand,
  };
}

async function main() {
  const service = await findApiService();
  const before = describe(service.serviceDetails);
  const target = clear ? '' : PRE_DEPLOY_COMMAND;

  console.log(`Service: ${service.name} (${service.id}) — ${before.runtime} / ${before.plan}`);
  console.log(`Current preDeployCommand: ${JSON.stringify(before.preDeployCommand)}`);
  console.log(`Target  preDeployCommand: ${JSON.stringify(target)}`);

  if (before.runtime !== 'node') {
    throw new Error(
      `Refusing: expected node runtime, got ${before.runtime}. Docker runner ships no Prisma CLI.`,
    );
  }
  if (before.plan === 'free') {
    throw new Error('Refusing: pre-deploy commands require a paid instance type.');
  }
  if (before.preDeployCommand === target) {
    console.log('Already up to date. Nothing to do.');
    return;
  }
  if (!apply) {
    console.log('Dry-run. Re-run with --apply to PATCH the service.');
    return;
  }

  // Send build/start back unchanged so a whole-object replace cannot wipe them.
  const updated = await render(`/services/${service.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      serviceDetails: {
        envSpecificDetails: {
          buildCommand: before.buildCommand,
          startCommand: before.startCommand,
          preDeployCommand: target,
        },
      },
    }),
  });

  const after = describe(updated.serviceDetails);
  const unchanged =
    after.buildCommand === before.buildCommand && after.startCommand === before.startCommand;
  if (!unchanged || after.preDeployCommand !== target) {
    console.error('Verification failed. Service state after PATCH:');
    console.error(JSON.stringify(after, null, 2));
    process.exit(1);
  }
  console.log('Applied and verified. buildCommand/startCommand unchanged.');
  console.log('Takes effect on the next deploy (no redeploy triggered by this change).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
