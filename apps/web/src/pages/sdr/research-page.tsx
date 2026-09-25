import { useTranslation } from 'react-i18next';

export type ResearchScreenBrief =
  | { status: 'BLOCKED' }
  | {
      status: 'READY';
      angle: string;
      observations: Array<{ statement: string; evidenceIds: string[] }>;
      hooks: string[];
    };

export function ResearchScreen({ brief }: { brief: ResearchScreenBrief }) {
  const { t } = useTranslation();
  if (brief.status === 'BLOCKED') {
    return (
      <main>
        <h1>{t('nav.sdr')}</h1>
        <p>{t('nav.sdrBlocked')}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{t('nav.sdr')}</h1>
      <p>
        {t('nav.sdrAngle')}: {brief.angle}
      </p>
      <h2>{t('nav.sdrObservations')}</h2>
      <ul>
        {brief.observations.map((item) => (
          <li key={`${item.statement}-${item.evidenceIds.join(',')}`}>
            {item.statement} ({item.evidenceIds.join(', ')})
          </li>
        ))}
      </ul>
      <h2>{t('nav.sdrHooks')}</h2>
      <ul>
        {brief.hooks.map((hook) => (
          <li key={hook}>{hook}</li>
        ))}
      </ul>
    </main>
  );
}

export function ResearchPage() {
  return <ResearchScreen brief={{ status: 'BLOCKED' }} />;
}
