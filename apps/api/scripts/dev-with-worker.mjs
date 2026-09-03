#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nestBin = [
  resolve(apiRoot, 'node_modules/.bin/nest'),
  resolve(apiRoot, '../../node_modules/.bin/nest'),
].find((candidate) => existsSync(candidate));

if (!nestBin) {
  console.error('[dev] Nest CLI não encontrado. Rode pnpm install.');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function start(name, extraArgs) {
  const child = spawn(nestBin, ['start', '--watch', ...extraArgs], {
    cwd: apiRoot,
    env: { ...process.env, ROLE: name === 'worker' ? 'worker' : 'api' },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const reason = signal ?? code ?? 1;
    console.error(`[dev] ${name} saiu (${reason}). Encerrando o outro processo.`);
    stopAll(signal ? 1 : (code ?? 1));
  });

  children.push(child);
}

function stopAll(exitCode) {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 3_000).unref();
}

function onSignal(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill(signal);
  }
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on('SIGINT', () => onSignal('SIGINT'));
process.on('SIGTERM', () => onSignal('SIGTERM'));

console.log('[dev] Iniciando API HTTP + worker BullMQ');
start('api', []);
start('worker', ['--entryFile', 'worker']);
