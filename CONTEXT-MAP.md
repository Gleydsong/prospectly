# Mapa de contextos

## Contextos

- [Billing](./docs/domain/billing/CONTEXT.md): vende créditos e acesso mensal para organizações e mantém o histórico financeiro desses benefícios

## Relacionamentos

- **Billing → Organizations**: benefícios adquiridos pertencem a uma organização, independentemente da pessoa que realizou o pagamento
- **Billing → Usage**: o saldo adquirido financia o uso de funcionalidades cobradas por créditos
