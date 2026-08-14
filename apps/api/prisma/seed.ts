import { PrismaClient, LeadSource, LeadStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Realistic local businesses for the demo org (no "Exemplo"/fictional labels). */
const DEMO_LEADS = [
  {
    companyName: 'Tasca do Bairro',
    tradeName: 'Tasca do Bairro',
    segment: 'Restaurante',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Rua da Madalena, 48',
    domain: 'tascadobairro.pt',
    email: 'reservas@tascadobairro.pt',
    instagram: '@tascadobairro',
  },
  {
    companyName: 'Mercearia do Carmo',
    tradeName: 'Mercearia do Carmo',
    segment: 'Loja',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Largo do Carmo, 12',
    domain: null,
    email: 'contacto@merceariadocarmo.pt',
    instagram: null,
  },
  {
    companyName: 'Clínica Boa Saúde',
    tradeName: 'Clínica Boa Saúde',
    segment: 'Clínica',
    city: 'Porto',
    state: 'Porto',
    address: 'Rua de Cedofeita, 210',
    domain: 'clinicaboasaude.pt',
    email: 'marcacoes@clinicaboasaude.pt',
    instagram: '@clinicaboasaude',
  },
  {
    companyName: 'Fitness Norte',
    tradeName: 'Fitness Norte',
    segment: 'Academia',
    city: 'Porto',
    state: 'Porto',
    address: 'Avenida da Boavista, 1200',
    domain: null,
    email: null,
    instagram: '@fitnessnorte',
  },
  {
    companyName: 'Barbearia Dom Carlos',
    tradeName: 'Barbearia Dom Carlos',
    segment: 'Barbearia',
    city: 'Braga',
    state: 'Braga',
    address: 'Rua do Souto, 33',
    domain: null,
    email: 'marcacao@barbeariadomcarlos.pt',
    instagram: '@barbeariadomcarlos',
  },
  {
    companyName: 'Hotel Ribeira Alta',
    tradeName: 'Hotel Ribeira Alta',
    segment: 'Hotel',
    city: 'Porto',
    state: 'Porto',
    address: 'Cais da Ribeira, 8',
    domain: 'hotelribeiraalta.pt',
    email: 'reservas@hotelribeiraalta.pt',
    instagram: '@hotelribeiraalta',
  },
  {
    companyName: 'Oficina Auto Ribeiro',
    tradeName: 'Oficina Auto Ribeiro',
    segment: 'Oficina',
    city: 'Coimbra',
    state: 'Coimbra',
    address: 'Rua da Sofia, 95',
    domain: null,
    email: 'oficina@autoribeiro.pt',
    instagram: null,
  },
  {
    companyName: 'Imobiliária Horizonte',
    tradeName: 'Imobiliária Horizonte',
    segment: 'Imobiliária',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Avenida da República, 300',
    domain: 'imobiliariahorizonte.pt',
    email: 'geral@imobiliariahorizonte.pt',
    instagram: '@imobiliariahorizonte',
  },
  {
    companyName: 'Padaria São Vicente',
    tradeName: 'Padaria São Vicente',
    segment: 'Padaria',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Rua de São Vicente, 17',
    domain: null,
    email: null,
    instagram: '@padariasaovicente',
  },
  {
    companyName: 'Farmácia Central Faro',
    tradeName: 'Farmácia Central',
    segment: 'Farmácia',
    city: 'Faro',
    state: 'Faro',
    address: 'Rua de Santo António, 55',
    domain: 'farmaciacentralfaro.pt',
    email: 'info@farmaciacentralfaro.pt',
    instagram: null,
  },
  {
    companyName: 'Cantina da Estação',
    tradeName: 'Cantina da Estação',
    segment: 'Restaurante',
    city: 'Aveiro',
    state: 'Aveiro',
    address: 'Largo da Estação, 2',
    domain: null,
    email: 'cantina@estacaoaveiro.pt',
    instagram: '@cantinadaestacao',
  },
  {
    companyName: 'Boutique Atlântica',
    tradeName: 'Boutique Atlântica',
    segment: 'Loja',
    city: 'Faro',
    state: 'Faro',
    address: 'Rua Infante Dom Henrique, 40',
    domain: 'boutiqueatlantica.pt',
    email: 'loja@boutiqueatlantica.pt',
    instagram: '@boutiqueatlantica',
  },
  {
    companyName: 'Clínica Dentária Mondego',
    tradeName: 'Dentária Mondego',
    segment: 'Clínica',
    city: 'Coimbra',
    state: 'Coimbra',
    address: 'Avenida Sá da Bandeira, 88',
    domain: null,
    email: 'recepcao@dentariamondego.pt',
    instagram: null,
  },
  {
    companyName: 'Gym Formiga',
    tradeName: 'Gym Formiga',
    segment: 'Academia',
    city: 'Braga',
    state: 'Braga',
    address: 'Avenida Central, 150',
    domain: 'gymformiga.pt',
    email: 'contacto@gymformiga.pt',
    instagram: '@gymformiga',
  },
  {
    companyName: 'Barbearia Navalha Fina',
    tradeName: 'Navalha Fina',
    segment: 'Barbearia',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Rua do Norte, 22',
    domain: null,
    email: null,
    instagram: '@navalhafina',
  },
  {
    companyName: 'Pousada das Dunas',
    tradeName: 'Pousada das Dunas',
    segment: 'Hotel',
    city: 'Faro',
    state: 'Faro',
    address: 'Avenida dos Descobrimentos, 77',
    domain: 'pousadadasdunas.pt',
    email: 'reservas@pousadadasdunas.pt',
    instagram: '@pousadadasdunas',
  },
  {
    companyName: 'Auto Serviço Minho',
    tradeName: 'Auto Serviço Minho',
    segment: 'Oficina',
    city: 'Braga',
    state: 'Braga',
    address: 'Rua de São Vicente, 201',
    domain: null,
    email: 'oficina@autoservicominho.pt',
    instagram: null,
  },
  {
    companyName: 'Casa & Chave Imóveis',
    tradeName: 'Casa & Chave',
    segment: 'Imobiliária',
    city: 'Porto',
    state: 'Porto',
    address: 'Rua de Santa Catarina, 400',
    domain: 'casaechave.pt',
    email: 'geral@casaechave.pt',
    instagram: '@casaechave',
  },
  {
    companyName: 'Padaria Trigo Dourado',
    tradeName: 'Trigo Dourado',
    segment: 'Padaria',
    city: 'Aveiro',
    state: 'Aveiro',
    address: 'Praça da República, 9',
    domain: null,
    email: 'encomendas@trigodourado.pt',
    instagram: '@trigodourado',
  },
  {
    companyName: 'Farmácia Saúde Viva',
    tradeName: 'Farmácia Saúde Viva',
    segment: 'Farmácia',
    city: 'Coimbra',
    state: 'Coimbra',
    address: 'Largo da Portagem, 5',
    domain: 'farmaciasaudeviva.pt',
    email: 'info@farmaciasaudeviva.pt',
    instagram: null,
  },
  {
    companyName: 'Marisqueira Atlântico',
    tradeName: 'Marisqueira Atlântico',
    segment: 'Restaurante',
    city: 'Aveiro',
    state: 'Aveiro',
    address: 'Cais dos Mercantéis, 14',
    domain: null,
    email: 'reservas@marisqueiraatlantico.pt',
    instagram: '@marisqueiraatlantico',
  },
  {
    companyName: 'Loja do Artesão',
    tradeName: 'Loja do Artesão',
    segment: 'Loja',
    city: 'Braga',
    state: 'Braga',
    address: 'Rua Dom Diogo de Sousa, 60',
    domain: null,
    email: null,
    instagram: '@lojadoartesao',
  },
  {
    companyName: 'Clínica Vet Amiga',
    tradeName: 'Vet Amiga',
    segment: 'Clínica',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Avenida de Roma, 45',
    domain: 'clinicavetamiga.pt',
    email: 'marcacoes@clinicavetamiga.pt',
    instagram: '@clinicavetamiga',
  },
  {
    companyName: 'CrossFit Tejo',
    tradeName: 'CrossFit Tejo',
    segment: 'Academia',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Rua de Alcântara, 110',
    domain: null,
    email: 'box@crossfittejo.pt',
    instagram: '@crossfittejo',
  },
  {
    companyName: 'Barbearia Porto Clássico',
    tradeName: 'Porto Clássico',
    segment: 'Barbearia',
    city: 'Porto',
    state: 'Porto',
    address: 'Rua das Flores, 28',
    domain: 'portoclassico.pt',
    email: 'marcacao@portoclassico.pt',
    instagram: '@portoclassico',
  },
  {
    companyName: 'Hostel Baixa Vista',
    tradeName: 'Hostel Baixa Vista',
    segment: 'Hotel',
    city: 'Lisboa',
    state: 'Lisboa',
    address: 'Rua Augusta, 180',
    domain: null,
    email: 'hello@hostelbaixavista.pt',
    instagram: '@hostelbaixavista',
  },
  {
    companyName: 'Mecânica Rápida Sul',
    tradeName: 'Mecânica Rápida Sul',
    segment: 'Oficina',
    city: 'Faro',
    state: 'Faro',
    address: 'Estrada Nacional 125, km 4',
    domain: null,
    email: 'oficina@mecanicarapidasul.pt',
    instagram: null,
  },
  {
    companyName: 'Nova Morada Imóveis',
    tradeName: 'Nova Morada',
    segment: 'Imobiliária',
    city: 'Aveiro',
    state: 'Aveiro',
    address: 'Rua João Mendonça, 25',
    domain: 'novamorada.pt',
    email: 'geral@novamorada.pt',
    instagram: '@novamorada',
  },
  {
    companyName: 'Padaria Forno Antigo',
    tradeName: 'Forno Antigo',
    segment: 'Padaria',
    city: 'Porto',
    state: 'Porto',
    address: 'Rua de Miguel Bombarda, 70',
    domain: null,
    email: null,
    instagram: '@fornoantico',
  },
  {
    companyName: 'Farmácia do Largo',
    tradeName: 'Farmácia do Largo',
    segment: 'Farmácia',
    city: 'Braga',
    state: 'Braga',
    address: 'Largo do Paço, 3',
    domain: null,
    email: 'info@farmaciadolargo.pt',
    instagram: null,
  },
] as const;

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
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error('Refusing to run demo seed in production. Set ALLOW_PROD_SEED=true to override.');
  }

  const password = process.env.SEED_DEMO_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'Demo123!');
  if (!password) {
    throw new Error('SEED_DEMO_PASSWORD is required');
  }

  const passwordHash = await argon2.hash(password);

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

  // Refresh demo leads on every seed so mock "Exemplo" data cannot linger.
  await prisma.lead.deleteMany({ where: { organizationId: organization.id } });

  const sources: LeadSource[] = ['MANUAL', 'GOOGLE_PLACES', 'CSV_IMPORT', 'YELP'];
  for (let index = 0; index < DEMO_LEADS.length; index += 1) {
      const entry = DEMO_LEADS[index]!;
      const hasWebsite = entry.domain !== null;
      const status = STATUSES[index % STATUSES.length] ?? 'NEW';
      const stage = stages[Math.min(index % stages.length, stages.length - 1)];
      const score = ((index * 17) % 95) + 5;

      const lead = await prisma.lead.create({
        data: {
          organizationId: organization.id,
          ownerId: index % 2 === 0 ? ownerId : salesId,
          companyName: entry.companyName,
          tradeName: entry.tradeName,
          category: entry.segment,
          segment: entry.segment,
          description: `${entry.segment} em ${entry.city}.`,
          phone: `+35121${String(1000000 + index * 137).slice(0, 7)}`,
          email: entry.email,
          whatsapp: index % 5 === 0 ? `+35191${String(1000000 + index * 91).slice(0, 7)}` : null,
          website: hasWebsite ? `https://${entry.domain}` : null,
          domain: entry.domain,
          instagram: entry.instagram,
          address: entry.address,
          city: entry.city,
          state: entry.state,
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
            title: `Contactar ${entry.companyName}`,
            dueAt: new Date(Date.now() + (index + 1) * 86400000),
            priority: index % 8 === 0 ? 'HIGH' : 'MEDIUM',
          },
        });
      }

      if (hasWebsite && index % 3 === 0 && entry.domain) {
        const website = await prisma.website.create({
          data: {
            leadId: lead.id,
            url: `https://${entry.domain}`,
            domain: entry.domain,
          },
        });
        await prisma.websiteAnalysis.create({
          data: {
            websiteId: website.id,
            status: 'COMPLETED',
            httpStatus: 200,
            https: index % 2 === 0,
            sslValid: index % 2 === 0,
            responseTimeMs: 400 + ((index * 211) % 2600),
            title: entry.companyName,
            metaDescription: index % 2 === 0 ? `Site de ${entry.companyName}` : null,
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
