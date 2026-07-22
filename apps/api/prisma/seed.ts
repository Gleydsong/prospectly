import { PrismaClient, LeadSource, LeadStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SEGMENTS = [
  'Restaurante',
  'Loja',
  'Clínica',
  'Academia',
  'Barbearia',
  'Hotel',
  'Oficina',
  'Imobiliária',
  'Padaria',
  'Farmácia',
] as const;

const CITIES: Array<[string, string]> = [
  ['Lisboa', 'Lisboa'],
  ['Porto', 'Porto'],
  ['Braga', 'Braga'],
  ['Coimbra', 'Coimbra'],
  ['Faro', 'Faro'],
  ['Aveiro', 'Aveiro'],
];

const STATUSES: LeadStatus[] = [
  'NEW',
  'TO_REVIEW',
  'QUALIFIED',
  'CONTACTED',
  'RESPONDED',
  'MEETING_SCHEDULED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
];

const TEMPLATES = [
  {
    name: 'Primeiro contato — sem site',
    category: 'SITE_INEXISTENTE',
    subject: '{{companyName}} ainda não tem site?',
    body: 'Olá {{contactName}}, notei que {{companyName}} em {{city}} ainda não possui um site próprio. Posso ajudar a criar uma presença digital forte. — {{senderName}}',
  },
  {
    name: 'Follow-up',
    category: 'FOLLOW_UP',
    subject: 'Re: proposta para {{companyName}}',
    body: 'Olá {{contactName}}, passo para saber se teve oportunidade de ver a proposta para {{companyName}}. Fico disponível para esclarecer dúvidas. — {{senderName}}',
  },
  {
    name: 'Site desatualizado',
    category: 'SITE_DESATUALIZADO',
    subject: 'Modernização do site de {{companyName}}',
    body: 'Olá {{contactName}}, analisei {{website}} e identifiquei oportunidades de modernização ({{problem}}). Posso apresentar um plano sem compromisso. — {{senderName}}',
  },
  {
    name: 'Site lento',
    category: 'SITE_LENTO',
    subject: 'O site de {{companyName}} está lento',
    body: 'Olá {{contactName}}, o site {{website}} apresenta performance abaixo do ideal, o que afeta visitantes e Google. Posso ajudar a otimizar. — {{senderName}}',
  },
  {
    name: 'Manutenção mensal',
    category: 'MANUTENCAO_MENSAL',
    subject: 'Manutenção mensal para {{website}}',
    body: 'Olá {{contactName}}, ofereço plano de manutenção mensal para manter {{website}} seguro, rápido e atualizado. — {{senderName}}',
  },
];

async function main() {
  const passwordHash = await argon2.hash('Demo123!');

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-agency' },
    update: {},
    create: { name: 'Demo Agency', slug: 'demo-agency' },
  });

  const users: Array<{ email: string; name: string; role: Role }> = [
    { email: 'demo@prospectly.dev', name: 'Demo Owner', role: 'OWNER' },
    { email: 'admin@prospectly.dev', name: 'Admin User', role: 'ADMIN' },
    { email: 'sales@prospectly.dev', name: 'Sales User', role: 'SALES' },
    { email: 'viewer@prospectly.dev', name: 'Viewer User', role: 'VIEWER' },
  ];

  const userIds: Record<string, string> = {};
  for (const entry of users) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {},
      create: {
        email: entry.email,
        name: entry.name,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    userIds[entry.email] = user.id;
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId: organization.id },
      },
      update: { role: entry.role },
      create: { userId: user.id, organizationId: organization.id, role: entry.role },
    });
  }

  const ownerId = userIds['demo@prospectly.dev'];
  const salesId = userIds['sales@prospectly.dev'];
  if (!ownerId || !salesId) {
    throw new Error('Seed users not created');
  }

  const existingPipeline = await prisma.pipeline.findFirst({
    where: { organizationId: organization.id, isDefault: true },
  });
  const pipeline =
    existingPipeline ??
    (await prisma.pipeline.create({
      data: { organizationId: organization.id, name: 'Pipeline padrão', isDefault: true },
    }));

  const stageCount = await prisma.pipelineStage.count({ where: { pipelineId: pipeline.id } });
  if (stageCount === 0) {
    const stages = [
      { name: 'Novos', order: 0, color: '#6366f1' },
      { name: 'Em análise', order: 1, color: '#0ea5e9' },
      { name: 'Qualificados', order: 2, color: '#14b8a6' },
      { name: 'Contatados', order: 3, color: '#f59e0b' },
      { name: 'Responderam', order: 4, color: '#f97316' },
      { name: 'Reunião marcada', order: 5, color: '#8b5cf6' },
      { name: 'Proposta enviada', order: 6, color: '#d946ef' },
      { name: 'Negociação', order: 7, color: '#ec4899' },
      { name: 'Ganhos', order: 8, color: '#22c55e', isWon: true },
      { name: 'Perdidos', order: 9, color: '#ef4444', isLost: true },
    ];
    await prisma.pipelineStage.createMany({
      data: stages.map((stage) => ({ ...stage, pipelineId: pipeline.id })),
    });
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { order: 'asc' },
  });

  const tagNames = ['sem-site', 'site-antigo', 'sem-https', 'prioridade', 'lento'];
  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: {},
      create: { organizationId: organization.id, name },
    });
  }
  const tags = await prisma.tag.findMany({ where: { organizationId: organization.id } });

  const leadCount = await prisma.lead.count({ where: { organizationId: organization.id } });
  if (leadCount === 0) {
    const sources: LeadSource[] = ['MANUAL', 'GOOGLE_PLACES', 'CSV_IMPORT', 'YELP'];
    for (let index = 0; index < 30; index += 1) {
      const segment = SEGMENTS[index % SEGMENTS.length] ?? 'Loja';
      const [city, state] = CITIES[index % CITIES.length] ?? ['Lisboa', 'Lisboa'];
      const hasWebsite = index % 3 !== 0;
      const status = STATUSES[index % STATUSES.length] ?? 'NEW';
      const stage = stages[Math.min(index % stages.length, stages.length - 1)];
      const score = ((index * 17) % 95) + 5;

      const lead = await prisma.lead.create({
        data: {
          organizationId: organization.id,
          ownerId: index % 2 === 0 ? ownerId : salesId,
          companyName: `${segment} Exemplo ${index + 1}`,
          tradeName: `${segment} ${city} ${index + 1}`,
          category: segment,
          segment,
          description: `Negócio local de exemplo (${segment}) em ${city}. Dados fictícios para demonstração.`,
          phone: `+35121${String(1000000 + index * 137).slice(0, 7)}`,
          email: index % 4 !== 0 ? `contato${index + 1}@exemplo${index + 1}.pt` : null,
          whatsapp: index % 5 === 0 ? `+35191${String(1000000 + index * 91).slice(0, 7)}` : null,
          website: hasWebsite ? `https://exemplo-${index + 1}.pt` : null,
          domain: hasWebsite ? `exemplo-${index + 1}.pt` : null,
          instagram: index % 3 === 0 ? `@exemplo${index + 1}` : null,
          address: `Rua Exemplo, ${index + 10}`,
          city,
          state,
          country: 'Portugal',
          postalCode: `1000-${100 + index}`,
          rating: Math.round((3 + (index % 20) / 10) * 10) / 10,
          reviewCount: 5 + ((index * 13) % 240),
          source: sources[index % sources.length] ?? 'MANUAL',
          status,
          stageId: stage?.id,
          score,
          dataCollectedAt: new Date(),
        },
      });

      if (index % 2 === 0 && tags.length > 0) {
        const tag = tags[index % tags.length];
        if (tag) {
          await prisma.leadTag.create({ data: { leadId: lead.id, tagId: tag.id } });
        }
      }

      if (index % 3 === 0) {
        await prisma.leadActivity.create({
          data: {
            organizationId: organization.id,
            leadId: lead.id,
            userId: ownerId,
            type: 'NOTE',
            description: 'Lead adicionado ao pipeline para avaliação inicial.',
          },
        });
      }

      if (index % 4 === 0) {
        await prisma.task.create({
          data: {
            organizationId: organization.id,
            leadId: lead.id,
            createdById: ownerId,
            assigneeId: salesId,
            title: `Contactar ${segment} Exemplo ${index + 1}`,
            dueAt: new Date(Date.now() + (index + 1) * 86400000),
            priority: index % 8 === 0 ? 'HIGH' : 'MEDIUM',
          },
        });
      }

      if (hasWebsite && index % 3 === 0) {
        const website = await prisma.website.create({
          data: { leadId: lead.id, url: `https://exemplo-${index + 1}.pt`, domain: `exemplo-${index + 1}.pt` },
        });
        await prisma.websiteAnalysis.create({
          data: {
            websiteId: website.id,
            status: 'COMPLETED',
            httpStatus: 200,
            https: index % 2 === 0,
            sslValid: index % 2 === 0,
            responseTimeMs: 400 + ((index * 211) % 2600),
            title: `${segment} Exemplo ${index + 1}`,
            metaDescription: index % 2 === 0 ? `Site do ${segment} Exemplo ${index + 1}` : null,
            hasViewport: index % 2 === 0,
            hasContactForm: index % 4 === 0,
            completedAt: new Date(),
            issues: {
              create:
                index % 2 !== 0
                  ? [{ code: 'MISSING_VIEWPORT', severity: 'CRITICAL', message: 'Site sem viewport responsivo' }]
                  : [{ code: 'SLOW_RESPONSE', severity: 'WARNING', message: 'Tempo de resposta elevado' }],
            },
          },
        });
      }
    }
  }

  const templateCount = await prisma.messageTemplate.count({
    where: { organizationId: organization.id },
  });
  if (templateCount === 0) {
    await prisma.messageTemplate.createMany({
      data: TEMPLATES.map((template) => ({
        ...template,
        organizationId: organization.id,
        createdById: ownerId,
      })),
    });
  }

  const configCount = await prisma.scoreConfiguration.count({
    where: { organizationId: organization.id },
  });
  if (configCount === 0) {
    const config = await prisma.scoreConfiguration.create({
      data: { organizationId: organization.id, name: 'default', version: 1, isActive: true },
    });
    await prisma.scoreRule.createMany({
      data: [
        { key: 'NO_WEBSITE', points: 30, description: 'Sem website', configId: config.id },
        { key: 'NO_HTTPS', points: 15, description: 'Website sem HTTPS', configId: config.id },
        { key: 'NOT_RESPONSIVE', points: 20, description: 'Website não responsivo', configId: config.id },
        { key: 'SLOW', points: 10, description: 'Performance baixa', configId: config.id },
        { key: 'NO_CONTACT_FORM', points: 8, description: 'Sem formulário de contato', configId: config.id },
        { key: 'NO_META_DESCRIPTION', points: 5, description: 'Sem meta description', configId: config.id },
        { key: 'MANY_REVIEWS_BAD_SITE', points: 15, description: 'Muitas avaliações e site ruim', configId: config.id },
        { key: 'HAS_PHONE', points: 5, description: 'Telefone disponível', configId: config.id },
        { key: 'HAS_EMAIL', points: 5, description: 'E-mail disponível', configId: config.id },
        { key: 'HIGH_RATING', points: 5, description: 'Nota alta', configId: config.id },
      ],
    });
  }

  console.log('Seed concluído:', {
    organization: organization.slug,
    users: users.map((user) => user.email),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
