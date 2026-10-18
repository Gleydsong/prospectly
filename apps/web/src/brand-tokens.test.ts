import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(sourceRoot, path), 'utf8');

function appSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return appSources(path);
    return /\.(?:css|tsx?|jsx?|html|svg|json)$/.test(entry.name) &&
      !/\.(?:test|spec)\.[tj]sx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe('approved brand identity', () => {
  it('uses cobalt in both themes without the former lilac brand palette', () => {
    const css = read('./index.css');
    const config = read('../tailwind.config.js');
    expect(css.match(/--brand: #2563eb;/g)).toHaveLength(2);
    expect(css).toContain('--accent: #93bfff;');
    for (const legacy of ['676fd6', '7b83e0', '5b63c9', '8a91e6', '103 111 214', '123 131 224']) {
      expect(css.toLowerCase()).not.toContain(legacy);
      expect(config.toLowerCase()).not.toContain(legacy);
      for (const path of [
        ...appSources(sourceRoot),
        ...appSources(resolve(sourceRoot, '../public')),
      ]) {
        expect(readFileSync(path, 'utf8').toLowerCase(), path).not.toContain(legacy);
      }
    }
    expect(config).toContain("card: '16px'");
    expect(config).toContain("sans: ['Outfit'");
    expect(css).toContain('@fontsource/outfit/latin-400.css');
    expect(css).toContain('@fontsource/jetbrains-mono/latin-400.css');
  });

  it('uses the intact official symbol in the app and favicon', () => {
    const source = readFileSync(
      resolve(sourceRoot, '../../landing/public/brand/prospectly-mark.png'),
    );
    expect(readFileSync(resolve(sourceRoot, './assets/prospectly-mark.png'))).toEqual(source);
    expect(readFileSync(resolve(sourceRoot, '../public/favicon.png'))).toEqual(source);
    expect(read('../index.html')).toContain('href="/favicon.png"');
  });
});
