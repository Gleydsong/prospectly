---
status: accepted
---

# Abandono da tentativa não paga ao iniciar outro checkout Asaas

Uma organização terá no máximo uma tentativa Asaas não terminal (pacote ou mensal). Se o pagador iniciar um checkout diferente — outro meio de pagamento ou outro produto — a Prospectly consulta o estado autoritativo, exclui ou cancela a cobrança/checkout ainda não pagos no Asaas, marca a tentativa local como `FAILED` e só então cria a nova. Tentativa em revisão necessária continua bloqueando criação (ADR 0003). Mesmo produto e mesmo meio retomam a tentativa existente.

## Opções consideradas

- Permitir PIX e cartão pendentes ao mesmo tempo foi rejeitado: o pagador poderia quitar os dois e receber benefício duplicado.
- Só invalidar na UI, deixando a cobrança viva no Asaas, foi rejeitado pelo mesmo risco de pagamento tardio do QR.
- Abandonar também em revisão necessária foi rejeitado: o resultado externo é incerto e retry cego viola o ADR 0003.

## Consequências

- `POST` de checkout deixa de responder `503`/`409` só porque existe outra tentativa `PENDING`/`READY` de meio ou produto diferente.
- `DELETE /v3/payments/{id}` (PIX e cartão avulso) e `POST /v3/checkouts/{id}/cancel` (cartão mensal) são a forma de matar a cobrança abandonada.
- Se o GET mostrar pagamento já confirmado, a troca é abortada e o benefício dessa cobrança é concedido.
- `Voltar` na tela PIX não abandona; só um novo `POST` de checkout o faz.
