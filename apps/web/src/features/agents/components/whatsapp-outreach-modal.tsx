import {
  AlertTriangle,
  Check,
  Copy,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { WhatsappSequenceStage } from '@/features/agents/api';
import { useWhatsappRecordOutreach, useWhatsappVariants } from '@/features/agents/hooks';
import { toWhatsAppDigits } from '@/features/leads/components/lead-contact-channels';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface WhatsAppOutreachModalLead {
  id: string;
  companyName: string;
  phone?: string | null;
  whatsapp?: string | null;
  stageId?: string | null;
  doNotContact?: boolean;
}

export interface WhatsAppOutreachModalProps {
  lead: WhatsAppOutreachModalLead | null;
  stages?: { id: string; name: string }[];
  isOpen: boolean;
  onClose: () => void;
  initialStage?: WhatsappSequenceStage;
}

const SEQUENCE_STAGES: { id: WhatsappSequenceStage; labelKey: string }[] = [
  { id: 'FIRST_MESSAGE', labelKey: 'agents.whatsapp.stages.FIRST_MESSAGE' },
  { id: 'FOLLOW_UP_1', labelKey: 'agents.whatsapp.stages.FOLLOW_UP_1' },
  { id: 'FOLLOW_UP_2', labelKey: 'agents.whatsapp.stages.FOLLOW_UP_2' },
  { id: 'BREAKUP', labelKey: 'agents.whatsapp.stages.BREAKUP' },
];

export function WhatsAppOutreachModal({
  lead,
  stages = [],
  isOpen,
  onClose,
  initialStage = 'FIRST_MESSAGE',
}: WhatsAppOutreachModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [sequenceStage, setSequenceStage] = useState<WhatsappSequenceStage>(initialStage);
  const [generation, setGeneration] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewTouched, setPreviewTouched] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // CRM confirmation fields
  const [recordActivity, setRecordActivity] = useState(true);
  const [advancePipeline, setAdvancePipeline] = useState(false);
  const [newStageId, setNewStageId] = useState<string>('');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [recordSuccess, setRecordSuccess] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const variants = useWhatsappVariants(
    lead?.id,
    4,
    generation,
    sequenceStage,
  );
  const recordOutreach = useWhatsappRecordOutreach();

  // Reset when modal opens for a different lead
  useEffect(() => {
    if (isOpen && lead) {
      setSequenceStage(initialStage);
      setGeneration(0);
      setSelectedVariantId('');
      setPreviewBody('');
      setPreviewTouched(false);
      setCopyOk(false);
      setShowConfirmation(false);
      setRecordSuccess(null);
      setRecordError(null);
      setRecordActivity(true);

      // Try finding next stage or stage named 'Contatado' / 'Contacted'
      if (stages.length > 0) {
        const currentIndex = stages.findIndex((s) => s.id === lead.stageId);
        const nextStage =
          currentIndex >= 0 && currentIndex + 1 < stages.length
            ? stages[currentIndex + 1]
            : stages.find((s) => /contatad|contacted/i.test(s.name)) ??
              stages.find((s) => s.id !== lead.stageId);
        if (nextStage) {
          setNewStageId(nextStage.id);
          setAdvancePipeline(true);
        } else {
          setNewStageId('');
          setAdvancePipeline(false);
        }
      }
      setScheduleFollowUp(sequenceStage === 'FIRST_MESSAGE' || sequenceStage === 'FOLLOW_UP_1');
    }
  }, [isOpen, lead?.id, initialStage]);

  // Adjust follow-up default when sequence stage changes
  useEffect(() => {
    setScheduleFollowUp(sequenceStage === 'FIRST_MESSAGE' || sequenceStage === 'FOLLOW_UP_1');
  }, [sequenceStage]);

  // Handle variants load
  useEffect(() => {
    const items = variants.data?.variants ?? [];
    if (!items.length) return;
    const current = items.find((item) => item.id === selectedVariantId) ?? items[0];
    if (!current) return;
    if (selectedVariantId !== current.id) {
      setSelectedVariantId(current.id);
      setPreviewTouched(false);
      setPreviewBody(current.body);
      return;
    }
    if (!previewTouched) {
      setPreviewBody(current.body);
    }
  }, [variants.data?.variants, selectedVariantId, previewTouched]);

  const rawPhone = lead?.whatsapp?.trim() || lead?.phone?.trim() || '';
  const digits = variants.data?.digits ?? toWhatsAppDigits(rawPhone);

  const waLink = useMemo(() => {
    if (!digits || !previewBody) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(previewBody)}`;
  }, [digits, previewBody]);

  async function handleCopy() {
    if (!previewBody) return;
    try {
      await navigator.clipboard.writeText(previewBody);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleOpenWhatsApp() {
    if (!waLink) return;
    window.open(waLink, '_blank', 'noopener,noreferrer');
    setShowConfirmation(true);
  }

  async function handleConfirmRecord() {
    if (!lead?.id) return;
    setRecordError(null);
    setRecordSuccess(null);
    try {
      await recordOutreach.mutateAsync({
        leadId: lead.id,
        messageBody: previewBody,
        variantId: selectedVariantId || undefined,
        sequenceStage,
        advanceStageId: advancePipeline && newStageId ? newStageId : undefined,
        scheduleFollowUpDays: scheduleFollowUp ? 2 : undefined,
      });

      // Invalidate relevant cache queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['lead', lead.id] }),
        queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
        queryClient.invalidateQueries({ queryKey: ['agents', 'crm'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);

      setRecordSuccess(t('agents.whatsapp.recordSuccess'));
      window.setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setRecordError(getApiErrorMessage(err) ?? t('agents.whatsapp.recordError'));
    }
  }

  if (!lead) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`${t('agents.whatsapp.compose')}: ${lead.companyName}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {lead.doNotContact ? (
          <div
            className="flex items-center gap-2 rounded-control border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t('agents.whatsapp.doNotContactWarn')}</span>
          </div>
        ) : null}

        {/* Sequence stage selector tabs */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[color:var(--ink-muted)]">
            {t('agents.whatsapp.stageLabel')}
          </label>
          <div className="flex flex-wrap gap-1 rounded-control bg-[color:var(--surface-subtle)] p-1">
            {SEQUENCE_STAGES.map((stg) => (
              <button
                key={stg.id}
                type="button"
                data-testid={`sequence-tab-${stg.id}`}
                className={cn(
                  'flex-1 rounded-control px-2.5 py-1.5 text-xs font-medium transition-all text-center',
                  sequenceStage === stg.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-card)] hover:text-[color:var(--ink)]',
                )}
                onClick={() => {
                  setSequenceStage(stg.id);
                  setPreviewTouched(false);
                  setSelectedVariantId('');
                  setGeneration(0);
                }}
              >
                {t(stg.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Variants / Source Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {variants.data?.source ? (
              <span
                className={cn(
                  'rounded-control border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                  variants.data.source === 'ollama'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-[color:var(--border)] bg-[color:var(--surface-card)] text-[color:var(--ink-muted)]',
                )}
                data-testid="whatsapp-modal-source-badge"
              >
                {variants.data.source === 'ollama'
                  ? t('agents.whatsapp.sourceOllama')
                  : t('agents.whatsapp.sourceFallback')}
              </span>
            ) : null}
            <span className="text-xs text-[color:var(--ink-muted)]">
              {digits ? `+${digits}` : t('agents.whatsapp.noPhone')}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            loading={variants.isFetching}
            onClick={() => {
              setPreviewTouched(false);
              setSelectedVariantId('');
              setGeneration((c) => c + 1);
            }}
            data-testid="whatsapp-modal-regenerate"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t('agents.whatsapp.generateAgain')}
          </Button>
        </div>

        {/* Variants List */}
        {variants.isLoading ? (
          <Skeleton className="h-28" />
        ) : variants.isError ? (
          <p className="text-xs text-red-300" role="alert">
            {getApiErrorMessage(variants.error) ?? t('agents.whatsapp.variantsError')}
          </p>
        ) : (variants.data?.variants.length ?? 0) > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto">
            {variants.data!.variants.map((item) => {
              const active = item.id === selectedVariantId;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`whatsapp-modal-variant-${item.angle}`}
                  className={cn(
                    'flex flex-col gap-1 rounded-control border p-2 text-left transition-colors',
                    active
                      ? 'border-brand-500/40 bg-brand-500/10'
                      : 'border-[color:var(--border)] bg-[color:var(--surface-subtle)] hover:border-[color:var(--border-strong)]',
                  )}
                  onClick={() => {
                    setSelectedVariantId(item.id);
                    setPreviewBody(item.body);
                    setPreviewTouched(false);
                    setCopyOk(false);
                  }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-muted)]">
                    {t(`agents.whatsapp.angles.${item.angle}`, { defaultValue: item.label })}
                  </span>
                  <span className="line-clamp-2 text-xs text-[color:var(--ink)]">{item.body}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Message Editor */}
        <Textarea
          label={t('agents.whatsapp.preview')}
          value={previewBody}
          onChange={(event) => {
            setPreviewTouched(true);
            setPreviewBody(event.target.value);
          }}
          rows={5}
          data-testid="whatsapp-modal-preview"
        />

        <p className="text-[11px] text-[color:var(--ink-muted)]">
          {t('agents.whatsapp.assistedNote')}
        </p>

        {copyOk ? (
          <p className="text-xs text-emerald-300" role="status">
            {t('agents.whatsapp.copied')}
          </p>
        ) : null}

        {/* Main Actions: Copy & Open */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[color:var(--border)]">
          <Button
            size="sm"
            variant="secondary"
            disabled={!previewBody}
            onClick={() => void handleCopy()}
            data-testid="whatsapp-modal-copy"
          >
            <Copy className="h-4 w-4" aria-hidden />
            {t('agents.whatsapp.copy')}
          </Button>

          {waLink && !lead.doNotContact ? (
            <Button
              size="sm"
              onClick={handleOpenWhatsApp}
              data-testid="whatsapp-modal-open"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('agents.whatsapp.open')}
            </Button>
          ) : (
            <Button size="sm" disabled>
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('agents.whatsapp.open')}
            </Button>
          )}

          {!showConfirmation ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowConfirmation(true)}
              className="text-xs text-[color:var(--ink-muted)]"
            >
              {t('agents.whatsapp.confirmRecordTitle')}
            </Button>
          ) : null}
        </div>

        {/* Closed-loop CRM Outreach Confirmation Box */}
        {showConfirmation ? (
          <div className="rounded-panel border border-brand-500/30 bg-brand-500/5 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                {t('agents.whatsapp.confirmRecordTitle')}
              </h4>
              <span className="text-[11px] text-[color:var(--ink-muted)]">
                {t('agents.whatsapp.openedExternal')}
              </span>
            </div>

            <div className="space-y-2 text-xs text-[color:var(--ink)]">
              {/* Option 1: Record activity */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordActivity}
                  onChange={(e) => setRecordActivity(e.target.checked)}
                  className="rounded border-[color:var(--border)] text-brand-600 focus:ring-brand-500"
                />
                <span>{t('agents.whatsapp.recordActivity')}</span>
              </label>

              {/* Option 2: Advance pipeline stage */}
              {stages.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advancePipeline}
                      onChange={(e) => setAdvancePipeline(e.target.checked)}
                      className="rounded border-[color:var(--border)] text-brand-600 focus:ring-brand-500"
                    />
                    <span>{t('agents.whatsapp.advanceStage')}</span>
                  </label>
                  {advancePipeline ? (
                    <select
                      value={newStageId}
                      onChange={(e) => setNewStageId(e.target.value)}
                      className="h-7 rounded border border-[color:var(--border)] bg-[color:var(--surface-card)] px-2 text-xs text-[color:var(--ink)]"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ) : null}

              {/* Option 3: Schedule follow-up in 48h */}
              <div className="pl-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleFollowUp}
                    onChange={(e) => setScheduleFollowUp(e.target.checked)}
                    className="rounded border-[color:var(--border)] text-brand-600 focus:ring-brand-500"
                  />
                  <span>{t('agents.whatsapp.scheduleFollowUp')}</span>
                </label>
              </div>
            </div>

            {recordError ? (
              <p className="text-xs text-red-300" role="alert">
                {recordError}
              </p>
            ) : null}

            {recordSuccess ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300" role="status">
                <Check className="h-4 w-4" aria-hidden />
                <span>{recordSuccess}</span>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowConfirmation(false)}
              >
                {t('common.cancel', { defaultValue: 'Cancelar' })}
              </Button>
              <Button
                size="sm"
                loading={recordOutreach.isPending}
                disabled={!recordActivity}
                onClick={() => void handleConfirmRecord()}
                data-testid="confirm-outreach-crm-button"
              >
                {t('agents.whatsapp.confirmAndSave')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
