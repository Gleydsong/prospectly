# Organization flags

O contexto de Organization flags guarda **flags de organização**: ligar ou desligar uma capacidade ainda não global, só na organização da sessão.

## Language

**Flag de organização**:
Toggle tenant da organização sobre uma capacidade que ainda não é global. Ausência de linha = OFF. OWNER/ADMIN ligam ou desligam. Desligar não apaga Relatório salvo, DomainEvent nem Comunicação.
_Avoid_: plano, entitlement, Conexão Google, LaunchDarkly, percentagem, flag por utilizador, env `*_ENABLED`

**Key**:
Identificador allowlisted no código. Cliente não inventa JSON livre. Keys desta onda: `saved_report`. Não existem `gmail`, `reports_v1`, `workflows_v1`.
_Avoid_: feature id livre, slug de produto, flag de deploy

## Invariants

- `organizationId` só da sessão.
- Default de flag nova: OFF.
- R1–R6 já shipped não consultam flag (ON implícito, sem linha).
- VIEWER lê. Só OWNER/ADMIN mutam.
- Fonte da verdade: PostgreSQL.
