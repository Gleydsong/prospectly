# Comunicação sincronizada é metadado no Lead, não LeadActivity nem corpo

O vendedor precisa do fio no cliente potencial sem o Prospectly virar arquivo de mailbox. `LeadActivity` é timeline humana e já grava `lastContactAt` com `now()`. DomainEvent dispara Fluxos. Guardar o corpo viola o recorte LGPD desta release. A Comunicação sincronizada é um agregado próprio (metadados + snippet, unique por Lead+canal+id Google), visível na ficha; ingestão futura não emite outbox.

## Opções consideradas

- Inserir `LeadActivity` EMAIL/MEETING: rejeitado — mistura nota manual com sync e reusa o writer de `lastContactAt`.
- Corpo completo na DB: rejeitado — retenção e DSR desproporcionais.
- Só proxy ao vivo para o Google: rejeitado — a ficha morre sem token.
