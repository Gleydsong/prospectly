# Revisão — Task 7: segurança cross-module e integração

**Veredito: APPROVED**

Escopo conferido: Global Constraints, Task 7, design, relatório da task, duas
suítes de integração HTTP, correções decorrentes, README, docker-compose,
migrations, scans e gates de release. Esta revisão não alterou código de produção.

## Gate 1 — Segurança e contrato

**Aprovado.** As suítes iniciam uma aplicação Nest real com versionamento, pipes,
decorators e RolesGuard, mantendo Prisma, fila, provider e ingestão como doubles
determinísticos. Elas verificam que VIEWER não alcança persistência/enqueue,
UUID inválido falha antes da consulta e recurso de organização externa retorna 404.

A importação seletiva é idempotente. No fluxo CSV, o upload multipart atravessa
FileInterceptor e DTO; o mapping JSON válido passou a ser aceito e a validação
defensiva de chave, tipo e conteúdo permanece no serviço antes de persistir ou
enfileirar.

A correção de worker está correta: process usa organizationId e userId do Import
persistido, derivado originalmente do JWT, em vez da identidade mutável no payload
BullMQ. O teste adultera o payload e confirma ingestão no tenant/ator autoritativo
e contadores estáveis na reexecução.

## Gate 2 — Qualidade, documentação e evidência

**Aprovado.** Os testes cobrem RBAC, isolamento, UUID, idempotência, falha
sanitizada de provider, multipart e reexecução CSV. Não realizam rede, Redis,
PostgreSQL ou OSM reais.

README documenta Redis/BullMQ, variáveis, APIs, polling, formato/mapping CSV,
importação parcial, semântica de ausência de website e limites operacionais dos
serviços públicos. As orientações sobre Nominatim (1 requisição por segundo,
User-Agent e atribuição) e Overpass foram conferidas nas fontes oficiais.

O scan não encontrou chave privada nem token real. Ocorrências de strings secretas
estão limitadas a fixtures de sanitização. Arquivos gerados permanecem ignorados.

## Verificação executada

    pnpm test
    PASS: API 14 suítes / 118 testes; Web 9 arquivos / 29 testes
    TOTAL: 147 testes, 0 falhas

    pnpm typecheck
    PASS

    pnpm lint
    PASS

    pnpm build
    PASS

    pnpm --filter @prospectly/api exec prisma validate
    PASS

    pnpm --filter @prospectly/api exec prisma generate
    PASS

A suíte HTTP precisa abrir um servidor efêmero do Supertest; no sandbox ela falha
com EPERM de porta. Reexecutada fora do sandbox, passou integralmente. O aviso de
bundle web (861.62 kB não comprimido) e a depreciação Prisma para futura versão 7
são concerns não bloqueantes já documentados.

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.

