---
status: accepted
---

# Valores de Campo personalizado ficam no JSONB do Lead

A org precisa de schema próprio sem uma coluna Prisma por campo e sem um cubo. Uma tabela EAV de valores duplicaria o tenant do Lead e complicaria o PATCH merge. Relatórios e Fluxos ficam de fora desta release, portanto não há cubo a alimentar. A definição vive em `CustomFieldDefinition` (tenant); o valor vive em `Lead.customFieldValues` chaveado pelo id da definição. Índice GIN só se a Vista (tracer seguinte) precisar.

## Opções consideradas

- EAV `LeadCustomFieldValue`: rejeitado no v1 — segundo tenant child para o mesmo fato.
- Coluna Prisma por campo: impossível — o schema é da org, não do produto.
- Cubo / projeção: rejeitado — Relatórios não agrupam por Campo personalizado nesta spec.
