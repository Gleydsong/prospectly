import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'App.tsx'), 'utf8');

const CRM_CORE_PAGES = [
  { exportName: 'SearchPage', specifier: '@/pages/search-page' },
  { exportName: 'LeadsPage', specifier: '@/pages/leads/leads-page' },
  { exportName: 'PipelinePage', specifier: '@/pages/pipeline-page' },
  { exportName: 'CampaignsPage', specifier: '@/pages/campaigns-page' },
] as const;

describe('CRM core routes', () => {
  it.each(CRM_CORE_PAGES)(
    'lazy-loads $exportName so login does not download the page',
    ({ exportName, specifier }) => {
      expect(appSource).not.toMatch(new RegExp(`import \\{ ${exportName} \\} from '${specifier}'`));
      expect(appSource).toContain(`import('${specifier}')`);
      expect(appSource).toMatch(new RegExp(`<LazyPage>\\s*<${exportName}`));
    },
  );
});
