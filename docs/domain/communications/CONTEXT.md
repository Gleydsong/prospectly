# Communications

O contexto de Communications associa e-mail e eventos de calendário da conta Google de uma pessoa aos clientes potenciais da organização, em leitura.

## Language

**Conexão Google**:
A ligação OAuth da pessoa (`User`) à sua conta Google, no âmbito da organização da sessão, para ler Gmail e Calendar.
_Avoid_: Integration, Sign-In, webhook, Ferramentas, caixa da organização

**Comunicação sincronizada**:
Um e-mail ou evento de calendário ingerido e associado a um Lead. É visível a quem já pode abrir esse Lead.
_Avoid_: LeadActivity, DomainEvent, CampaignActivity, AuditLog, inbox, corpo da mailbox

**Casamento**:
A associação de uma Comunicação sincronizada a um Lead pelo e-mail exacto do Lead ou de exactamente um LeadContact.
_Avoid_: match por domínio, fila unmatched, alias Gmail

## Invariants

- Visibilidade = ACL do Lead. Quem já abre a ficha lê as Comunicações sincronizadas. VIEWER não precisa de Conexão Google.
- Consentimento de **ingestão** = OAuth da pessoa + Conexão Google activa (não revogada). Não condiciona a leitura do já casado.
- Desligar ou revogar a Conexão pára ingestão e não apaga Casamentos.
- Soft-delete do Lead esconde a listagem da ficha. Hard-delete do Lead remove as Comunicações — a retenção segue o cliente potencial, não os 90 dias do OutboxEvent.
- Sem GC temporal sobre Comunicação sincronizada. `retainUntil` não se aplica.
- Export do titular da conta não inclui snippets de Lead. Sem checkbox «consentimento LGPD» nesta v1.
