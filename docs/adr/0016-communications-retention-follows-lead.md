---
status: accepted
---

# Retenção da Comunicação sincronizada segue o Lead

A ficha precisa do histórico da equipa depois de offboarding. Os 90 dias de `OutboxEvent.retainUntil` medem facto de domínio recuperável, não o casamento Gmail/Calendar. Apagar Comunicações no job de tokens/import, ou no disconnect, apagaria o fio comercial sem o titular do Lead ter pedido erasure. A retenção segue o cliente potencial: soft-delete esconde; hard-delete/cascade remove; Conexão Google activa só autoriza **ingerir**.

## Opções consideradas

- Reusar `retainUntil` / GC de 90d do outbox: rejeitado — Relatórios e DomainEvent não são a ficha do Lead.
- Apagar Casamentos ao desligar a Conexão Google: rejeitado — offboarding limparia a ficha da org.
- Checkbox de consentimento LGPD na v1: rejeitado — fingiria base legal sem parecer jurídico.
- Retenção 24 meses distinta do Lead: rejeitado nesta spec — duplicaria política e GC.
