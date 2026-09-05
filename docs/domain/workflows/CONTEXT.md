# Workflows

O contexto de Workflows guarda Fluxos da organização: automações nomeadas que reagem a DomainEvents com uma definição allowlisted e versões publicadas imutáveis.

## Language

**Fluxo**:
Uma automação nomeada da organização, com dono, estado (rascunho, ativo, pausado, arquivado) e uma definição allowlisted.
_Avoid_: Cadência, Automação, Attio Workflow, Campaign

**Versão publicada**:
Um snapshot imutável da definição no momento em que o Fluxo passou a ACTIVE. Runs futuros usam esta versão, não o rascunho.
_Avoid_: Draft, deploy, release

**Definição**:
O JSON allowlisted com gatilho, filtro opcional (a mesma AST da Vista) e passos tipados. Não é SQL nem canvas.
_Avoid_: Query string, AST livre, grafo

## Invariants

- Toda a organização vê os Fluxos; não há visibilidade PRIVATE.
- VIEWER lê. OWNER/ADMIN/SALES/MEMBER criam. Só o dono, OWNER ou ADMIN mutam.
- DRAFT aceita 0–10 passos. Publicar exige ≥1 passo e cria `WorkflowVersion` imutável.
- O primeiro gatilho é `lead.created`. O primeiro passo é `add_tag`.
- O worker aplica a versão publicada ACTIVE; redelivery não duplica LeadTag.
- `doNotContact` e consentimento vencem qualquer execução futura. Não há cold outreach.
