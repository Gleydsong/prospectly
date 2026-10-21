import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { fetchSdrRuntime, runSdrRuntime } from '@/features/sdr/api';
import { SdrWorkspace } from '@/features/sdr/sdr-workspace';
import { EMPTY_SDR_WORKSPACE } from '@/features/sdr/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';

export function SdrPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['sdr-runtime'], queryFn: fetchSdrRuntime });
  const run = useMutation({
    mutationFn: runSdrRuntime,
    onSuccess: (view) => {
      setErrorMessage(null);
      queryClient.setQueryData(['sdr-runtime'], view);
    },
    onError: (err) => {
      const apiMessage = getApiErrorMessage(err);
      setErrorMessage(
        apiMessage && /client/i.test(apiMessage)
          ? apiMessage
          : t('sdrUi.runError'),
      );
    },
  });
  const view = query.data ?? EMPTY_SDR_WORKSPACE;

  return (
    <div className="space-y-4">
      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setErrorMessage(null);
          run.mutate();
        }}
        disabled={run.isPending}
      >
        {t('nav.sdrRun')}
      </Button>
      <SdrWorkspace key={view.decision?.traceId ?? 'empty'} initial={view} />
    </div>
  );
}
