import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useAddCampaignLeads, useCampaigns } from '@/features/campaigns/hooks';
import { useImportSearchResults } from '@/features/prospecting/hooks';
import { getApiErrorMessage } from '@/lib/api';
import type { ProspectingSearchResult } from '@/types';

const CAMPAIGNS_PAGE_SIZE = 20;

export function SearchResultsListAction({
  searchId,
  results,
  disabled = false,
}: {
  searchId: string;
  results: ProspectingSearchResult[];
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [knownLeadIds, setKnownLeadIds] = useState<Record<string, string>>({});

  useEffect(() => {
    setKnownLeadIds({});
  }, [searchId]);

  useEffect(() => {
    setKnownLeadIds((current) => {
      const next = { ...current };
      for (const result of results) {
        if (result.importedLeadId) next[result.id] = result.importedLeadId;
      }
      return next;
    });
  }, [results]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || results.length === 0}
        onClick={() => setOpen(true)}
      >
        {t('prospectResults.addToList', { defaultValue: 'Adicionar a uma Lista' })}
      </Button>
      {open ? (
        <SearchResultsListDialog
          searchId={searchId}
          results={results}
          knownLeadIds={knownLeadIds}
          onKnownLeadIdsChange={setKnownLeadIds}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SearchResultsListDialog({
  searchId,
  results,
  knownLeadIds,
  onKnownLeadIdsChange,
  onClose,
}: {
  searchId: string;
  results: ProspectingSearchResult[];
  knownLeadIds: Record<string, string>;
  onKnownLeadIdsChange: (ids: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const campaignsQuery = useCampaigns({ page, pageSize: CAMPAIGNS_PAGE_SIZE });
  const importResults = useImportSearchResults();
  const addLeads = useAddCampaignLeads(campaignId);
  const campaigns = campaignsQuery.data?.data ?? [];
  const totalPages = campaignsQuery.data?.meta.totalPages ?? 1;
  const busy = importResults.isPending || addLeads.isPending;

  const submit = async () => {
    if (!campaignId || results.length === 0) return;
    setError(null);
    setComplete(false);

    const resolved = { ...knownLeadIds };
    for (const result of results) {
      if (result.importedLeadId) resolved[result.id] = result.importedLeadId;
    }
    const unresolved = results.filter((result) => !resolved[result.id]);

    if (unresolved.length > 0) {
      try {
        const summary = await importResults.mutateAsync({
          searchId,
          resultIds: unresolved.map((result) => result.id),
        });
        for (const item of summary.items ?? []) {
          if (item.leadId && item.status !== 'INVALID') resolved[item.resultId] = item.leadId;
        }
        onKnownLeadIdsChange(resolved);
      } catch (cause) {
        onKnownLeadIdsChange(resolved);
        setError(getApiErrorMessage(cause));
        return;
      }
    }

    const leadIds = [
      ...new Set(
        results.flatMap((result) => {
          const leadId = resolved[result.id];
          return leadId ? [leadId] : [];
        }),
      ),
    ];

    const missingCount = results.filter((result) => !resolved[result.id]).length;
    if (missingCount > 0) {
      onKnownLeadIdsChange(resolved);
      setError(
        t('prospectResults.listUnresolved', {
          count: missingCount,
          defaultValue: `${missingCount} resultado(s) não foram importados para clientes. Tente novamente.`,
        }),
      );
      return;
    }

    if (leadIds.length > 0) {
      try {
        await addLeads.mutateAsync({ leadIds });
      } catch (cause) {
        onKnownLeadIdsChange(resolved);
        setError(getApiErrorMessage(cause));
        return;
      }
    }

    onKnownLeadIdsChange(resolved);
    setComplete(true);
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t('prospectResults.addToListTitle', {
        defaultValue: 'Adicionar clientes a uma Lista',
      })}
    >
      <div className="space-y-4">
        <p className="text-sm text-[color:var(--ink-secondary)]">
          {t('prospectResults.selectedCount', {
            count: results.length,
            defaultValue: `${results.length} resultado(s) selecionado(s)`,
          })}
        </p>
        {campaignsQuery.isLoading ? (
          <p role="status">{t('common.loading', { defaultValue: 'Carregando…' })}</p>
        ) : campaignsQuery.isError ? (
          <p className="text-sm text-[color:var(--status-danger-ink)]" role="alert">
            {getApiErrorMessage(campaignsQuery.error)}
          </p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-secondary)]">
            {t('prospectResults.noLists', { defaultValue: 'Nenhuma Lista disponível.' })}
          </p>
        ) : (
          <>
            <Select
              id="search-results-campaign"
              label={t('prospectResults.chooseList', { defaultValue: 'Lista' })}
              value={campaignId}
              disabled={busy}
              onChange={(event) => {
                setCampaignId(event.target.value);
                setComplete(false);
              }}
            >
              <option value="">
                {t('prospectResults.chooseListPlaceholder', {
                  defaultValue: 'Selecione uma Lista',
                })}
              </option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between text-sm">
                <span>
                  {t('common.pageOf', {
                    page,
                    total: totalPages,
                    defaultValue: `Página ${page} de ${totalPages}`,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || busy}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    {t('common.previous', { defaultValue: 'Anterior' })}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || busy}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {t('common.next', { defaultValue: 'Próxima' })}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-[color:var(--status-danger-ink)]">
            {error}
          </p>
        ) : null}
        {complete ? (
          <p role="status" className="text-sm text-[color:var(--status-success-ink)]">
            {t('prospectResults.addedToList', { defaultValue: 'Clientes adicionados à Lista.' })}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={complete || !campaignId || results.length === 0 || campaignsQuery.isError}
            onClick={() => void submit()}
          >
            {t('prospectResults.addSelectedToList', { defaultValue: 'Adicionar selecionados' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
