import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LeadStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  renderTemplate,
  type TemplateVariableValues,
} from '../campaigns/domain/template-variables';
import { TemplatesService } from '../campaigns/application/templates.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { buildDeterministicWhatsappVariants } from './whatsapp-ai/deterministic-variants';
import { OllamaChatClient } from './whatsapp-ai/ollama-chat.client';
import {
  clampVariantCount,
  normalizeSeed,
  type WhatsappVariantSource,
} from './whatsapp-ai/whatsapp-ai.types';

export type AgentCatalogItem = {
  id: 'crm-next-action' | 'whatsapp-first-message';
  name: string;
  description: string;
  path: string;
};

export type CrmActionCode =
  | 'RESPECT_DNC'
  | 'ENRICH_CONTACT'
  | 'FOLLOW_UP_OVERDUE'
  | 'PRIORITIZE_OUTREACH'
  | 'ADVANCE_PIPELINE'
  | 'RUN_WEBSITE_ANALYSIS'
  | 'ENRICH_PROFILE'
  | 'NURTURE';

const EARLY_STATUS: ReadonlySet<LeadStatus> = new Set([
  'NEW',
  'TO_REVIEW',
  'QUALIFIED',
]);

const AGENT_CATALOG: AgentCatalogItem[] = [
  {
    id: 'crm-next-action',
    name: 'Agent CRM',
    description: 'Sugere a próxima ação e o estágio do pipeline para um lead.',
    path: '/agents/crm',
  },
  {
    id: 'whatsapp-first-message',
    name: 'Agent WhatsApp',
    description:
      'Gera 3–5 variantes de 1ª mensagem (Ollama ou fallback) e monta wa.me — sem envio automático.',
    path: '/agents/whatsapp',
  },
];

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelines: PipelinesService,
    private readonly templates: TemplatesService,
    private readonly ollama: OllamaChatClient,
  ) {}

  catalog() {
    return { data: AGENT_CATALOG };
  }

  async suggestCrm(organizationId: string, leadId: string) {
    const lead = await this.loadLead(organizationId, leadId);
    const [overdueCount, nextStage] = await Promise.all([
      this.prisma.task.count({
        where: {
          organizationId,
          leadId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueAt: { lt: new Date() },
        },
      }),
      this.resolveNextStage(organizationId, lead.stageId, lead.stage?.order ?? null),
    ]);

    const phone = (lead.phone ?? lead.whatsapp)?.trim() || null;
    const email = lead.email?.trim() || null;
    const hasContact = Boolean(phone || email);
    const score = lead.score ?? 0;
    const staleDays = daysSince(lead.updatedAt);

    const suggestion = this.pickCrmAction({
      doNotContact: lead.doNotContact,
      hasPhone: Boolean(phone),
      hasEmail: Boolean(email),
      hasContact,
      hasWebsite: Boolean(lead.website?.trim()),
      hasWebsiteAnalysis: Boolean(lead.websiteRecord?.analyses?.[0]),
      overdueCount,
      score,
      status: lead.status,
      staleDays,
      hasNextStage: Boolean(nextStage),
    });

    const suggestedStage =
      suggestion.actionCode === 'ADVANCE_PIPELINE' ||
      suggestion.actionCode === 'PRIORITIZE_OUTREACH'
        ? nextStage
        : null;

    return {
      leadId: lead.id,
      companyName: lead.companyName,
      score: lead.score,
      status: lead.status,
      currentStage: lead.stage
        ? { id: lead.stage.id, name: lead.stage.name, order: lead.stage.order }
        : null,
      suggestedStage,
      actionCode: suggestion.actionCode,
      rationale: suggestion.rationale,
      severity: suggestion.severity,
      href: suggestion.href(lead.id),
      canApplyStage: Boolean(suggestedStage),
    };
  }

  async applyCrm(
    organizationId: string,
    actorId: string,
    leadId: string,
    stageId?: string,
  ) {
    const targetStageId =
      stageId ?? (await this.suggestCrm(organizationId, leadId)).suggestedStage?.id;

    if (!targetStageId) {
      throw new BadRequestException(
        'No stage to apply. Pass stageId or choose a lead with a next pipeline stage.',
      );
    }

    const updated = await this.pipelines.moveLeadToStage(
      organizationId,
      leadId,
      targetStageId,
      actorId,
    );

    return {
      leadId: updated.id,
      stageId: updated.stageId,
      stage: updated.stage
        ? { id: updated.stage.id, name: updated.stage.name }
        : null,
      applied: true,
    };
  }

  async whatsappFirstMessage(
    organizationId: string,
    actorUserId: string,
    leadId: string,
    templateId?: string,
  ) {
    const lead = await this.loadLead(organizationId, leadId);
    const phoneRaw = (lead.phone ?? lead.whatsapp)?.trim() || null;
    const digits = phoneRaw ? phoneRaw.replace(/\D/g, '') : '';

    if (lead.doNotContact) {
      throw new BadRequestException('Lead is marked do-not-contact.');
    }

    const template = templateId
      ? await this.templates.get(organizationId, templateId)
      : await this.resolveDefaultWhatsappTemplate(organizationId);

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { name: true },
    });

    const values = this.leadTemplateValues(lead, actor?.name);
    const rendered = renderTemplate(template.body, values);
    const waLink =
      digits.length > 0
        ? `https://wa.me/${digits}?text=${encodeURIComponent(rendered.rendered)}`
        : null;

    return {
      leadId: lead.id,
      companyName: lead.companyName,
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      body: rendered.rendered,
      missing: rendered.missing,
      unknown: rendered.unknown,
      phone: phoneRaw,
      digits: digits || null,
      waLink,
      canOpen: Boolean(waLink),
      autoSend: false,
      messageSent: false,
    };
  }

  async whatsappVariants(
    organizationId: string,
    actorUserId: string,
    leadId: string,
    count?: number,
    seed?: number,
  ) {
    const lead = await this.loadLead(organizationId, leadId);
    const phoneRaw = (lead.phone ?? lead.whatsapp)?.trim() || null;
    const digits = phoneRaw ? phoneRaw.replace(/\D/g, '') : '';

    if (lead.doNotContact) {
      throw new BadRequestException('Lead is marked do-not-contact.');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { name: true },
    });

    const variantCount = clampVariantCount(count);
    const generationSeed = normalizeSeed(seed);
    const leadContext = {
      companyName: lead.companyName,
      tradeName: lead.tradeName,
      city: lead.city,
      segment: lead.segment,
      website: lead.website,
      senderName: actor?.name?.trim() || null,
    };

    const fromOllama = await this.ollama.generateVariants(
      leadContext,
      variantCount,
      generationSeed,
    );
    const source: WhatsappVariantSource = fromOllama ? 'ollama' : 'fallback';
    const variants =
      fromOllama ??
      buildDeterministicWhatsappVariants(leadContext, variantCount, generationSeed);

    return {
      leadId: lead.id,
      companyName: lead.companyName,
      phone: phoneRaw,
      digits: digits || null,
      source,
      seed: generationSeed,
      variants,
      autoSend: false as const,
      messageSent: false as const,
    };
  }

  private async loadLead(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: {
        stage: { select: { id: true, name: true, order: true, pipelineId: true } },
        websiteRecord: {
          select: {
            analyses: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, status: true },
            },
          },
        },
        owner: { select: { id: true, name: true } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private async resolveNextStage(
    organizationId: string,
    stageId: string | null,
    currentOrder: number | null,
  ) {
    if (!stageId || currentOrder == null) {
      const pipeline = await this.prisma.pipeline.findFirst({
        where: { organizationId, isDefault: true },
        include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
      });
      const first = pipeline?.stages[0];
      return first ? { id: first.id, name: first.name, order: first.order } : null;
    }

    const current = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { organizationId } },
    });
    if (!current) return null;

    const next = await this.prisma.pipelineStage.findFirst({
      where: {
        pipelineId: current.pipelineId,
        order: { gt: current.order },
      },
      orderBy: { order: 'asc' },
    });

    return next ? { id: next.id, name: next.name, order: next.order } : null;
  }

  private async resolveDefaultWhatsappTemplate(organizationId: string) {
    const whatsapp = await this.prisma.messageTemplate.findFirst({
      where: { organizationId, category: 'WHATSAPP' },
      orderBy: { updatedAt: 'desc' },
    });
    if (whatsapp) return whatsapp;

    const any = await this.prisma.messageTemplate.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!any) {
      throw new NotFoundException(
        'No message template found. Create a WHATSAPP template first.',
      );
    }
    return any;
  }

  private leadTemplateValues(
    lead: {
      companyName: string;
      tradeName?: string | null;
      email?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      city?: string | null;
      website?: string | null;
      owner?: { name: string } | null;
    },
    senderName?: string | null,
  ): TemplateVariableValues {
    return {
      companyName: lead.companyName,
      tradeName: lead.tradeName,
      contactName: lead.tradeName ?? lead.companyName,
      email: lead.email,
      phone: lead.phone ?? lead.whatsapp,
      city: lead.city,
      website: lead.website,
      ownerName: senderName?.trim() || lead.owner?.name,
    };
  }

  private pickCrmAction(input: {
    doNotContact: boolean;
    hasPhone: boolean;
    hasEmail: boolean;
    hasContact: boolean;
    hasWebsite: boolean;
    hasWebsiteAnalysis: boolean;
    overdueCount: number;
    score: number;
    status: LeadStatus;
    staleDays: number;
    hasNextStage: boolean;
  }): {
    actionCode: CrmActionCode;
    rationale: string;
    severity: 'info' | 'warn' | 'critical';
    href: (leadId: string) => string;
  } {
    if (input.doNotContact) {
      return {
        actionCode: 'RESPECT_DNC',
        rationale: 'Lead marcado como não contatar.',
        severity: 'critical',
        href: (id) => `/leads/${id}`,
      };
    }

    if (!input.hasPhone && !input.hasEmail) {
      return {
        actionCode: 'ENRICH_CONTACT',
        rationale: 'Sem telefone nem e-mail — complete o contacto antes do outreach.',
        severity: 'warn',
        href: (id) => `/leads/${id}`,
      };
    }

    if (input.overdueCount > 0) {
      return {
        actionCode: 'FOLLOW_UP_OVERDUE',
        rationale: `${input.overdueCount} tarefa(s) em atraso neste lead.`,
        severity: 'critical',
        href: () => `/tasks`,
      };
    }

    if (input.hasWebsite && !input.hasWebsiteAnalysis) {
      return {
        actionCode: 'RUN_WEBSITE_ANALYSIS',
        rationale: 'Website cadastrado sem análise recente.',
        severity: 'info',
        href: (id) => `/leads/${id}`,
      };
    }

    if (input.score >= 70 && EARLY_STATUS.has(input.status) && input.hasContact) {
      return {
        actionCode: 'PRIORITIZE_OUTREACH',
        rationale: 'Alto score em estágio inicial — priorize o primeiro contacto.',
        severity: 'warn',
        href: (id) => `/agents/whatsapp?leadId=${id}`,
      };
    }

    if (input.hasNextStage && (input.staleDays >= 7 || input.score >= 50)) {
      return {
        actionCode: 'ADVANCE_PIPELINE',
        rationale:
          input.staleDays >= 7
            ? `Lead parado há ${input.staleDays} dias — avance o estágio se houver progresso.`
            : 'Há estágio seguinte disponível no pipeline.',
        severity: input.staleDays >= 7 ? 'warn' : 'info',
        href: (id) => `/leads/${id}`,
      };
    }

    if (!input.hasWebsite || input.score < 20) {
      return {
        actionCode: 'ENRICH_PROFILE',
        rationale: 'Perfil incompleto — complete dados do lead.',
        severity: 'info',
        href: (id) => `/leads/${id}`,
      };
    }

    return {
      actionCode: 'NURTURE',
      rationale: 'Mantenha o relacionamento e agende o próximo follow-up.',
      severity: 'info',
      href: (id) => `/leads/${id}`,
    };
  }
}

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
