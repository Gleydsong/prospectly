#!/usr/bin/env python3
"""Gera o Relatório de Auditoria de Segurança (A4) do Prospectly."""

from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
CHARTS = ROOT / "_charts"
OUTPUT = ROOT / "relatorio-auditoria-seguranca.pdf"

PALETTE = {
    "critica": "#B91C1C",
    "alta": "#EA580C",
    "media": "#D97706",
    "baixa": "#2563EB",
    "info": "#64748B",
    "forte": "#059669",
    "ink": "#0F172A",
    "muted": "#475569",
    "line": "#E2E8F0",
    "band": "#F8FAFC",
}

FINDINGS = [
    {
        "id": "AUD-001",
        "sev": "alta",
        "cat": "Permissão no navegador",
        "file": "apps/api/src/modules/integrations/integrations.controller.ts",
        "lines": "22–25",
        "title": "GET /integrations lista webhook sem @Roles",
        "problem": (
            "A UI esconde Integrações para quem não é OWNER/ADMIN "
            "(canManageOrg + adminOnly), mas GET /api/v1/integrations só exige JWT. "
            "RolesGuard libera a rota quando não há @Roles. A resposta inclui a URL "
            "completa do webhook (config.url)."
        ),
        "why": (
            "VIEWER, MEMBER ou SALES autenticado chama GET /integrations e lê a URL "
            "do webhook da organização — inclusive se o admin colocou token na query. "
            "POST/DELETE de plugin e upsert do webhook estão protegidos com @Roles."
        ),
        "impact": "Leitura de URL de integração (possível segredo no path/query). Não é escape entre tenants.",
        "fix": "Anotar @Roles('OWNER', 'ADMIN') em GET /integrations, igual ao POST webhook.",
        "accept": [
            "VIEWER recebe 403 em GET /integrations",
            "OWNER/ADMIN continua listando o webhook do próprio tenant",
            "Tenant B não lê integrações do tenant A",
        ],
        "snippet": "@Get()\nlist(@CurrentOrg() organizationId: string) {\n  return this.integrations.list(organizationId);\n}",
        "cross": [
            "apps/web/src/features/settings/can-manage-org.ts:3–4",
            "apps/web/src/features/settings/settings-shell.tsx:39–41",
            "apps/web/src/pages/settings-page.tsx:72,75",
            "apps/web/src/features/settings/integrations-settings-card.tsx:74",
            "apps/api/src/common/guards/roles.guard.ts:34–36",
            "apps/api/src/modules/integrations/integrations.service.ts:18–24,86–90",
        ],
        "issue_title": "[Segurança] GET /integrations sem verificação de papel no servidor",
    },
    {
        "id": "AUD-002",
        "sev": "media",
        "cat": "Isolamento de inquilino",
        "file": "apps/api/src/modules/ops/ops-metrics.controller.ts",
        "lines": "35–49",
        "title": "Métricas de ops são da instância, não do tenant",
        "problem": (
            "GET /api/v1/ops/metrics exige OWNER/ADMIN da organização do JWT, "
            "mas devolve filas BullMQ compartilhadas, HTTP agregado do processo, "
            "pid, uptime e memória. Não há filtro por organizationId."
        ),
        "why": (
            "Qualquer OWNER/ADMIN de qualquer tenant autenticado lê telemetria "
            "da plataforma (profundidade de filas globais, erros 5xx da instância). "
            "Não devolve payloads de jobs nem PII de outro tenant."
        ),
        "impact": "Reconhecimento de infra e volume global. Sem leitura de CRM alheio.",
        "fix": (
            "Restringir a um papel de plataforma, IP allowlist, ou métricas "
            "agregadas só do tenant. Não expor pid/memória a clientes."
        ),
        "accept": [
            "OWNER de tenant cliente não obtém profundidade global das filas",
            "Operador autorizado ainda consegue health/ops",
        ],
        "snippet": "@Get()\n@Roles('OWNER', 'ADMIN')\nasync getMetrics() {\n  const queues = await this.collectQueueDepths();\n  ...\n  return { process, http, jobs, queues, redis };\n}",
        "cross": [
            "apps/api/src/modules/ops/metrics.service.ts:108–119",
            "apps/api/src/modules/ops/ops-metrics.controller.ts:66–98",
        ],
        "issue_title": "[Segurança] /ops/metrics expõe telemetria da instância a qualquer admin de tenant",
    },
    {
        "id": "AUD-003",
        "sev": "baixa",
        "cat": "Chaves expostas (defaults)",
        "file": "docker-compose.yml",
        "lines": "7–10, 49",
        "title": "Senha default do Postgres no compose local",
        "problem": (
            "POSTGRES_PASSWORD:-prospectly (e o mesmo valor em DATABASE_URL do serviço api). "
            "Portas bound a 127.0.0.1. Comentário avisa uso só local."
        ),
        "why": (
            "Explorável só se o compose for publicado em host compartilhado sem sobrescrever "
            "o env. Produção no Render não usa esse default; validateEnv exige JWT e "
            "DATABASE_APP_URL em production/staging."
        ),
        "impact": "Acesso local ao banco se a porta vazar ou o default for copiado para ambiente compartilhado.",
        "fix": "Falhar o compose se POSTGRES_PASSWORD estiver vazio ou igual a prospectly fora de um perfil explicitamente local.",
        "accept": [
            "Perfil local documentado continua funcionando com senha explícita",
            "Default prospectly não sobe em ambiente compartilhado",
        ],
        "snippet": "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-prospectly}\nDATABASE_URL: postgresql://${POSTGRES_USER:-prospectly}:${POSTGRES_PASSWORD:-prospectly}@postgres:5432/...",
        "cross": [
            ".env.example:6–8",
            "apps/api/src/config/validation.ts:4,14–27,42–49",
        ],
        "issue_title": "[Segurança] Default prospectly/prospectly no docker-compose local",
    },
]

STRENGTHS = [
    (
        "Isolamento multi-tenant em três camadas",
        "CurrentOrg lê só request.user.organizationId (JWT). Prisma assertTenantOperation "
        "injeta/valida organizationId. Postgres FORCE ROW LEVEL SECURITY + role prospectly_app "
        "sem BYPASSRLS (DATABASE_APP_URL obrigatório em production).",
    ),
    (
        "IDOR por ID: handlers percorridos",
        "Os 22 controllers da API usam CurrentOrg + findFirst({ id, organizationId }) "
        "(ou equivalente: pipeline.organizationId, importId após requireImport, "
        "candidateId+runId após requireRun). switchOrganization exige membership "
        "userId+organizationId. DSR e membros usam id + organizationId.",
    ),
    (
        "JWT e papéis nas escritas privilegiadas",
        "APP_GUARD JwtAuthGuard + RolesGuard. Invite/role/remove member, billing checkout/"
        "profile/cancel, plugin tokens, scoring PATCH, export CSV e mutações de leads "
        "têm @Roles alinhado à UI canManageOrg.",
    ),
    (
        "Segredos de runtime",
        "JWT via getOrThrow + validateEnv (mín. 32 chars; placeholder bloqueado em prod). "
        "Histórico git: ocorrências de AKIA só no regex do secret-scan. Sem sk_live_/chaves "
        "privadas commitadas. Plugin token armazenado como hash SHA-256.",
    ),
    (
        "XSS",
        "Sem innerHTML de dado de usuário. JSON-LD estático com escape de <. E-mails com "
        "escapeHtml. Preview de campanha em <pre>. sanitizeAvatarSrc / sanitizeExternalUrl / "
        "sanitizeMailtoHref. wa.me só com dígitos (replace /\\D/g). Sem lib markdown.",
    ),
]

WEAKNESSES = [
    "RolesGuard é fail-open: handler sem @Roles = qualquer membro autenticado, inclusive VIEWER. "
    "Isso é coerente com leituras de CRM, mas furado em GET /integrations.",
    "$queryRaw/$executeRaw no Prisma extension não aplicam GUC de RLS (tenant-prisma.ts:68–70). "
    "O gráfico de score do dashboard filtra organizationId no SQL. Em DATABASE_APP_URL a RLS "
    "sem GUC falha fechada. Risco residual se alguém adicionar raw SQL sem filtro no role owner.",
    "Rotas @Public() rodam runWithBypass. Correto para login/webhook/waitlist; qualquer query "
    "de tabela tenant nesses handlers perderia a rede RLS.",
    "Secret do webhook Abacate aceito também na query string (vazamento em access logs/proxies).",
]

CONTROLLERS_OK = [
    "auth.controller — switchOrganization valida membership; rotas públicas são auth.",
    "users.controller — /me pelo JWT; DSR por organizationId + @Roles OWNER.",
    "organizations.controller — memberId + organizationId; @Roles OWNER/ADMIN nas escritas.",
    "leads.controller — get/update/delete com organizationId; export com @Roles.",
    "prospecting.controller — requireSearch(organizationId, id).",
    "campaigns.controller — requireCampaign; addLeads recusa leadIds de outra org.",
    "templates.controller — get(organizationId, id).",
    "pipelines.controller — stage via pipeline.organizationId.",
    "tasks.controller — findFirst id+organizationId.",
    "activities.controller — assertLead(organizationId, leadId).",
    "imports.controller — requireImport; erros só após o import do tenant.",
    "opportunity-finder.controller — requireRun; candidate id+runId.",
    "agents.controller — loadLead(organizationId, leadId).",
    "billing.controller — CurrentOrg; checkout/profile com @Roles; webhooks @Public com secret.",
    "dashboard.controller — CurrentOrg em summary/charts.",
    "privacy.controller — user.id do JWT (export/erasure do próprio titular).",
    "scoring.controller — PATCH @Roles OWNER/ADMIN.",
    "geo.controller — dados de referência, JWT, sem recurso por id de tenant.",
    "waitlist/health — públicos, sem objeto de tenant.",
]

ISSUES = [
    {
        "n": 1,
        "title": FINDINGS[0]["issue_title"],
        "labels": "security, alta",
        "body": """## Problema
A aba Integrações some na UI para papéis que não são OWNER/ADMIN (`canManageOrg`), mas `GET /api/v1/integrations` não tem `@Roles`. O `RolesGuard` retorna `true` quando o metadata de papéis está vazio. A serialização devolve `url` do webhook.

## Por que é explorável
Um utilizador VIEWER/MEMBER/SALES com JWT válido (convite real) chama o endpoint e lê a URL de webhook da organização. Se o admin colou um token na query da URL, esse segredo vaza. Não atravessa tenant: `CurrentOrg` continua a vir do JWT.

## Evidência
```ts
// apps/api/src/modules/integrations/integrations.controller.ts:22-25
@Get()
list(@CurrentOrg() organizationId: string) {
  return this.integrations.list(organizationId);
}
```

```ts
// apps/api/src/common/guards/roles.guard.ts:34-36
if (!requiredRoles || requiredRoles.length === 0) {
  return true;
}
```

Cruzamento UI: `can-manage-org.ts:3-4`, `settings-shell.tsx:39-41` (`adminOnly`), `integrations-settings-card.tsx:74` (`if (!canManage) return null`).

POST `/integrations/webhook` e tokens de plugin **já** usam `@Roles('OWNER', 'ADMIN')`.

## Impacto
Leitura não autorizada da URL de integração (e de qualquer segredo nela). Sem IDOR entre organizações.

## Correção sugerida
Adicionar `@Roles('OWNER', 'ADMIN')` em `GET /integrations`. Teste: VIEWER → 403; OWNER do mesmo tenant → 200; token do tenant B → 404/lista vazia.

## Critérios de aceite
- [ ] VIEWER recebe 403 em `GET /api/v1/integrations`
- [ ] OWNER/ADMIN lista só o webhook do próprio `organizationId`
- [ ] Regressão: upsert webhook e plugin tokens continuam 403 para MEMBER
""",
    },
    {
        "n": 2,
        "title": FINDINGS[1]["issue_title"],
        "labels": "security, media",
        "body": """## Problema
`GET /api/v1/ops/metrics` está autenticado com `@Roles('OWNER', 'ADMIN')` **do tenant do JWT**, mas o payload é da instância inteira: `Queue.getJobCounts` das filas globais BullMQ, snapshot HTTP do processo, pid, RSS/heap, ping Redis.

## Por que é explorável
Qualquer OWNER/ADMIN de um tenant cliente (não um operador de plataforma) obtém volume de filas de **todos** os tenants que partilham o processo. Não há `organizationId` nas contagens.

## Evidência
```ts
// apps/api/src/modules/ops/ops-metrics.controller.ts:35-48
@Get()
@Roles('OWNER', 'ADMIN')
async getMetrics() {
  const queues = await this.collectQueueDepths();
  ...
  return { process, http, jobs, queues, redis };
}
```

`getProcessSnapshot()` em `metrics.service.ts:108-119` inclui pid e memória.

## Impacto
Reconhecimento de capacidade e carga da plataforma. Sem PII de outro tenant nas contagens.

## Correção sugerida
1. Papel/segredo de plataforma (não role de tenant), ou
2. Não expor este controller na API pública, ou
3. Métricas só do tenant (jobs com `organizationId` no payload, sem pid).

## Critérios de aceite
- [ ] OWNER de tenant de cliente não lê profundidade global das filas
- [ ] Operação interna ainda consegue health da API (`/health/ready` permanece público e mínimo)
""",
    },
    {
        "n": 3,
        "title": FINDINGS[2]["issue_title"],
        "labels": "security, baixa",
        "body": """## Problema
`docker-compose.yml` usa `${POSTGRES_PASSWORD:-prospectly}` e monta `DATABASE_URL` com o mesmo default. Portas em `127.0.0.1`.

## Por que é explorável
Só se o compose for usado em host compartilhado/remoto sem sobrescrever a senha. Não é o caminho Render (secrets no dashboard). `validateEnv` já rejeita JWT fraco e exige `DATABASE_APP_URL` em production.

## Evidência
```yaml
# docker-compose.yml:7-10
POSTGRES_USER: ${POSTGRES_USER:-prospectly}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-prospectly}
```

## Impacto
Acesso ao Postgres de desenvolvimento se o default vazar para um ambiente não local.

## Correção sugerida
Exigir `POSTGRES_PASSWORD` explícito, ou recusar o valor `prospectly` fora de um profile `local`.

## Critérios de aceite
- [ ] Compose local documentado com senha explícita
- [ ] Default `prospectly` não é usado em ambiente compartilhado
""",
    },
]


def sev_label(key: str) -> str:
    return {"critica": "Crítica", "alta": "Alta", "media": "Média", "baixa": "Baixa", "info": "Informativa"}[key]


def make_charts() -> tuple[Path, Path]:
    CHARTS.mkdir(exist_ok=True)
    counts = Counter(f["sev"] for f in FINDINGS)
    order = ["critica", "alta", "media", "baixa"]
    sizes = [counts.get(k, 0) for k in order]
    labels = [sev_label(k) for k in order]
    colors_list = [PALETTE[k] for k in order]
    # hide zeros in donut legend but keep slice
    fig, ax = plt.subplots(figsize=(5.2, 3.6), dpi=140)
    non_zero = [(s, l, c) for s, l, c in zip(sizes, labels, colors_list) if s > 0]
    ax.pie(
        [x[0] for x in non_zero],
        labels=[f"{x[1]} ({x[0]})" for x in non_zero],
        colors=[x[2] for x in non_zero],
        startangle=90,
        wedgeprops=dict(width=0.45, edgecolor="white"),
        textprops={"fontsize": 9, "color": PALETTE["ink"]},
    )
    ax.set_title("Achados por severidade", fontsize=11, color=PALETTE["ink"], pad=8)
    fig.tight_layout()
    donut = CHARTS / "donut.png"
    fig.savefig(donut, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    cat_counts = Counter(f["cat"] for f in FINDINGS)
    fig, ax = plt.subplots(figsize=(5.6, 3.6), dpi=140)
    cats = list(cat_counts.keys())
    vals = [cat_counts[c] for c in cats]
    bar_colors = [PALETTE["alta"], PALETTE["media"], PALETTE["baixa"]][: len(cats)]
    ax.barh(cats, vals, color=bar_colors, height=0.55)
    ax.set_xlabel("Quantidade", fontsize=9, color=PALETTE["muted"])
    ax.set_title("Achados por categoria", fontsize=11, color=PALETTE["ink"], pad=8)
    ax.tick_params(colors=PALETTE["ink"], labelsize=8)
    ax.set_xlim(0, max(vals) + 0.8)
    for i, v in enumerate(vals):
        ax.text(v + 0.05, i, str(v), va="center", fontsize=9, color=PALETTE["ink"])
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    bars = CHARTS / "bars.png"
    fig.savefig(bars, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return donut, bars


def styles():
    base = getSampleStyleSheet()
    s = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor(PALETTE["forte"]),
            tracking=1.2,
            spaceAfter=8,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor(PALETTE["ink"]),
            alignment=TA_LEFT,
            spaceAfter=12,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor(PALETTE["ink"]),
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor(PALETTE["ink"]),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor(PALETTE["ink"]),
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(PALETTE["muted"]),
            spaceAfter=4,
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(PALETTE["ink"]),
        ),
        "cell_bold": ParagraphStyle(
            "cell_bold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#FFFFFF"),
            alignment=TA_CENTER,
        ),
        "chip": ParagraphStyle(
            "chip",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "code": ParagraphStyle(
            "code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=7.2,
            leading=9.5,
            textColor=colors.HexColor(PALETTE["ink"]),
            backColor=colors.HexColor("#F1F5F9"),
            leftIndent=4,
            rightIndent=4,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "issue": ParagraphStyle(
            "issue",
            parent=base["Code"],
            fontName="Courier",
            fontSize=6.6,
            leading=8.8,
            textColor=colors.HexColor(PALETTE["ink"]),
        ),
    }
    return s


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(colors.HexColor(PALETTE["ink"]))
    canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, h - 7.5 * mm, "Relatório de Auditoria de Segurança — Prospectly")
    canvas.setFillColor(colors.HexColor(PALETTE["line"]))
    canvas.rect(0, 0, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor(PALETTE["muted"]))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, 5 * mm, "Confidencial — uso interno  ·  cinco categorias mapeadas à stack NestJS")
    canvas.drawRightString(w - 2 * cm, 5 * mm, f"Página {doc.page}")
    canvas.restoreState()


def cover_header_footer(canvas, doc):
    header_footer(canvas, doc)


def wrap_pre(text: str, width: int = 96) -> str:
    lines: list[str] = []
    for raw in text.splitlines():
        if len(raw) <= width:
            lines.append(raw if raw else " ")
            continue
        rest = raw
        while len(rest) > width:
            cut = rest.rfind(" ", 0, width)
            if cut < 40:
                cut = width
            lines.append(rest[:cut])
            rest = rest[cut:].lstrip()
        if rest:
            lines.append(rest)
    return "\n".join(lines)


def chip_table(sev: str, st) -> Table:
    label = sev_label(sev).upper()
    bg = colors.HexColor(PALETTE[sev])
    inner = Table([[Paragraph(label, st["chip"])]], colWidths=[28 * mm])
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ]
        )
    )
    return inner


def build():
    donut, bars = make_charts()
    st = styles()
    story = []

    story.append(Paragraph("AUDITORIA TÉCNICA  ·  NÃO É PARECER JURÍDICO", st["cover_kicker"]))
    story.append(Paragraph("Relatório de Auditoria de Segurança — Prospectly", st["cover_title"]))
    story.append(
        Paragraph(
            f"<b>Data:</b> {date.today().isoformat()} &nbsp;&nbsp; "
            f"<b>Escopo:</b> código em <font face='Courier'>apps/api</font>, "
            f"<font face='Courier'>apps/web</font>, <font face='Courier'>apps/landing</font>, "
            f"Prisma/migrations, Docker, Render Blueprint, GitHub Actions, histórico git.",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Nota metodológica.</b> Stack detectada: monorepo pnpm, API NestJS  + Passport JWT, "
            "Prisma/PostgreSQL com RLS FORCE e guard de tenant em ALS, filas BullMQ/Redis, "
            "SPA React/Vite, landing Next.js, auth Argon2 + refresh HttpOnly. "
            "As cinco categorias foram traduzidas assim: (1) isolamento = RLS + interceptor + "
            "filtro <font face='Courier'>organizationId</font> do JWT — equivalente a “banco sem tranca”; "
            "(2) RBAC no servidor vs <font face='Courier'>canManageOrg</font> no React; "
            "(3) IDOR = todos os <font face='Courier'>*.controller.ts</font> da API (22 ficheiros), "
            "não amostra; (4) segredos em código, compose, <font face='Courier'>.env.example</font>, "
            "CI e <font face='Courier'>git log -S</font>; (5) XSS = "
            "<font face='Courier'>dangerouslySetInnerHTML</font>/href/src e HTML de e-mail. "
            "Só entram achados reproduzíveis no código. Ausência de categoria é reportada, não inventada.",
            st["body"],
        )
    )

    story.append(Paragraph("1. Resumo executivo", st["h1"]))
    counts = Counter(f["sev"] for f in FINDINGS)
    story.append(
        Paragraph(
            f"Total de achados exploráveis: <b>{len(FINDINGS)}</b> "
            f"(crítica {counts.get('critica', 0)}, alta {counts.get('alta', 0)}, "
            f"média {counts.get('media', 0)}, baixa {counts.get('baixa', 0)}). "
            f"IDOR entre tenants: <b>nenhum</b> verificado. XSS armazenado/refletido: <b>nenhum</b> verificado. "
            f"Segredo de produção commitado: <b>nenhum</b>.",
            st["body"],
        )
    )
    img_row = Table(
        [[Image(str(donut), width=8.2 * cm, height=5.5 * cm), Image(str(bars), width=8.2 * cm, height=5.5 * cm)]],
        colWidths=[8.5 * cm, 8.5 * cm],
    )
    img_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(img_row)

    story.append(Paragraph("2. Pontos fortes", st["h1"]))
    for title, text in STRENGTHS:
        story.append(Paragraph(f"<font color='{PALETTE['forte']}'><b>▶ {title}</b></font>", st["h2"]))
        story.append(Paragraph(text, st["body"]))

    story.append(Paragraph("3. Pontos fracos (risco residual)", st["h1"]))
    for w in WEAKNESSES:
        story.append(Paragraph(f"• {w}", st["body"]))

    story.append(Paragraph("4. Tabela de achados", st["h1"]))
    header = [
        Paragraph("Sev.", st["cell_bold"]),
        Paragraph("ID / ficheiro:linha", st["cell_bold"]),
        Paragraph("Descrição", st["cell_bold"]),
    ]
    rows = [header]
    for f in FINDINGS:
        loc = Paragraph(f"<b>{f['id']}</b><br/>{f['file']}:{f['lines']}", st["cell"])
        desc = Paragraph(f"<b>{f['title']}</b><br/>{f['problem']}", st["cell"])
        rows.append([chip_table(f["sev"], st), loc, desc])
    table = Table(rows, colWidths=[3.0 * cm, 6.2 * cm, 7.8 * cm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(PALETTE["ink"])),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor(PALETTE["band"])),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor(PALETTE["line"])),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)

    story.append(Paragraph("5. Achados detalhados", st["h1"]))
    for f in FINDINGS:
        block = [
            Paragraph(f"{f['id']} — {f['title']}", st["h2"]),
            Paragraph(
                f"Severidade: <b>{sev_label(f['sev'])}</b> · Categoria: {f['cat']} · "
                f"<font face='Courier'>{f['file']}:{f['lines']}</font>",
                st["small"],
            ),
            Paragraph(f"<b>Problema.</b> {f['problem']}", st["body"]),
            Paragraph(f"<b>Por que é explorável.</b> {f['why']}", st["body"]),
            Paragraph(f"<b>Impacto.</b> {f['impact']}", st["body"]),
            Paragraph("<b>Trecho:</b>", st["small"]),
            Preformatted(f["snippet"], st["code"]),
            Paragraph("<b>Cruzamento:</b> " + "; ".join(f["cross"]), st["small"]),
            Paragraph(f"<b>Correção.</b> {f['fix']}", st["body"]),
        ]
        story.append(KeepTogether(block))

    story.append(Paragraph("6. Cobertura IDOR (todos os controllers)", st["h1"]))
    story.append(
        Paragraph(
            "Percorridos os 22 <font face='Courier'>*.controller.ts</font> em "
            "<font face='Courier'>apps/api</font>. Nenhum handler de recurso por UUID "
            "foi encontrado sem amarrar o objeto ao tenant do JWT (ou, em privacidade, ao "
            "<font face='Courier'>user.id</font> do token).",
            st["body"],
        )
    )
    for line in CONTROLLERS_OK:
        story.append(Paragraph(f"• {line}", st["small"]))

    story.append(Paragraph("7. Categorias sem achado explorável", st["h1"]))
    story.append(
        Paragraph(
            "<b>IDOR (cat. 3).</b> Sem caso em que o ID de outro tenant devolva 200. "
            "Leituras de CRM sem @Roles (VIEWER vê leads) são papel de produto, não IDOR: "
            "o frontend também expõe essas páginas a qualquer membro autenticado.",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>XSS (cat. 5).</b> Landing usa <font face='Courier'>dangerouslySetInnerHTML</font> "
            "só em JSON-LD estático com <font face='Courier'>&lt;</font> escapado "
            "(<font face='Courier'>apps/landing/src/app/layout.tsx:87–90</font>). "
            "Não há renderização de markdown de utilizador. HTML de e-mail de reset e waitlist "
            "passa por <font face='Courier'>escapeHtml</font>.",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Chaves hardcoded de produção (cat. 4).</b> Não foram encontradas API keys, "
            "JWT ou chaves privadas reais no tree. A constante HMAC da AbacatePay é a chave "
            "<i>pública</i> documentada pelo fornecedor; o segredo do webhook continua a ser "
            "<font face='Courier'>ABACATE_WEBHOOK_SECRET</font>. Client ID Google no bundle Vite "
            "é identificador OAuth público, não um segredo.",
            st["body"],
        )
    )

    story.append(Paragraph("8. Recomendações priorizadas", st["h1"]))
    recs = [
        "<b>P1.</b> @Roles('OWNER','ADMIN') em GET /integrations + teste de regressão VIEWER.",
        "<b>P2.</b> Isolar /ops/metrics (papel de plataforma ou remover da API de clientes).",
        "<b>P3.</b> Recusar senha default do Postgres fora do perfil local.",
        "<b>P4.</b> Aplicar GUC de RLS também em $queryRaw (fail-closed já existe no role app).",
        "<b>P5.</b> Preferir header ao secret de webhook Abacate na query string.",
    ]
    for r in recs:
        story.append(Paragraph(r, st["body"]))

    story.append(PageBreak())
    story.append(Paragraph("ISSUES PARA O GITHUB", st["h1"]))
    story.append(
        Paragraph(
            "Copiar cada bloco entre os delimitadores para uma issue nova. Labels sugeridas em cada bloco.",
            st["small"],
        )
    )
    for issue in ISSUES:
        md = (
            f"--- ISSUE {issue['n']} ---\n"
            f"# {issue['title']}\n\n"
            f"Labels sugeridas: `{issue['labels']}`\n\n"
            f"{issue['body'].strip()}\n"
            f"--- FIM ISSUE {issue['n']} ---"
        )
        story.append(Paragraph(f"Issue {issue['n']}", st["h2"]))
        story.append(Preformatted(wrap_pre(md), st["issue"]))

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.6 * cm,
        bottomMargin=2.2 * cm,
        title="Relatório de Auditoria de Segurança — Prospectly",
        author="Auditoria técnica Prospectly",
    )
    doc.build(story, onFirstPage=cover_header_footer, onLaterPages=header_footer)
    return OUTPUT


def raster_preview(pdf_path: Path) -> list[Path]:
    import fitz

    out_dir = ROOT / "_preview"
    out_dir.mkdir(exist_ok=True)
    doc = fitz.open(pdf_path)
    paths = []
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        p = out_dir / f"pagina-{i:02d}.png"
        pix.save(str(p))
        paths.append(p)
    return paths


if __name__ == "__main__":
    pdf = build()
    pages = raster_preview(pdf)
    print(f"PDF: {pdf}")
    print(f"Páginas: {len(pages)}")
    for p in pages:
        print(p)
