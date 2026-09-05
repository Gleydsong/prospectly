---
status: accepted
---

# A definição do Fluxo é JSON versionado, não tabelas de passos

SavedView já persiste uma definition JSONB allowlisted. Um Fluxo precisa da mesma validação no servidor e de um snapshot que não mude depois de publicar, para runs reprocessados usarem os mesmos passos. Normalizar cada step numa linha Prisma no v1 duplicaria o parser, o RLS e o allowlist sem executor ainda. A cabeça `Workflow` guarda o rascunho; `WorkflowVersion` é a linha imutável criada no publish.

## Opções consideradas

- Tabelas `WorkflowStep` normalizadas: rejeitado no v1 — o allowlist e o versionamento já cabem num JSON validado, como a Vista.
- Definition só na cabeça, sem versão: rejeitado — editar um ACTIVE alteraria o significado de runs já gravados.
