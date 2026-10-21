import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { SuppressionService } from '../../privacy/suppression.service';
import { normalizeLeadDomain } from '../../leads/domain/lead-domain';
import { WhatsappAiService } from '../../agents/whatsapp-ai/whatsapp-ai.service';
import { judgeProspect, SdrDecisionLog, type ProspectJudgeFacts } from '../domain/sdr-decisions';
import { SdrLayaClient } from './sdr-laya.client';
import { EMPTY_SDR_RUNTIME, type SdrRuntimeView } from './sdr-runtime.scenario';

type QueueLead = {
  id: string;
  companyName: string;
  tradeName: string | null;
  category: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  score: number;
  websitePresence: 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';
  rating: number | null;
  reviewCount: number | null;
};

@Injectable()
export class SdrRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappAi: WhatsappAiService,
    private readonly laya: SdrLayaClient,
    private readonly suppression: SuppressionService,
  ) {}

  async get(organizationId: string): Promise<SdrRuntimeView> {
    const row = await this.prisma.sdrRuntime.findUnique({
      where: { organizationId },
      select: { view: true },
    });
    if (!isRuntimeView(row?.view) || isLocalFixture(row.view)) return EMPTY_SDR_RUNTIME;
    return row.view;
  }

  async run(organizationId: string): Promise<SdrRuntimeView> {
    const current = await this.get(organizationId);
    let seen = current.seenLeadIds ?? [];
    let lead: QueueLead | null = null;
    let searching = true;

    while (searching) {
      lead = await this.nextLead(organizationId, seen);
      if (!lead) {
        searching = false;
        break;
      }

      const suppressed = await this.suppression.isSuppressed(organizationId, {
        email: lead.email,
        phone: lead.phone ?? lead.whatsapp,
        domain: normalizeLeadDomain(lead.website),
      });

      if (suppressed) {
        seen = [...seen, lead.id];
        continue;
      }

      searching = false;
    }

    if (!lead) {
      const view: SdrRuntimeView = { ...EMPTY_SDR_RUNTIME, seenLeadIds: seen };
      if (seen.length !== (current.seenLeadIds?.length ?? 0)) {
        await this.prisma.sdrRuntime.upsert({
          where: { organizationId },
          create: { organizationId, view },
          update: { view },
        });
      }
      return view;
    }

    const name = lead.tradeName?.trim() || lead.companyName;
    const industry = lead.category ?? lead.segment ?? undefined;
    const facts: ProspectJudgeFacts = {
      name,
      companyName: lead.companyName,
      tradeName: lead.tradeName,
      category: lead.category,
      segment: lead.segment,
      city: lead.city,
      state: lead.state,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      hasPhone: Boolean(lead.phone),
      hasEmail: Boolean(lead.email),
      hasWhatsapp: Boolean(lead.whatsapp),
    };
    const decision = await judgeProspect({
      log: new SdrDecisionLog(),
      provider: this.laya,
      organizationId,
      campaignId: 'lead-queue',
      prospectId: lead.id,
      traceId: lead.id,
      recordedAt: new Date().toISOString(),
      untrustedText: lead.website ?? '',
      facts,
    });
    const worthIt = decision.qualification === 'QUALIFIED' && decision.opportunityScore != null;
    const body = worthIt ? await this.draft(lead, organizationId) : null;
    const view: SdrRuntimeView = {
      campaign: { name: 'Fila de clientes', status: 'ACTIVE', channel: 'EMAIL' },
      autonomy: {
        autonomousSending: false,
        autonomousFollowup: false,
        autonomousReply: false,
      },
      prospects: [
        {
          id: lead.id,
          name,
          score: decision.opportunityScore,
          state: decision.qualification,
          geography: lead.city ?? undefined,
          industry,
        },
      ],
      signals: {
        ...signalsFor(lead),
        opportunity: decision.opportunityScore,
      },
      evidence: evidenceFor(lead),
      decision: { qualification: decision.qualification, traceId: lead.id },
      brief: worthIt
        ? { angle: 'website_problem', summary: `${name}${lead.city ? ` · ${lead.city}` : ''}` }
        : null,
      message: { status: 'BLOCK', body },
      review: [
        {
          prospectId: lead.id,
          reason: worthIt ? 'feature_flag' : decision.failure ? 'laya_unavailable' : 'laya_rejected',
        },
      ],
      metrics: { blocked: 1 },
      seenLeadIds: [...seen, lead.id],
    };
    await this.prisma.sdrRuntime.upsert({
      where: { organizationId },
      create: { organizationId, view },
      update: { view },
    });
    return view;
  }

  async loadProspectFacts(
    organizationId: string,
    prospectId: string,
  ): Promise<ProspectJudgeFacts | null> {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: prospectId,
        organizationId,
        deletedAt: null,
      },
      select: {
        companyName: true,
        tradeName: true,
        category: true,
        segment: true,
        city: true,
        state: true,
        website: true,
        rating: true,
        reviewCount: true,
        phone: true,
        email: true,
        whatsapp: true,
      },
    });
    if (!lead) return null;
    return {
      name: lead.tradeName?.trim() || lead.companyName,
      companyName: lead.companyName,
      tradeName: lead.tradeName,
      category: lead.category,
      segment: lead.segment,
      city: lead.city,
      state: lead.state,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      hasPhone: Boolean(lead.phone),
      hasEmail: Boolean(lead.email),
      hasWhatsapp: Boolean(lead.whatsapp),
    };
  }

  private async nextLead(organizationId: string, seen: string[]): Promise<QueueLead | null> {
    return this.prisma.lead.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        doNotContact: false,
        ...(seen.length > 0 ? { id: { notIn: seen } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        companyName: true,
        tradeName: true,
        category: true,
        segment: true,
        city: true,
        state: true,
        website: true,
        phone: true,
        email: true,
        whatsapp: true,
        score: true,
        websitePresence: true,
        rating: true,
        reviewCount: true,
      },
    });
  }

  private async draft(lead: QueueLead, organizationId: string): Promise<string> {
    const generated = await this.whatsappAi.generateVariants(
      {
        companyName: lead.companyName,
        tradeName: lead.tradeName,
        city: lead.city,
        segment: lead.segment ?? lead.category,
        website: lead.website,
        senderName: null,
        sequenceStage: 'FIRST_MESSAGE',
        auditSignals: null,
      },
      1,
      0,
      organizationId,
    );
    const fromModel = generated?.[0]?.body?.trim();
    if (fromModel) return fromModel;
    const place = lead.city ? ` em ${lead.city}` : '';
    return `Olá. Vi ${lead.tradeName?.trim() || lead.companyName}${place} e queria entender se faz sentido conversar. Posso enviar uma mensagem curta?`;
  }
}

function signalsFor(lead: QueueLead): NonNullable<SdrRuntimeView['signals']> {
  const hasContact = Boolean(lead.phone || lead.email || lead.whatsapp);
  const needsSite = lead.websitePresence !== 'WEBSITE_FOUND';
  return {
    icp: clamp(lead.score),
    websiteNeed: needsSite ? 80 : 30,
    activity: lead.rating == null ? 50 : clamp(Math.round((lead.rating / 5) * 100)),
    contact: hasContact ? 100 : 20,
    opportunity: clamp(lead.score),
  };
}

function evidenceFor(lead: QueueLead): SdrRuntimeView['evidence'] {
  const rows: SdrRuntimeView['evidence'] = [];
  if (lead.websitePresence === 'NO_WEBSITE_REPORTED') {
    rows.push({ id: `${lead.id}:website`, field: 'website', value: 'absent' });
  } else if (lead.website) {
    rows.push({ id: `${lead.id}:website`, field: 'website', value: lead.website });
  }
  if (lead.phone || lead.whatsapp || lead.email) {
    rows.push({ id: `${lead.id}:contact`, field: 'contact', value: 'present' });
  }
  if (lead.category) {
    rows.push({ id: `${lead.id}:category`, field: 'category', value: lead.category });
  }
  return rows;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRuntimeView(value: Prisma.JsonValue | undefined): value is SdrRuntimeView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return 'campaign' in value && 'autonomy' in value && 'prospects' in value;
}

function isLocalFixture(view: SdrRuntimeView): boolean {
  return (
    view.decision?.traceId === 'trace-local' ||
    view.prospects.some((item) => item.id === 'prospect-1')
  );
}
