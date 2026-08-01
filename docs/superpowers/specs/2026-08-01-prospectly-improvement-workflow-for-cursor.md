# Prospectly — workflow de melhoria para o Cursor

> Estado: pronto para execução incremental  
> Escopo: `apps/web`, `apps/api`, `apps/landing`, `packages/*`, infraestrutura e CI  
> Regra central: **uma fase por branch/PR**. Não misturar correção de segurança, feature comercial e mudança de infraestrutura no mesmo diff.

## Resultado esperado

Evoluir a Prospectly de um MVP que encontra e organiza empresas locais para uma plataforma que fecha o ciclo:

```text
ICP -> descoberta confiável -> qualificação explicável -> próxima ação
    -> outreach consentido -> resposta/reunião -> aprendizado por conversão
```

As prioridades são, nesta ordem:

1. não bloquear nem perder o acesso do usuário;
2. corrigir risco de produção e tornar a entrega confiável;
3. elevar qualidade, velocidade e acessibilidade do app;
4. melhorar qualidade e explicação dos leads;
5. implementar o ciclo comercial e a escala operacional.

## Contexto confirmado no checkout

- `apps/web`: React/Vite, CRM, pesquisas, leads, pipeline, tarefas e dashboard.
- `apps/api`: NestJS, Prisma, PostgreSQL, Redis e BullMQ.
- `apps/landing`: Next.js, site comercial e waitlist.
- Processadores BullMQ de prospecção, CSV, scoring e análise de website estão no processo HTTP da API.
- `Campaign`, `CampaignLead`, `MessageTemplate` e `Integration` existem no Prisma, mas ainda não têm módulo, controller ou tela funcional.
- A aplicação possui um modelo de `AuditLog`, mas ainda não o grava.
- A recuperação de senha gera token, porém não envia o e-mail.
- O CI executa testes, build e audit; atualmente o teste web precisa ser corrigido e advisories `high` ainda não bloqueiam o pipeline.

## Contrato de execução para o Cursor

Antes de qualquer fase, o Cursor deve:

1. Ler `AGENTS.md`, este documento, `README.md`, `render.yaml` e a configuração de CI.
2. Executar `git status --short` e preservar todas as mudanças existentes, especialmente as da landing.
3. Confirmar a estrutura atual com `rg --files apps/api/src apps/web/src apps/landing/src` em vez de assumir caminhos antigos.
4. Criar branch `codex/<fase>-<resumo>` ou seguir o padrão de branch definido pelo repositório.
5. Fazer apenas mudanças necessárias à fase atual.
6. Adicionar ou ajustar testes de regressão antes de declarar a fase concluída.
7. Rodar as validações aplicáveis e informar resultado, limitações de ambiente e arquivos modificados.

O Cursor não deve:

- usar `git reset --hard`, checkout destrutivo ou apagar mudanças de outra pessoa;
- aplicar migrations, cobrar pagamentos, enviar campanhas ou alterar Render/Stripe/Google Cloud sem autorização explícita;
- substituir `NO_WEBSITE_REPORTED` por “empresa sem site” como se fosse certeza;
- ativar telemetria ou rastreio de marketing sem decisão explícita de privacidade;
- criar e-mail automatizado de prospecção sem suppression list, opt-out e limites de envio.

### Comandos de validação padrão

```bash
pnpm lint
pnpm typecheck
pnpm --filter @prospectly/api test
pnpm --filter @prospectly/web test
pnpm build
pnpm audit --audit-level=high
git diff --check
git status --short
```

Se testes HTTP falharem apenas com `listen EPERM`, reportar a restrição do sandbox e repetir somente com socket local autorizado. Não chamar isso de falha do código sem essa confirmação.

## Fase 0 — liberar uma entrega segura

### 0.1 Recuperação de senha funcional

**Problema:** `AuthService.forgotPassword` cria o token e somente registra o pedido em log.

**Implementar:**

- Criar template de e-mail de redefinição contendo URL pública configurável e token de uso único.
- Enviar pelo `MailService`; se o provedor não estiver configurado em produção, falhar de forma observável, sem expor token e sem confirmar existência da conta.
- Criar página web de redefinição de senha e fluxo de sucesso/erro/expiração.
- Invalidar sessões existentes após redefinição, preservando o comportamento já existente.
- Adicionar rate limit e testes para envio, token expirado, token reutilizado e enumeração de conta.

**Critérios de aceite:**

- Um usuário de senha consegue recuperar acesso sem intervenção humana.
- O token não aparece em log, resposta HTTP ou observabilidade.
- E-mail inexistente recebe resposta genérica e não envia e-mail.
- API e web possuem testes verdes para o fluxo.

### 0.2 Restaurar CI verde

**Problema:** o teste de login não monta `GoogleOAuthProvider`; o teste de busca vê as versões mobile e desktop porque o CSS está desabilitado no ambiente de teste.

**Implementar:**

- Criar helper de renderização de testes com `QueryClientProvider`, router, i18n e provider Google quando necessário.
- Para o teste de busca, testar a intenção sem depender de CSS responsivo: mockar o componente Google/CSS ou usar query compatível com as duas representações.
- Revisar se há outros testes que dependem implicitamente de variáveis `VITE_*`.
- Corrigir a configuração `ts-jest` para eliminar o aviso recorrente de `isolatedModules`, sem reduzir checagem de tipo da CI.

**Critérios de aceite:**

```bash
pnpm test
```

passa integralmente no CI e localmente, sem warnings repetidos do `ts-jest`.

### 0.3 Corrigir vulnerabilidades de runtime e endurecer a CI

**Problema:** o audit atual tem advisories altas, incluindo Multer no caminho de upload de CSV, Next/Sharp/PostCSS na landing e React Router. A exceção de CI não distingue adequadamente runtime de toolchain.

**Implementar:**

- Atualizar dependências diretas compatíveis que resolvam vulnerabilidades runtime, começando por `@nestjs/platform-express`/Multer e Next.
- Avaliar React Router: a aplicação web é SPA Vite e não usa RSC; documentar aplicabilidade, atualizar quando compatível e não silenciar o alerta sem evidência.
- Usar `pnpm.overrides` apenas para transitivas sem upgrade direto seguro; comentar motivo, advisory e plano de remoção.
- Atualizar `docs/security/audit-exceptions.md` com data, cadeia, risco residual, dono e data de expiração de cada exceção.
- Fazer o CI falhar em `high` para runtime. Exceções temporárias devem ser explícitas e revisáveis, nunca um `continue-on-error` global permanente.

**Critérios de aceite:**

- Nenhum advisory `critical` ou `high` de dependência que entre em produção fica sem mitigação documentada.
- Upload CSV continua com limite de arquivo, um arquivo por request e testes de importação verdes.
- Nenhuma atualização usa `--force` sem justificar impacto e rollback.

### 0.4 Imagem de produção e migrations controladas

**Problema:** o Dockerfile copia `node_modules` completo para o runner, incluindo CLI/testes; também executa `prisma migrate deploy` a cada início da API.

**Implementar:**

- Separar stage de build de stage runtime com dependências mínimas de produção.
- Definir uma estratégia explícita de migration: job de release único ou etapa de deploy, nunca vários pods web concorrendo para migrar.
- Manter health checks `live` e `ready`; confirmar que readiness verifica PostgreSQL e Redis.
- Documentar rollout, rollback e compatibilidade de migration expand/contract.

**Decisão que exige aprovação antes de aplicar:** formato do job de migration e alteração de `render.yaml`/Render.

## Fase 1 — experiência, desempenho e observabilidade

### 1.1 App rápido e resiliente

**Problemas:** bundle inicial grande, páginas não usam lazy loading, não há error boundary ou captura efetiva de erros.

**Implementar:**

- Usar `React.lazy`/`Suspense` para rotas pesadas: dashboard, importação, settings e billing.
- Separar manual chunks apenas quando a medição justificar; não fragmentar dependências pequenas sem ganho real.
- Criar `AppErrorBoundary` com recuperação, correlation ID e ação de tentar novamente.
- Inicializar Sentry apenas se `SENTRY_DSN` existir; redigir PII e tokens; não enviar conteúdo de leads por padrão.
- Medir Web Vitals e erros de rota com coleta mínima e consentimento apropriado.

**Landing:** carregar o globo Three.js após visibilidade/idle ou interação e manter fallback estático acessível para mobile, WebGL indisponível e `prefers-reduced-motion`.

**Critérios de aceite:**

- Comparar tamanho gzip de build antes/depois e registrar a melhoria.
- Uma falha de componente não deixa página branca.
- Fluxos críticos continuam navegáveis sem WebGL e sem JavaScript de animação.

### 1.2 Pipeline acessível e escalável

**Problemas:** drag-and-drop nativo não resolve teclado/touch; backend limita cada coluna a 100 leads sem informar o usuário.

**Implementar:**

- Manter drag-and-drop como atalho, mas adicionar ação por teclado/touch: botão “Mover para etapa” com menu de etapas.
- Anunciar mudança de etapa por região `aria-live` e manter foco previsível.
- Exibir total por coluna e implementar paginação ou virtualização, sem esconder leads após o centésimo registro.
- Incluir teste de teclado e teste de autorização de mudança de estágio.

**Critérios de aceite:** um usuário sem mouse move lead entre etapas; uma organização com mais de 100 leads por coluna sabe que há mais registros e consegue acessá-los.

### 1.3 Operação mensurável

**Implementar:**

- Adicionar métricas autenticadas/privadas para HTTP, erro, duração de jobs, falhas/retries, profundidade das filas e uso de conexões.
- Criar dashboard/alertas operacionais antes de autoscaling.
- Propagar `correlationId` de HTTP para jobs, logs e erro externo.
- Criar runbook curto para fila presa, Redis indisponível, falha de provider e rollback.

**Não expor:** métricas, stack traces, dados de leads ou IDs internos em rota pública.

## Fase 2 — qualidade de dados e priorização

### 2.1 Proveniência e confiança do lead

**Implementar:**

- Adicionar origem, `collectedAt`, `lastVerifiedAt`, nível de confiança e motivo do status de website.
- Manter `NO_WEBSITE_REPORTED` como observação de fonte, nunca como prova de ausência de site.
- Exibir no app fonte, data de coleta, dados ausentes e ação “verificar/enriquecer”.
- Definir retenção e atualização por provedor, respeitando termos de cada API.

### 2.2 Enriquecimento em duas etapas

**Implementar:**

1. Descoberta barata: OSM/Google Text Search cria candidatos.
2. Enriquecimento selecionado: usuário ou regra explícita solicita detalhes apenas de candidatos importados/prioritários.

- Para Google Places, buscar somente campos que geram decisão: status operacional, rating, contagem de avaliações, telefone, site e endereço.
- Exibir consumo estimado antes de uma ação paga e registrar provider/custo lógico no job.
- Criar provider interface para futuras fontes; não acoplar regras de negócio à resposta do Google.

### 2.3 Score explicável e sem limites silenciosos

**Implementar:**

- Separar score em `fit`, `opportunity` e `engagement`.
- Mostrar regras aplicadas, dados ausentes, versão do score e ação recomendada no detalhe do lead.
- Incluir sinais de comportamento quando existirem: atividade, resposta, reunião, proposta e ganho/perda.
- Paginar o recálculo além de 5.000 leads, processar em batches com concorrência controlada e mostrar progresso.
- Testar idempotência e uma organização maior que o limite anterior.

## Fase 3 — ciclo comercial que gera resultado

### 3.1 Cadências e campanhas, começando assistidas

Criar módulos independentes para `Campaign`, `MessageTemplate` e `Integration`:

```text
campaigns/
  domain/
  application/
  infrastructure/
  presentation/
```

**MVP recomendado:** cadências assistidas, não envio automático imediato.

- Templates com variáveis seguras e preview.
- Etapas de e-mail manual, ligação, WhatsApp e LinkedIn como tarefas.
- Regras de entrada/saída, frequência, dono e janela de contato.
- Métricas por etapa: entregue, resposta, interesse, reunião, proposta e ganho.
- A/B test somente depois de existir volume e eventos confiáveis.

**Guardrails obrigatórios antes de envio automático:**

- suppression list por e-mail/domínio/telefone;
- opt-out simples e imediato;
- limites por usuário/domínio/tenant;
- aprovação humana inicial;
- logs de mensagem, versão de template, finalidade e base legal;
- proteção contra envio duplicado e reprocessamento de job.

### 3.2 Integrações e exportação

- Exportar leads filtrados com colunas selecionáveis e registro de auditoria.
- Criar integração genérica por webhook primeiro; avaliar HubSpot/Pipedrive apenas depois de definir quais campos e eventos sincronizar.
- Usar outbox/idempotência para sync externo; nunca bloquear a UX aguardando CRM de terceiro.

### 3.3 Painel orientado à decisão

Adicionar filtros de período, origem, segmento, proprietário e campanha. Mostrar:

- conversão por origem/provedor/segmento;
- atividades e follow-ups atrasados;
- reuniões, propostas, ganhos e perdas;
- tempo entre etapas;
- desempenho de mensagens/cadências;
- valor estimado e receita real, apenas se o modelo comercial definir esses campos.

## Fase 4 — privacidade, auditoria e confiança

### 4.1 Audit log realmente utilizado

Registrar, com metadados mínimos e sem segredos:

- mudança de estágio, proprietário, tags e dados do lead;
- exportação, exclusão/restauração e importação;
- alterações de cobrança, membros e configurações;
- início/fim de campanhas e alterações de suppression.

Não registrar senha, token, corpo integral de e-mail, arquivo CSV nem PII desnecessária.

### 4.2 Solicitações de titulares e retenção

- Transformar o registro `PENDING` de exportação/exclusão em workflow administrativo auditável.
- Definir prazos por entidade, execução assíncrona, revisão quando aplicável e confirmação final ao titular.
- Criar inventário de subprocessadores, ROPA e decisão formal de legítimo interesse para dados de contato pessoais.
- Separar dados de conta do usuário, dados de empresas e dados de pessoas físicas associadas a empresas.

## Fase 5 — separar API e workers somente com evidência

**Pré-requisitos:** métricas da Fase 1 e medição de profundidade de fila, latência HTTP, CPU/memória, conexões PostgreSQL e concorrência por job.

**Implementar após aprovação de infraestrutura:**

- Criar entrypoint de worker sem listener HTTP.
- Mover processadores BullMQ para o worker; a API mantém apenas produtores e endpoints.
- Implementar graceful shutdown: parar intake, aguardar jobs dentro de timeout, fechar Redis/Prisma e registrar término.
- Atualizar Render para serviços distintos, mesma região e rede privada.
- Migrar banco em etapa única de release, não em cada processo web/worker.

**Critérios de aceite:** aumentar worker não aumenta réplicas HTTP; desligamento não perde jobs; falha de worker não torna a API indisponível.

## Prompt mestre para colar no Cursor

```text
Você é o engenheiro responsável pela evolução incremental do monorepo Prospectly.

Leia primeiro:
- AGENTS.md
- docs/superpowers/specs/2026-08-01-prospectly-improvement-workflow-for-cursor.md
- README.md
- render.yaml
- .github/workflows/ci.yml

Objetivo desta execução: implemente SOMENTE a fase [INFORMAR FASE E SUBITEM].

Regras obrigatórias:
1. Comece com `git status --short`; preserve todas as mudanças existentes.
2. Não faça reset, não altere credenciais, não rode migrations remotas, não envie e-mails/campanhas e não altere serviços externos.
3. Mantenha isolamento por `organizationId`, RBAC, validação de entrada, proteção SSRF e redaction de logs.
4. Para dados OSM, mantenha a semântica `NO_WEBSITE_REPORTED`; nunca alegue que a empresa comprovadamente não possui site.
5. Faça a menor mudança coesa possível. Não misture outras fases no mesmo diff.
6. Antes de editar, apresente: diagnóstico, arquivos prováveis, modelo de dados/API/UX afetado, riscos e plano de testes.
7. Adicione testes para comportamento novo e regressões relevantes.
8. Ao terminar, execute lint, typecheck, testes do escopo, build e `git diff --check`.
9. Se uma validação depender de socket, rede ou serviço externo indisponível, descreva o bloqueio e não invente resultado.
10. Termine com: resumo, arquivos alterados, decisões tomadas, testes executados/resultados, riscos restantes e próximo subitem recomendado.

Critério de pronto: todos os critérios de aceite da fase estão cumpridos e não há regressão em segurança, tenancy, acessibilidade ou privacidade.
```

## Ordem sugerida de PRs

1. `fix(auth): deliver password reset emails safely`
2. `test(web): restore complete CI coverage`
3. `security(deps): remediate runtime high advisories`
4. `build(api): minimize production image and isolate migrations`
5. `feat(web): add resilient lazy routes and error boundary`
6. `feat(pipeline): make stage movement accessible and paginated`
7. `feat(observability): add private operational metrics and runbooks`
8. `feat(leads): add provenance and selective enrichment`
9. `feat(scoring): add explainable fit and opportunity scoring`
10. `feat(campaigns): introduce assisted outreach workflows`
11. `feat(compliance): operationalize audit and data-subject requests`
12. `infra(workers): split BullMQ processing after metric gate`
