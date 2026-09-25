import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { fetchSdrRuntime, runSdrRuntime } from '@/features/sdr/api';
import { SdrWorkspace } from '@/features/sdr/sdr-workspace';
import { EMPTY_SDR_WORKSPACE } from '@/features/sdr/types';
import { Button } from '@/components/ui/button';

export function SdrPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['sdr-runtime'], queryFn: fetchSdrRuntime });
  const run = useMutation({
    mutationFn: runSdrRuntime,
    onSuccess: (view) => {
      queryClient.setQueryData(['sdr-runtime'], view);
    },
  });
  const view = query.data ?? EMPTY_SDR_WORKSPACE;

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
        {t('nav.sdrRun')}
      </Button>
      <SdrWorkspace key={view.decision?.traceId ?? 'empty'} initial={view} />
    </div>
  );
}
