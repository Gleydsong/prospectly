import { api } from '@/lib/api';
import { EMPTY_SDR_WORKSPACE, type SdrWorkspaceView } from '@/features/sdr/types';

function isWorkspace(value: unknown): value is SdrWorkspaceView {
  if (!value || typeof value !== 'object') return false;
  return 'campaign' in value && 'autonomy' in value && 'prospects' in value;
}

export async function fetchSdrRuntime(): Promise<SdrWorkspaceView> {
  try {
    const { data } = await api.get<unknown>('/sdr/runtime');
    return isWorkspace(data) ? data : EMPTY_SDR_WORKSPACE;
  } catch {
    return EMPTY_SDR_WORKSPACE;
  }
}

export async function runSdrRuntime(): Promise<SdrWorkspaceView> {
  const { data } = await api.post<SdrWorkspaceView>('/sdr/runtime/run', undefined, {
    timeout: 90_000,
  });
  return data;
}
