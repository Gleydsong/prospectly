---
status: accepted
---

# Confirmação, vigência e reversão dos benefícios de billing

Benefícios de billing pertencem à organização e só são concedidos depois que um pagamento `CONFIRMED` é validado por consulta autenticada ao provedor. O perfil de cobrança também pertence à organização; o pagador apenas inicia a compra em seu nome.

## Consequências

- A Prospectly envia as notificações de cobrança e evita notificações automáticas duplicadas do provedor.
- Uma assinatura cancelada mantém o acesso até o fim do período pago; uma renovação recusada não cria tolerância adicional no MVP.
- Estorno ou chargeback confirmado revoga o acesso mensal imediatamente.
- A reversão de um pacote retira todos os créditos concedidos por essa compra; se parte já foi consumida, o saldo fica negativo e auditável até ser recomposto.
- Contratos históricos não são migrados, cancelados ou reclassificados automaticamente.
