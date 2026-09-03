import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  EMAIL_PREVIEW_IDS,
  renderEmailPreview,
} from '../src/common/mail/preview/email-preview.fixtures';

const outDir = path.resolve(process.cwd(), 'tmp/email-preview');

mkdirSync(outDir, { recursive: true });

const indexItems = EMAIL_PREVIEW_IDS.map((id) => {
  const content = renderEmailPreview(id);
  const fileName = `${id}.html`;
  writeFileSync(path.join(outDir, fileName), content.html, 'utf8');
  writeFileSync(path.join(outDir, `${id}.txt`), content.text, 'utf8');
  return `<li><a href="${fileName}">${id}</a> — ${content.subject}</li>`;
});

writeFileSync(
  path.join(outDir, 'index.html'),
  `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Prospectly email preview</title>
  <style>
    body { font-family: sans-serif; padding: 32px; background: #f3fafc; color: #101828; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Prospectly — preview de e-mails</h1>
  <p>Somente desenvolvimento. Não publicar.</p>
  <ul>${indexItems.join('')}</ul>
</body>
</html>`,
  'utf8',
);

process.stdout.write(`Wrote email previews to ${outDir}\n`);
