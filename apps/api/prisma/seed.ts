import { PrismaClient, LeadSource, LeadStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Reference Brazilian metropolitan hubs for realistic CRM seed coordinates. */
export const BRAZILIAN_CITIES: Record<
  string,
  {
    state: string;
    lat: number;
    lng: number;
    ddd: string;
    cepPrefix: string;
    bairros: string[];
    logradouros: string[];
  }
> = {
  'São Paulo': {
    state: 'SP',
    lat: -23.55052,
    lng: -46.633308,
    ddd: '11',
    cepPrefix: '01310',
    bairros: ['Cerqueira César', 'Pinheiros', 'Bela Vista', 'Moema'],
    logradouros: ['Avenida Paulista', 'Rua Oscar Freire', 'Rua Augusta', 'Alameda Santos'],
  },
  'Rio de Janeiro': {
    state: 'RJ',
    lat: -22.906847,
    lng: -43.172896,
    ddd: '21',
    cepPrefix: '22040',
    bairros: ['Copacabana', 'Botafogo', 'Ipanema', 'Centro'],
    logradouros: [
      'Avenida Atlântica',
      'Rua Barata Ribeiro',
      'Rua Visconde de Pirajá',
      'Rua da Glória',
    ],
  },
  'Belo Horizonte': {
    state: 'MG',
    lat: -19.916681,
    lng: -43.934493,
    ddd: '31',
    cepPrefix: '30130',
    bairros: ['Savassi', 'Funcionários', 'Lourdes', 'Centro'],
    logradouros: ['Avenida Afonso Pena', 'Rua da Bahia', 'Praça Sete', 'Rua Guajajaras'],
  },
  Curitiba: {
    state: 'PR',
    lat: -25.428954,
    lng: -49.267137,
    ddd: '41',
    cepPrefix: '80010',
    bairros: ['Batel', 'Centro Cívico', 'Bigorrilho', 'Centro'],
    logradouros: [
      'Rua XV de Novembro',
      'Avenida Sete de Setembro',
      'Rua Comendador Araújo',
      'Rua Marechal Deodoro',
    ],
  },
  'Porto Alegre': {
    state: 'RS',
    lat: -30.034647,
    lng: -51.217658,
    ddd: '51',
    cepPrefix: '90010',
    bairros: ['Moinhos de Vento', 'Menino Deus', 'Centro Histórico', 'Petrópolis'],
    logradouros: [
      'Rua dos Andradas',
      'Avenida Borges de Medeiros',
      'Rua Padre Chagas',
      'Avenida Independência',
    ],
  },
  Salvador: {
    state: 'BA',
    lat: -12.977749,
    lng: -38.50163,
    ddd: '71',
    cepPrefix: '40020',
    bairros: ['Pituba', 'Barra', 'Rio Vermelho', 'Pelourinho'],
    logradouros: [
      'Avenida Sete de Setembro',
      'Rua das Laranjeiras',
      'Largo do Pelourinho',
      'Avenida Manoel Dias da Silva',
    ],
  },
  Recife: {
    state: 'PE',
    lat: -8.047562,
    lng: -34.877002,
    ddd: '81',
    cepPrefix: '50030',
    bairros: ['Boa Viagem', 'Pina', 'Recife Antigo', 'Graças'],
    logradouros: [
      'Avenida Boa Viagem',
      'Rua do Bom Jesus',
      'Rua da Aurora',
      'Avenida Conselheiro Aguiar',
    ],
  },
  Fortaleza: {
    state: 'CE',
    lat: -3.731862,
    lng: -38.52667,
    ddd: '85',
    cepPrefix: '60160',
    bairros: ['Meireles', 'Aldeota', 'Praia de Iracema', 'Varjota'],
    logradouros: [
      'Avenida Beira Mar',
      'Rua Monsenhor Tabosa',
      'Avenida Santos Dumont',
      'Rua Dom Luís',
    ],
  },
};

/** Realistic local businesses for the demo org (no "Exemplo"/fictional labels). */
export const DEMO_LEADS = [
  {
    companyName: 'Boteco do Bairro',
    tradeName: 'Boteco do Bairro',
    segment: 'Restaurante',
    city: 'São Paulo',
    state: 'SP',
    domain: 'botecodobairro.com.br',
    email: 'reservas@botecodobairro.com.br',
    instagram: '@botecodobairro',
  },
  {
    companyName: 'Mercearia do Carmo',
    tradeName: 'Mercearia do Carmo',
    segment: 'Loja',
    city: 'São Paulo',
    state: 'SP',
    domain: null,
    email: 'contato@merceariadocarmo.com.br',
    instagram: null,
  },
  {
    companyName: 'Clínica Boa Saúde',
    tradeName: 'Clínica Boa Saúde',
    segment: 'Clínica',
    city: 'Rio de Janeiro',
    state: 'RJ',
    domain: 'clinicaboasaude.com.br',
    email: 'marcacoes@clinicaboasaude.com.br',
    instagram: '@clinicaboasaude',
  },
  {
    companyName: 'Fitness Paulista',
    tradeName: 'Fitness Paulista',
    segment: 'Academia',
    city: 'São Paulo',
    state: 'SP',
    domain: null,
    email: null,
    instagram: '@fitnesspaulista',
  },
  {
    companyName: 'Barbearia Dom Carlos',
    tradeName: 'Barbearia Dom Carlos',
    segment: 'Barbearia',
    city: 'Belo Horizonte',
    state: 'MG',
    domain: null,
    email: 'marcacao@barbeariadomcarlos.com.br',
    instagram: '@barbeariadomcarlos',
  },
  {
    companyName: 'Hotel Mar Atlântico',
    tradeName: 'Hotel Mar Atlântico',
    segment: 'Hotel',
    city: 'Rio de Janeiro',
    state: 'RJ',
    domain: 'hotelmaratlantico.com.br',
    email: 'reservas@hotelmaratlantico.com.br',
    instagram: '@hotelmaratlantico',
  },
  {
    companyName: 'Oficina Auto Ribeiro',
    tradeName: 'Oficina Auto Ribeiro',
    segment: 'Oficina',
    city: 'Curitiba',
    state: 'PR',
    domain: null,
    email: 'oficina@autoribeiro.com.br',
    instagram: null,
    doNotContact: true,
  },
  {
    companyName: 'Imobiliária Horizonte',
    tradeName: 'Imobiliária Horizonte',
    segment: 'Imobiliária',
    city: 'São Paulo',
    state: 'SP',
    domain: 'imobiliariahorizonte.com.br',
    email: 'geral@imobiliariahorizonte.com.br',
    instagram: '@imobiliariahorizonte',
  },
  {
    companyName: 'Padaria São Vicente',
    tradeName: 'Padaria São Vicente',
    segment: 'Padaria',
    city: 'Belo Horizonte',
    state: 'MG',
    domain: null,
    email: null,
    instagram: '@padariasaovicente',
  },
  {
    companyName: 'Farmácia Central',
    tradeName: 'Farmácia Central',
    segment: 'Farmácia',
    city: 'Salvador',
    state: 'BA',
    domain: 'farmaciacentralbrasil.com.br',
    email: 'contato@farmaciacentralbrasil.com.br',
    instagram: null,
  },
  {
    companyName: 'Cantina da Estação',
    tradeName: 'Cantina da Estação',
    segment: 'Restaurante',
    city: 'Curitiba',
    state: 'PR',
    domain: null,
    email: 'cantina@estacaocuritiba.com.br',
    instagram: '@cantinadaestacao',
  },
  {
    companyName: 'Boutique Atlântica',
    tradeName: 'Boutique Atlântica',
    segment: 'Loja',
    city: 'Salvador',
    state: 'BA',
    domain: 'boutiqueatlantica.com.br',
    email: 'loja@boutiqueatlantica.com.br',
    instagram: '@boutiqueatlantica',
  },
  {
    companyName: 'Clínica Odonto Vida',
    tradeName: 'Odonto Vida',
    segment: 'Clínica',
    city: 'Porto Alegre',
    state: 'RS',
    domain: null,
    email: 'recepcao@odontovida.com.br',
    instagram: null,
  },
  {
    companyName: 'Academia Formiga',
    tradeName: 'Academia Formiga',
    segment: 'Academia',
    city: 'Belo Horizonte',
    state: 'MG',
    domain: 'academiaformiga.com.br',
    email: 'contato@academiaformiga.com.br',
    instagram: '@academiaformiga',
  },
  {
    companyName: 'Barbearia Navalha Fina',
    tradeName: 'Navalha Fina',
    segment: 'Barbearia',
    city: 'Rio de Janeiro',
    state: 'RJ',
    domain: null,
    email: null,
    instagram: '@navalhafina',
  },
  {
    companyName: 'Pousada das Dunas',
    tradeName: 'Pousada das Dunas',
    segment: 'Hotel',
    city: 'Fortaleza',
    state: 'CE',
    domain: 'pousadadasdunas.com.br',
    email: 'reservas@pousadadasdunas.com.br',
    instagram: '@pousadadasdunas',
  },
  {
    companyName: 'Auto Serviço Gaúcho',
    tradeName: 'Auto Serviço Gaúcho',
    segment: 'Oficina',
    city: 'Porto Alegre',
    state: 'RS',
    domain: null,
    email: 'oficina@autoservicogaucho.com.br',
    instagram: null,
  },
  {
    companyName: 'Casa & Chave Imóveis',
    tradeName: 'Casa & Chave',
    segment: 'Imobiliária',
    city: 'Curitiba',
    state: 'PR',
    domain: 'casaechaveimoveis.com.br',
    email: 'geral@casaechaveimoveis.com.br',
    instagram: '@casaechave',
  },
  {
    companyName: 'Padaria Trigo Dourado',
    tradeName: 'Trigo Dourado',
    segment: 'Padaria',
    city: 'Recife',
    state: 'PE',
    domain: null,
    email: 'encomendas@trigodourado.com.br',
    instagram: '@trigodourado',
  },
  {
    companyName: 'Farmácia Saúde Viva',
    tradeName: 'Farmácia Saúde Viva',
    segment: 'Farmácia',
    city: 'Recife',
    state: 'PE',
    domain: 'farmaciasaudeviva.com.br',
    email: 'info@farmaciasaudeviva.com.br',
    instagram: null,
  },
  {
    companyName: 'Restaurante Mar do Nordeste',
    tradeName: 'Mar do Nordeste',
    segment: 'Restaurante',
    city: 'Fortaleza',
    state: 'CE',
    domain: null,
    email: 'reservas@mardonordeste.com.br',
    instagram: '@mardonordeste',
  },
  {
    companyName: 'Loja do Artesão',
    tradeName: 'Loja do Artesão',
    segment: 'Loja',
    city: 'Recife',
    state: 'PE',
    domain: null,
    email: null,
    instagram: '@lojadoartesao',
  },
  {
    companyName: 'Clínica Vet Amiga',
    tradeName: 'Vet Amiga',
    segment: 'Clínica',
    city: 'Belo Horizonte',
    state: 'MG',
    domain: 'clinicavetamiga.com.br',
    email: 'marcacoes@clinicavetamiga.com.br',
    instagram: '@clinicavetamiga',
  },
  {
    companyName: 'CrossFit Paulistano',
    tradeName: 'CrossFit Paulistano',
    segment: 'Academia',
    city: 'São Paulo',
    state: 'SP',
    domain: null,
    email: 'box@crossfitpaulistano.com.br',
    instagram: '@crossfitpaulistano',
  },
  {
    companyName: 'Barbearia Paulista Clássica',
    tradeName: 'Paulista Clássica',
    segment: 'Barbearia',
    city: 'São Paulo',
    state: 'SP',
    domain: 'barbeariapartistaclassica.com.br',
    email: 'marcacao@barbeariapartistaclassica.com.br',
    instagram: '@barbeariapartistaclassica',
  },
  {
    companyName: 'Hostel Boa Vista',
    tradeName: 'Hostel Boa Vista',
    segment: 'Hotel',
    city: 'Rio de Janeiro',
    state: 'RJ',
    domain: null,
    email: 'contato@hostelboavista.com.br',
    instagram: '@hostelboavista',
  },
  {
    companyName: 'Mecânica Rápida Sul',
    tradeName: 'Mecânica Rápida Sul',
    segment: 'Oficina',
    city: 'Porto Alegre',
    state: 'RS',
    domain: null,
    email: 'oficina@mecanicarapidasul.com.br',
    instagram: null,
  },
  {
    companyName: 'Nova Morada Imóveis',
    tradeName: 'Nova Morada',
    segment: 'Imobiliária',
    city: 'Salvador',
    state: 'BA',
    domain: 'novamoradaimoveis.com.br',
    email: 'geral@novamoradaimoveis.com.br',
    instagram: '@novamorada',
  },
  {
    companyName: 'Padaria Forno Antigo',
    tradeName: 'Forno Antigo',
    segment: 'Padaria',
    city: 'Curitiba',
    state: 'PR',
    domain: null,
    email: null,
    instagram: '@fornoantigo',
  },
  {
    companyName: 'Farmácia do Largo',
    tradeName: 'Farmácia do Largo',
    segment: 'Farmácia',
    city: 'Fortaleza',
    state: 'CE',
    domain: null,
    email: 'info@farmaciadolargo.com.br',
    instagram: null,
  },
] as const;

export type DemoLeadEntry = (typeof DEMO_LEADS)[number];

export interface DemoLeadData {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone: string;
  whatsapp: string | null;
  description: string;
  doNotContact: boolean;
}

export function buildDemoLeadData(entry: DemoLeadEntry, index: number): DemoLeadData {
  const cityInfo = BRAZILIAN_CITIES[entry.city] ?? BRAZILIAN_CITIES['São Paulo']!;
  const logradouro = cityInfo.logradouros[index % cityInfo.logradouros.length];
  const bairro = cityInfo.bairros[index % cityInfo.bairros.length];
  const streetNumber = (index + 1) * 35;
  const address = `${logradouro}, ${streetNumber} — ${bairro}`;

  // Deterministic coordinate offset within city bounds (no Math.random)
  const latDelta = (((index * 7) % 17) - 8) * 0.0025;
  const lngDelta = (((index * 13) % 17) - 8) * 0.0025;
  const latitude = Math.round((cityInfo.lat + latDelta) * 1000000) / 1000000;
  const longitude = Math.round((cityInfo.lng + lngDelta) * 1000000) / 1000000;

  // Brazilian phone numbers:
  // - Landline (fixo): 8 digits starting with 2-5 (e.g. 3XXX-XXXX) -> +55 + DDD (2) + 8 digits = 13 chars
  // - Mobile (celular): 9 digits starting with 9 (e.g. 9XXXX-XXXX) -> +55 + DDD (2) + 9 digits = 14 chars
  const isMobile = index % 2 === 0;
  let phone: string;
  if (isMobile) {
    const mobileDigits = String(80000000 + ((index * 137) % 19999999)).padStart(8, '0');
    phone = `+55${cityInfo.ddd}9${mobileDigits}`;
  } else {
    const landlineDigits = String(2000000 + ((index * 137) % 7999999)).padStart(7, '0');
    phone = `+55${cityInfo.ddd}3${landlineDigits}`;
  }

  const whatsapp =
    index % 5 === 0
      ? `+55${cityInfo.ddd}9${String(90000000 + ((index * 91) % 9999999)).padStart(8, '0')}`
      : isMobile
        ? phone
        : null;

  return {
    address,
    city: entry.city,
    state: entry.state,
    country: 'Brasil',
    postalCode: `${cityInfo.cepPrefix}-${String(100 + index * 7).padStart(3, '0')}`,
    latitude,
    longitude,
    phone,
    whatsapp,
    description: `${entry.segment} em ${entry.city}/${entry.state}.`,
    doNotContact: 'doNotContact' in entry ? Boolean(entry.doNotContact) : false,
  };
}

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
    throw new Error(
      'Refusing to run demo seed in production. Set ALLOW_PROD_SEED=true to override.',
    );
  }

  const password =
    process.env.SEED_DEMO_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'Demo123!');
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
    const demoData = buildDemoLeadData(entry, index);
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
        description: demoData.description,
        phone: demoData.phone,
        email: entry.email,
        whatsapp: demoData.whatsapp,
        website: hasWebsite ? `https://${entry.domain}` : null,
        domain: entry.domain,
        instagram: entry.instagram,
        address: demoData.address,
        city: demoData.city,
        state: demoData.state,
        country: demoData.country,
        postalCode: demoData.postalCode,
        latitude: demoData.latitude,
        longitude: demoData.longitude,
        rating: Math.round((3 + (index % 20) / 10) * 10) / 10,
        reviewCount: 5 + ((index * 13) % 240),
        source: sources[index % sources.length] ?? 'MANUAL',
        status,
        stageId: stage?.id,
        score,
        doNotContact: demoData.doNotContact,
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
                ? [
                    {
                      code: 'MISSING_VIEWPORT',
                      severity: 'CRITICAL',
                      message: 'Site sem viewport responsivo',
                    },
                  ]
                : [
                    {
                      code: 'SLOW_RESPONSE',
                      severity: 'WARNING',
                      message: 'Tempo de resposta elevado',
                    },
                  ],
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
        {
          key: 'NOT_RESPONSIVE',
          points: 20,
          description: 'Website não responsivo',
          configId: config.id,
        },
        { key: 'SLOW', points: 10, description: 'Performance baixa', configId: config.id },
        {
          key: 'NO_CONTACT_FORM',
          points: 8,
          description: 'Sem formulário de contato',
          configId: config.id,
        },
        {
          key: 'NO_META_DESCRIPTION',
          points: 5,
          description: 'Sem meta description',
          configId: config.id,
        },
        {
          key: 'MANY_REVIEWS_BAD_SITE',
          points: 15,
          description: 'Muitas avaliações e site ruim',
          configId: config.id,
        },
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

const isDirectExecution =
  (typeof require !== 'undefined' && require.main === module) ||
  (process.argv[1] && process.argv[1].endsWith('seed.ts'));

if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
