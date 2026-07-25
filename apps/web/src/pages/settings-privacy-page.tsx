import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';

export function SettingsPrivacyPage() {
  const { t, i18n } = useTranslation();
  const privacyUrl = i18n.language.startsWith('en')
    ? `${LANDING_URL}/en/privacy`
    : `${LANDING_URL}/privacy`;

  const rights = [
    t('settings.privacyPage.rightAccess'),
    t('settings.privacyPage.rightCorrection'),
    t('settings.privacyPage.rightDeletion'),
    t('settings.privacyPage.rightPortability'),
    t('settings.privacyPage.rightObjection'),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          to="/settings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {t('settings.privacyPage.title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t('settings.privacyPage.subtitle')}</p>
      </div>

      <Card>
        <CardHeader
          title={t('settings.privacyPage.rightsTitle')}
          description={t('settings.privacyPage.rightsDesc')}
        />
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300">
            {rights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={t('settings.privacyPage.controllerTitle')}
          description={t('settings.privacyPage.controllerDesc')}
        />
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <p>{t('settings.privacyPage.contact')}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.open(privacyUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4" />
            {t('settings.privacyPage.fullPolicy')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
