---
status: accepted
---

# Inbox durável e checkouts de resultado incerto

Eventos de pagamento serão persistidos no PostgreSQL antes da resposta ao provedor e processados de forma assíncrona com lease e reclaim. Uma reconciliação periódica consultará estados financeiros pendentes; não será adicionada outra infraestrutura ao MVP.

## Consequences

- Toda criação externa começa por uma tentativa local durável e não oferece parcelamento no MVP.
- Uma resposta perdida do Checkout hospedado Asaas entra em `REVIEW_REQUIRED`, bloqueia nova criação para a organização e nunca sofre retry cego, pois não existe busca pública de Checkout por `externalReference`.
- A Prospectly não oferece UI ou API para iniciar estornos ou disputas; apenas confirma e aplica os eventos dessas operações realizadas no Asaas.
- O rollout começa com `ASAAS_ENABLED=false` e só avança de validação local para Sandbox e Produção mediante seus gates explícitos.
