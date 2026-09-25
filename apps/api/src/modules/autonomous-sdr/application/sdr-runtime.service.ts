import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { OllamaChatClient } from '../../agents/whatsapp-ai/ollama-chat.client';
import { EMPTY_SDR_RUNTIME, type SdrRuntimeView } from './sdr-runtime.scenario';

type QueueLead = {
  id: string;
  companyName: string;
  tradeName: string | null;
  category: string | null;
  segment: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  score: number;
  websitePresence: 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';
  rating: number | null;
};

@Injectable()
export class SdrRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaChatClient,
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
    const seen = current.seenLeadIds ?? [];
    const lead = await this.nextLead(organizationId, seen);
    if (!lead) {
      return { ...EMPTY_SDR_RUNTIME, seenLeadIds: seen };
    }

    const name = lead.tradeName?.trim() || lead.companyName;
    const industry = lead.category ?? lead.segment ?? undefined;
    const qualification = qualify(lead.score);
    const body = await this.draft(lead);
    const view: SdrRuntimeView = {
      campaign: { name: 'Fila de leads', status: 'ACTIVE', channel: 'EMAIL' },
      autonomy: {
        autonomousSending: false,
        autonomousFollowup: false,
        autonomousReply: false,
      },
      prospects: [
        {
          id: lead.id,
          name,
          score: lead.score,
          state: qualification,
          geography: lead.city ?? undefined,
          industry,
        },
      ],
      signals: signalsFor(lead),
      evidence: evidenceFor(lead),
      decision: { qualification, traceId: lead.id },
      brief: industry
        ? { angle: 'website_problem', summary: `${name}${lead.city ? ` · ${lead.city}` : ''}` }
        : null,
      message: { status: 'BLOCK', body },
      review: [{ prospectId: lead.id, reason: 'feature_flag' }],
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
        website: true,
        phone: true,
        email: true,
        whatsapp: true,
        score: true,
        websitePresence: true,
        rating: true,
      },
    });
  }

  private async draft(lead: QueueLead): Promise<string> {
    const generated = await this.ollama.generateVariants(
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
    );
    const fromModel = generated?.[0]?.body?.trim();
    if (fromModel) return fromModel;
    const place = lead.city ? ` em ${lead.city}` : '';
    return `Olá. Vi ${lead.tradeName?.trim() || lead.companyName}${place} e queria entender se faz sentido conversar. Posso enviar uma mensagem curta?`;
  }
}

function qualify(score: number): 'QUALIFIED' | 'REVIEW' | 'REJECTED' {
  if (score >= 55) return 'QUALIFIED';
  if (score < 35) return 'REJECTED';
  return 'REVIEW';
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
  return view.decision?.traceId === 'trace-local' || view.prospects.some((item) => item.id === 'prospect-1');
}
