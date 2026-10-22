const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// A configuração precisa carregar como conf.d/default.conf: `location` só é válido dentro de `server`.
const CONF_PATH = path.join(__dirname, '..', 'deploy', 'nginx', 'assistant-sse.conf');
const config = fs
  .readFileSync(CONF_PATH, 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

test('assistant-sse.conf keeps location inside a server block', () => {
  const serverIndex = config.search(/^server \{/m);
  const locationIndex = config.search(/^\s+location \/api\/v1\/assistant\/ \{/m);
  assert.notEqual(serverIndex, -1, 'bloco server ausente');
  assert.notEqual(locationIndex, -1, 'location do assistente ausente');
  assert.ok(locationIndex > serverIndex, 'location deve estar dentro do bloco server');
});

test('assistant-sse.conf disables proxy buffering for the assistant location', () => {
  const locationStart = config.indexOf('location /api/v1/assistant/ {');
  const locationBody = config.slice(locationStart, config.indexOf('\n    }', locationStart));
  assert.match(locationBody, /proxy_buffering off;/);
  assert.match(locationBody, /proxy_cache off;/);
});

test('assistant-sse.conf has balanced braces', () => {
  const opens = (config.match(/\{/g) ?? []).length;
  const closes = (config.match(/\}/g) ?? []).length;
  assert.equal(opens, closes);
});
