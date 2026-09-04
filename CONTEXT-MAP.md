# Mapa de contextos

## Contextos

- [Billing](./docs/domain/billing/CONTEXT.md): vende créditos e acesso mensal para organizações e mantém o histórico financeiro desses benefícios
- [Events](./docs/domain/events/CONTEXT.md): registra fatos duráveis do domínio comercial e o estado de entrega desses fatos

## Relacionamentos

- **Billing → Organizations**: benefícios adquiridos pertencem a uma organização, independentemente da pessoa que realizou o pagamento
- **Billing → Usage**: o saldo adquirido financia o uso de funcionalidades cobradas por créditos
- **Events → Organizations**: cada DomainEvent pertence à organização da sessão; nunca chega `organizationId` do cliente
- **Events → Lead**: o primeiro fato persistido é `lead.stage_changed`; outros tipos entram em tickets posteriores
