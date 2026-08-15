#!/usr/bin/env node
/**
 * Rejects development hosts baked into the deploy bundle.
 * Does not print file contents. Vendor sentinels such as React Router's
 * `http://localhost` origin fallback and Sentry's sidecar default are ignored.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BLOCKED_BUNDLE_NEEDLES = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://localhost',
  'http://127.0.0.1',
  'https://127.0.0.1',
  'example.invalid',
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

export function findBlockedNeedles(distDir, needles = BLOCKED_BUNDLE_NEEDLES) {
  const hits = [];
  for (const file of walk(distDir)) {
    if (!/\.(js|css|html|map)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (text.includes(needle)) {
        hits.push({ file: relative(distDir, file), needle });
      }
    }
  }
  return hits;
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
  const distDir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../dist');
  const hits = findBlockedNeedles(distDir);
  if (hits.length > 0) {
    console.error('Deploy bundle contains blocked development hosts:');
    for (const hit of hits) {
      console.error(`- ${hit.needle} in ${hit.file}`);
    }
    process.exit(1);
  }
}
