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
