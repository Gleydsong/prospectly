#!/usr/bin/env node
/**
 * Validates public Vite env vars required for a production Static Site build.
 * Prints only variable names and expected format — never the raw values.
 */

import { pathToFileURL } from 'node:url';

export const REQUIRED_DEPLOY_ENV = ['VITE_API_URL', 'VITE_LANDING_URL', 'VITE_GOOGLE_CLIENT_ID'];

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateDeployEnv(env = process.env) {
  const errors = [];

  const api = readTrimmed(env.VITE_API_URL);
  if (!api) {
    errors.push('VITE_API_URL is required. Expected an absolute HTTPS URL ending in /api/v1');
  } else {
    errors.push(...validateHttpsUrl('VITE_API_URL', api, { requireApiPath: true }));
  }

  const landing = readTrimmed(env.VITE_LANDING_URL);
  if (!landing) {
    errors.push(
      'VITE_LANDING_URL is required. Expected an absolute HTTPS origin without an API path',
    );
  } else {
    errors.push(...validateHttpsUrl('VITE_LANDING_URL', landing, { forbidApiPath: true }));
  }

  const googleClientId = readTrimmed(env.VITE_GOOGLE_CLIENT_ID);
  if (!googleClientId) {
    errors.push(
      'VITE_GOOGLE_CLIENT_ID is required. Expected a non-empty Google OAuth Web Client ID',
    );
  }

  const sentryDsn = readTrimmed(env.VITE_SENTRY_DSN);
  if (sentryDsn) {
    errors.push(...validateHttpsUrl('VITE_SENTRY_DSN', sentryDsn, { allowUserInfo: true }));
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function readTrimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{ requireApiPath?: boolean, forbidApiPath?: boolean, allowUserInfo?: boolean }} [options]
 * @returns {string[]}
 */
export function validateHttpsUrl(name, value, options = {}) {
  const errors = [];
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${name} must be an absolute URL. Expected https://host/...`);
    return errors;
  }

  if (parsed.protocol !== 'https:') {
    errors.push(`${name} must use HTTPS. Expected https://...`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    errors.push(`${name} must not use localhost or loopback. Expected a public HTTPS host`);
  }

  if (hostname.endsWith('.invalid')) {
    errors.push(`${name} must not use a .invalid domain. Expected a real HTTPS host`);
  }

  if (!options.allowUserInfo && (parsed.username || parsed.password)) {
    errors.push(`${name} must not include userinfo. Expected https://host/...`);
  }

  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  if (options.requireApiPath && path !== '/api/v1') {
    errors.push(`${name} must end with /api/v1. Expected https://host/api/v1`);
  }
  if (options.forbidApiPath && (path === '/api/v1' || path.startsWith('/api/'))) {
    errors.push(`${name} must be a site origin, not an API path. Expected https://host`);
  }

  return errors;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  const result = validateDeployEnv(process.env);
  if (!result.ok) {
    console.error('Deploy environment validation failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}
