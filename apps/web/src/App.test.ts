import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'pages/navigation-pages.tsx'),
  'utf8',
);

const CRM_CORE_PAGES = [
  { exportName: 'SearchPage', specifier: './search-page' },
  { exportName: 'LeadsPage', specifier: './leads/leads-page' },
  { exportName: 'PipelinePage', specifier: './pipeline-page' },
  { exportName: 'CampaignsPage', specifier: './campaigns-page' },
] as const;

describe('CRM core routes', () => {
  it.each(CRM_CORE_PAGES)(
    'lazy-loads $exportName so login does not download the page',
    ({ exportName, specifier }) => {
      expect(appSource).not.toMatch(new RegExp(`import \\{ ${exportName} \\} from '${specifier}'`));
      expect(appSource).toContain(`import('${specifier}')`);
      expect(appSource).toContain(`default: m.${exportName}`);
    },
  );
});
