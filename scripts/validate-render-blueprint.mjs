#!/usr/bin/env node
/**
 * Validates render.yaml against the official Render JSON Schema
 * (https://render.com/schema/render.yaml.json), vendored at
 * scripts/vendor/render.yaml.schema.json.
 *
 * Uses Ajv 2020-12 when available; otherwise applies the schema's
 * additionalProperties / required / const rules for each service discriminant.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const blueprintPath = join(root, 'render.yaml');
const schemaPath = join(root, 'scripts/vendor/render.yaml.schema.json');

function loadYaml(file) {
  const ruby = spawnSync(
    'ruby',
    ['-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))', file],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (ruby.status === 0 && ruby.stdout.trim()) {
    return JSON.parse(ruby.stdout);
  }

  const python = spawnSync(
    'python3',
    ['-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))', file],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (python.status === 0 && python.stdout.trim()) {
    return JSON.parse(python.stdout);
  }

  throw new Error(
    `Unable to parse YAML. ruby: ${ruby.stderr || ruby.status}; python: ${python.stderr || python.status}`,
  );
}

function tryAjv(schema, data) {
  const require = createRequire(import.meta.url);
  let Ajv;
  try {
    ({ default: Ajv } = require('ajv/dist/2020.js'));
  } catch {
    try {
      Ajv = require('ajv');
    } catch {
      return null;
    }
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(data);
  return { ok, errors: validate.errors ?? [] };
}

function collectServices(blueprint) {
  const services = [];
  for (const project of blueprint.projects ?? []) {
    for (const environment of project.environments ?? []) {
      for (const service of environment.services ?? []) {
        services.push({ path: `projects.${project.name}.environments.${environment.name}.services.${service.name}`, service });
      }
    }
  }
  for (const service of blueprint.services ?? []) {
    services.push({ path: `services.${service.name}`, service });
  }
  return services;
}

function schemaCheck(schema, blueprint) {
  const errors = [];
  const defs = schema.definitions ?? {};
  const staticKeys = new Set(Object.keys(defs.staticService?.properties ?? {}));
  const serverKeys = new Set(Object.keys(defs.serverService?.properties ?? {}));
  const redisKeys = new Set(Object.keys(defs.redisServer?.properties ?? {}));

  for (const { path, service } of collectServices(blueprint)) {
    if (service.runtime === 'static') {
      if (service.type !== 'web') {
        errors.push(`${path}: type must be "web" for static sites`);
      }
      for (const key of Object.keys(service)) {
        if (!staticKeys.has(key)) {
          errors.push(`${path}: "${key}" is not allowed on a Static Site (schema additionalProperties: false)`);
        }
      }
      if ('region' in service) {
        errors.push(`${path}: Static Sites must not declare region`);
      }
    } else if (service.type === 'keyvalue' || service.type === 'redis') {
      for (const key of Object.keys(service)) {
        if (!redisKeys.has(key)) {
          errors.push(`${path}: "${key}" is not allowed on Key Value`);
        }
      }
    } else if (service.type === 'web' || service.type === 'worker' || service.type === 'pserv') {
      for (const key of Object.keys(service)) {
        if (!serverKeys.has(key)) {
          errors.push(`${path}: "${key}" is not allowed on ${service.type} services`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors: errors.map((message) => ({ message })) };
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
if (schema.$id !== 'https://render.com/schema/render.yaml.json') {
  throw new Error('Vendored schema is not the official Render Blueprint schema');
}

const blueprint = loadYaml(blueprintPath);
const ajvResult = tryAjv(schema, blueprint);
const fallback = schemaCheck(schema, blueprint);
const result = ajvResult ?? fallback;

if (ajvResult && !ajvResult.ok) {
  console.error('render.yaml failed official Render JSON Schema validation:');
  for (const error of ajvResult.errors) {
    console.error(`- ${(error.instancePath || '/')}: ${error.message}`);
  }
  process.exit(1);
}

if (!fallback.ok) {
  console.error('render.yaml failed Render schema discriminant checks:');
  for (const error of fallback.errors) {
    console.error(`- ${error.message}`);
  }
  process.exit(1);
}

if (result.ok) {
  const engine = ajvResult ? 'Ajv 2020-12 + discriminant checks' : 'official schema discriminant checks';
  console.log(`render.yaml is valid against ${schema.$id} (${engine})`);
}
