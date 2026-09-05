import type {
  SeoAudit,
  SeoFinding,
  SeoOpportunityLevel,
  SeoSeverity,
  SeoSignals,
  SeoVector,
  WebsiteAnalysisResult,
} from '@prospectly/shared-types';

import { SLOW_RESPONSE_MS } from '../scoring/scoring.constants';

export const SEO_VECTOR_CAPS: Record<SeoVector, number> = {
  INDEXABILITY: 30,
  ON_PAGE: 30,
  PERFORMANCE: 20,
  LOCAL_INFRA: 20,
};

export const SEO_TITLE_LENGTH = { min: 10, max: 60 } as const;
export const SEO_META_DESCRIPTION_LENGTH = { min: 50, max: 160 } as const;
export const SEO_THIN_CONTENT_CHARS = 300;
export const SEO_MIN_IMAGES_FOR_CHECKS = 3;
export const SEO_RENDER_BLOCKING_THRESHOLD = 3;

type FindingTemplate = Omit<SeoFinding, 'points'> & { points: number };

interface SeoCheck {
  finding: FindingTemplate;
  /** `true` = fails (deduct). `undefined` = signal unknown, skip. */
  fails: (result: WebsiteAnalysisResult, seo: SeoSignals) => boolean | undefined;
}

function finding(
  code: string,
  vector: SeoVector,
  severity: SeoSeverity,
  points: number,
  quickWin: boolean,
  text: { title: string; diagnosis: string; impact: string; fix: string },
): FindingTemplate {
  return { code, vector, severity, points, quickWin, ...text };
}

const CHECKS: SeoCheck[] = [
  // ---------- Renderização & Indexabilidade ----------
  {
    finding: finding('SEO_CSR_SHELL', 'INDEXABILITY', 'HIGH', 18, false, {
      title: 'Página entregue como casca vazia (Client-Side Rendering)',
      diagnosis:
        'O HTML inicial não contém o conteúdo da página — apenas um container (ex.: <div id="root">) preenchido por JavaScript no navegador.',
      impact:
        'O Googlebot precisa renderizar JS numa segunda passagem, o que atrasa e limita a indexação. Páginas de serviço e cidade demoram a aparecer ou nem entram no índice, enquanto concorrentes com HTML completo ocupam as posições.',
      fix:
        'Adotar SSR/SSG (Next.js, Nuxt, Astro) ou pré-renderização para que título, H1 e conteúdo principal venham no HTML inicial.',
    }),
    fails: (_r, seo) => seo.renderingMode === 'CSR',
  },
  {
    finding: finding('SEO_NOINDEX', 'INDEXABILITY', 'HIGH', 12, true, {
      title: 'Página marcada com noindex',
      diagnosis: 'A meta <meta name="robots"> contém "noindex", instruindo o Google a não indexar a página.',
      impact: 'A página fica invisível na busca orgânica, independentemente da qualidade do conteúdo.',
      fix: 'Remover "noindex" da meta robots (ou do header X-Robots-Tag) nas páginas que devem ranquear.',
    }),
    fails: (_r, seo) => seo.noindex,
  },
  {
    finding: finding('SEO_ROBOTS_BLOCKS_ALL', 'INDEXABILITY', 'HIGH', 12, true, {
      title: 'robots.txt bloqueia todo o site',
      diagnosis: 'O robots.txt contém "User-agent: *" com "Disallow: /", impedindo o rastreamento de todas as URLs.',
      impact: 'Nenhuma página é rastreada; o site desaparece dos resultados orgânicos.',
      fix: 'Substituir por "Disallow:" vazio (ou bloquear apenas áreas administrativas) e declarar o sitemap.',
    }),
    fails: (_r, seo) => seo.robotsBlocksAll,
  },
  {
    finding: finding('SEO_THIN_CONTENT', 'INDEXABILITY', 'MEDIUM', 6, false, {
      title: 'Conteúdo textual insuficiente',
      diagnosis: `A página expõe menos de ${SEO_THIN_CONTENT_CHARS} caracteres de texto visível no HTML.`,
      impact: 'Pouco texto significa poucas palavras-chave e baixa relevância para buscas de serviço + cidade.',
      fix: 'Adicionar seções descritivas dos serviços, região atendida e diferenciais, com títulos H2/H3.',
    }),
    fails: (_r, seo) => seo.renderingMode !== 'CSR' && seo.visibleTextLength < SEO_THIN_CONTENT_CHARS,
  },

  // ---------- On-Page, Metadados & Semântica ----------
  {
    finding: finding('SEO_NO_TITLE', 'ON_PAGE', 'HIGH', 8, true, {
      title: 'Sem <title>',
      diagnosis: 'A página não define a tag <title>.',
      impact: 'O Google exibe um título genérico e não associa a página a nenhuma palavra-chave ou região.',
      fix: 'Definir <title> com serviço + cidade + marca, entre 10 e 60 caracteres.',
    }),
    fails: (r) => !r.title?.trim(),
  },
  {
    finding: finding('SEO_TITLE_LENGTH', 'ON_PAGE', 'LOW', 3, true, {
      title: 'Título fora do tamanho ideal',
      diagnosis: `O <title> tem tamanho fora da faixa recomendada de ${SEO_TITLE_LENGTH.min}–${SEO_TITLE_LENGTH.max} caracteres.`,
      impact: 'Títulos cortados ou vagos reduzem a taxa de clique nos resultados de busca.',
      fix: 'Reescrever o título com serviço principal + cidade + marca dentro da faixa ideal.',
    }),
    fails: (r, seo) => {
      if (!r.title?.trim() || seo.titleLength == null) return undefined;
      return seo.titleLength < SEO_TITLE_LENGTH.min || seo.titleLength > SEO_TITLE_LENGTH.max;
    },
  },
  {
    finding: finding('SEO_NO_META_DESCRIPTION', 'ON_PAGE', 'MEDIUM', 6, true, {
      title: 'Sem meta description',
      diagnosis: 'A página não define <meta name="description">.',
      impact: 'O Google monta o snippet com trechos aleatórios, reduzindo cliques e a percepção de profissionalismo.',
      fix: 'Adicionar meta description de 50–160 caracteres com proposta de valor, serviço e cidade.',
    }),
    fails: (r) => !r.metaDescription?.trim(),
  },
  {
    finding: finding('SEO_META_DESCRIPTION_LENGTH', 'ON_PAGE', 'LOW', 2, true, {
      title: 'Meta description fora do tamanho ideal',
      diagnosis: `A meta description está fora da faixa de ${SEO_META_DESCRIPTION_LENGTH.min}–${SEO_META_DESCRIPTION_LENGTH.max} caracteres.`,
      impact: 'Snippets cortados ou curtos demais perdem cliques para concorrentes.',
      fix: 'Ajustar o texto para a faixa recomendada, mantendo a chamada para ação.',
    }),
    fails: (r, seo) => {
      if (!r.metaDescription?.trim() || seo.metaDescriptionLength == null) return undefined;
      return (
        seo.metaDescriptionLength < SEO_META_DESCRIPTION_LENGTH.min ||
        seo.metaDescriptionLength > SEO_META_DESCRIPTION_LENGTH.max
      );
    },
  },
  {
    finding: finding('SEO_NO_H1', 'ON_PAGE', 'MEDIUM', 6, true, {
      title: 'Sem <h1>',
      diagnosis: 'Nenhum <h1> encontrado no HTML inicial.',
      impact: 'O Google perde o principal sinal semântico sobre o tema da página.',
      fix: 'Definir um único <h1> com o serviço principal e a região atendida.',
    }),
    fails: (_r, seo) => seo.h1Count === 0,
  },
  {
    finding: finding('SEO_MULTIPLE_H1', 'ON_PAGE', 'LOW', 3, true, {
      title: 'Múltiplos <h1>',
      diagnosis: 'A página possui mais de um <h1>.',
      impact: 'Hierarquia semântica diluída; o tema principal fica ambíguo para o buscador.',
      fix: 'Manter um único <h1> e rebaixar os demais para <h2>/<h3>.',
    }),
    fails: (_r, seo) => seo.h1Count > 1,
  },
  {
    finding: finding('SEO_NO_OPEN_GRAPH', 'ON_PAGE', 'MEDIUM', 4, true, {
      title: 'Open Graph incompleto',
      diagnosis: 'Faltam og:title e/ou og:image.',
      impact:
        'Links compartilhados no WhatsApp, Instagram e LinkedIn aparecem sem imagem e título — menos cliques e menor confiança.',
      fix: 'Adicionar <meta property="og:title">, og:description e og:image (1200×630) em todas as páginas.',
    }),
    fails: (_r, seo) => !seo.ogTitle || !seo.ogImage,
  },
  {
    finding: finding('SEO_NO_STRUCTURED_DATA', 'ON_PAGE', 'MEDIUM', 5, false, {
      title: 'Sem dados estruturados (Schema.org)',
      diagnosis: 'Nenhum bloco JSON-LD ou microdata Schema.org encontrado.',
      impact:
        'O Google não entende o negócio como LocalBusiness/Organization — sem rich results, sem destaque no mapa e na busca local.',
      fix: 'Inserir JSON-LD LocalBusiness (nome, endereço, telefone, horários, geo) ou Organization/SoftwareApplication para SaaS.',
    }),
    fails: (_r, seo) => seo.jsonLdTypes.length === 0 && !seo.hasMicrodata,
  },

  // ---------- Performance & Core Web Vitals ----------
  {
    finding: finding('SEO_NO_VIEWPORT', 'PERFORMANCE', 'HIGH', 8, true, {
      title: 'Sem meta viewport (não responsivo)',
      diagnosis: 'A página não declara <meta name="viewport">.',
      impact:
        'O Google usa indexação mobile-first; sem viewport a página é tratada como não amigável para celular e perde posições.',
      fix: 'Adicionar <meta name="viewport" content="width=device-width, initial-scale=1"> e garantir layout responsivo.',
    }),
    fails: (r) => (r.hasViewport == null ? undefined : !r.hasViewport),
  },
  {
    finding: finding('SEO_SLOW_RESPONSE', 'PERFORMANCE', 'MEDIUM', 6, false, {
      title: 'Servidor lento (TTFB alto)',
      diagnosis: `O HTML principal levou ${SLOW_RESPONSE_MS} ms ou mais para responder.`,
      impact: 'Piora LCP e taxa de rejeição; o Google penaliza páginas lentas na busca mobile.',
      fix: 'Ativar cache de página/CDN, revisar hospedagem e reduzir trabalho no servidor antes do primeiro byte.',
    }),
    fails: (r) => (r.responseTimeMs == null ? undefined : r.responseTimeMs >= SLOW_RESPONSE_MS),
  },
  {
    finding: finding('SEO_IMAGES_WITHOUT_DIMENSIONS', 'PERFORMANCE', 'MEDIUM', 6, false, {
      title: 'Imagens sem width/height (CLS)',
      diagnosis: 'A maioria das <img> não declara width e height.',
      impact: 'O layout "pula" durante o carregamento (CLS alto), prejudicando Core Web Vitals e a experiência mobile.',
      fix: 'Declarar width/height em todas as imagens ou usar aspect-ratio em CSS.',
    }),
    fails: (_r, seo) =>
      seo.images.total >= SEO_MIN_IMAGES_FOR_CHECKS &&
      seo.images.missingDimensions / seo.images.total > 0.5,
  },
  {
    finding: finding('SEO_LEGACY_IMAGE_FORMATS', 'PERFORMANCE', 'LOW', 4, false, {
      title: 'Imagens em formatos antigos',
      diagnosis: 'Nenhuma imagem em WebP/AVIF; tudo em JPG/PNG.',
      impact: 'Páginas mais pesadas, LCP pior e mais consumo de dados no celular.',
      fix: 'Converter para WebP/AVIF com <picture> ou via CDN de imagens.',
    }),
    fails: (_r, seo) => seo.images.total >= SEO_MIN_IMAGES_FOR_CHECKS && seo.images.modernFormat === 0,
  },
  {
    finding: finding('SEO_RENDER_BLOCKING_SCRIPTS', 'PERFORMANCE', 'MEDIUM', 4, true, {
      title: 'Scripts bloqueando a renderização',
      diagnosis: `Há ${SEO_RENDER_BLOCKING_THRESHOLD} ou mais <script src> síncronos no <head>.`,
      impact: 'Atrasa o primeiro render (FCP/LCP) e piora a pontuação de performance.',
      fix: 'Adicionar defer/async aos scripts do <head> ou movê-los para o fim do <body>.',
    }),
    fails: (_r, seo) => seo.renderBlockingScripts >= SEO_RENDER_BLOCKING_THRESHOLD,
  },

  // ---------- SEO Local & Infraestrutura ----------
  {
    finding: finding('SEO_NO_HTTPS', 'LOCAL_INFRA', 'HIGH', 10, false, {
      title: 'Site sem HTTPS',
      diagnosis: 'A URL final é servida em HTTP, sem certificado TLS.',
      impact: 'O navegador exibe "Não seguro", o Google rebaixa o site e visitantes desistem antes de entrar em contato.',
      fix: 'Instalar certificado (Let\'s Encrypt/CDN) e redirecionar 301 de http:// para https://.',
    }),
    fails: (r) => !r.https,
  },
  {
    finding: finding('SEO_NO_CANONICAL', 'LOCAL_INFRA', 'LOW', 3, true, {
      title: 'Sem tag canonical',
      diagnosis: 'A página não declara <link rel="canonical">.',
      impact: 'Variações de URL (com/sem www, parâmetros) competem entre si e diluem autoridade.',
      fix: 'Adicionar <link rel="canonical" href="URL-preferida"> em cada página.',
    }),
    fails: (_r, seo) => !seo.canonicalUrl,
  },
  {
    finding: finding('SEO_ALTERNATE_HOST_NOT_REDIRECTED', 'LOCAL_INFRA', 'MEDIUM', 3, false, {
      title: 'Versão com/sem www não redireciona',
      diagnosis: 'O host alternativo (com ou sem www) responde sem redirecionar 301 para o host principal.',
      impact: 'Conteúdo duplicado entre dois domínios; links e autoridade divididos.',
      fix: 'Configurar redirecionamento 301 permanente do host alternativo para o principal.',
    }),
    fails: (_r, seo) => (seo.alternateHostRedirects == null ? undefined : !seo.alternateHostRedirects),
  },
  {
    finding: finding('SEO_NO_ROBOTS_TXT', 'LOCAL_INFRA', 'LOW', 2, true, {
      title: 'Sem robots.txt',
      diagnosis: '/robots.txt não responde 200.',
      impact: 'Sem controle de rastreamento e sem indicação do sitemap ao Googlebot.',
      fix: 'Publicar /robots.txt com "User-agent: *", regras mínimas e "Sitemap: https://dominio/sitemap.xml".',
    }),
    fails: (r) => (r.hasRobotsTxt == null ? undefined : !r.hasRobotsTxt),
  },
  {
    finding: finding('SEO_NO_SITEMAP', 'LOCAL_INFRA', 'MEDIUM', 4, true, {
      title: 'Sem sitemap.xml',
      diagnosis: '/sitemap.xml não responde com XML válido e o robots.txt não declara um sitemap.',
      impact: 'Descoberta de páginas mais lenta; páginas novas ou profundas demoram a indexar.',
      fix: 'Gerar sitemap.xml (plugin/CMS ou build) e enviar no Google Search Console.',
    }),
    fails: (r) => (r.hasSitemap == null ? undefined : !r.hasSitemap),
  },
  {
    finding: finding('SEO_NO_NAP', 'LOCAL_INFRA', 'MEDIUM', 5, true, {
      title: 'NAP incompleto (nome, endereço, telefone)',
      diagnosis: 'Telefone e/ou endereço físico não aparecem no HTML da página.',
      impact:
        'Sem NAP consistente o Google não relaciona o site ao Perfil da Empresa; o negócio perde o pacote local ("mapa") para concorrentes.',
      fix: 'Exibir telefone (link tel:) e endereço completo no rodapé, iguais aos do Google Business Profile.',
    }),
    fails: (r, seo) => (r.hasPhone == null ? undefined : !r.hasPhone || !seo.hasAddress),
  },
];

export function seoOpportunityFromHealth(healthScore: number): SeoOpportunityLevel {
  if (healthScore >= 80) return 'LOW';
  if (healthScore >= 60) return 'MEDIUM';
  if (healthScore >= 40) return 'HIGH';
  return 'CRITICAL';
}

const SPA_FRAMEWORKS = new Set(['React', 'Vue', 'Angular']);

export function describeArchitecture(result: WebsiteAnalysisResult, seo: SeoSignals): string {
  if (result.cms) return result.cms;
  const framework = result.framework;
  if (framework) {
    if (seo.renderingMode === 'CSR') {
      return SPA_FRAMEWORKS.has(framework) ? `${framework} SPA (CSR)` : `${framework} CSR`;
    }
    if (seo.renderingMode === 'SSR' || seo.renderingMode === 'STATIC') return `${framework} SSR`;
    return framework;
  }
  if (seo.renderingMode === 'STATIC' || seo.renderingMode === 'SSR') return 'HTML estático/servidor';
  if (seo.renderingMode === 'CSR') return 'SPA (CSR)';
  return 'Desconhecida';
}

/**
 * Pure SEO audit over an analysis result. Returns `null` when there is nothing
 * to audit (page inaccessible or HTML not fetched).
 */
export function computeSeoAudit(result: WebsiteAnalysisResult): SeoAudit | null {
  const seo = result.seo;
  if (!seo || !result.accessible) return null;

  const findings: SeoFinding[] = [];
  const deductions: Record<SeoVector, number> = {
    INDEXABILITY: 0,
    ON_PAGE: 0,
    PERFORMANCE: 0,
    LOCAL_INFRA: 0,
  };

  for (const check of CHECKS) {
    if (check.fails(result, seo) !== true) continue;
    findings.push({ ...check.finding });
    deductions[check.finding.vector] += check.finding.points;
  }

  const vectors = (Object.keys(SEO_VECTOR_CAPS) as SeoVector[]).reduce(
    (acc, vector) => {
      const max = SEO_VECTOR_CAPS[vector];
      acc[vector] = { score: Math.max(0, max - deductions[vector]), max };
      return acc;
    },
    {} as SeoAudit['vectors'],
  );

  const healthScore = (Object.values(vectors) as Array<{ score: number }>).reduce(
    (sum, v) => sum + v.score,
    0,
  );

  findings.sort((a, b) => b.points - a.points);

  return {
    healthScore,
    opportunity: seoOpportunityFromHealth(healthScore),
    architecture: describeArchitecture(result, seo),
    vectors,
    findings,
    topIssues: findings.slice(0, 3),
    quickWins: findings.filter((f) => f.quickWin).slice(0, 2),
    signals: seo,
  };
}
