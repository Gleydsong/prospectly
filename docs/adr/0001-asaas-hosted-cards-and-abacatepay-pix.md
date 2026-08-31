---
status: superseded
superseded-by: 0004-asaas-pix-and-historical-abacatepay.md
---

# Asaas hospedado para cartões e AbacatePay para PIX

A Prospectly manterá o PIX no AbacatePay e usará páginas hospedadas pelo Asaas para cartões, evitando que PAN, validade e CVV atravessem seus sistemas. Pacotes de créditos aceitarão crédito e débito pela Fatura Asaas; o acesso mensal aceitará PIX avulso por 30 dias e assinatura recorrente apenas por crédito, pois o Asaas não documenta débito recorrente.

## Opções consideradas

- Captura direta de crédito foi rejeitada nesta fase por ampliar significativamente o escopo PCI da Prospectly.
- Débito transparente ou recorrente foi rejeitado porque não existe contrato público documentado no Asaas.
- Migrar PIX para o Asaas foi rejeitado para preservar o fluxo AbacatePay já operacional.

## Consequências

- Redirecionamentos e callbacks nunca concedem benefícios; a confirmação vem de webhook autenticado e consulta autoritativa.
- Os preços permanecem R$ 14,99 para 2.000 créditos, R$ 23,99 para 5.000 créditos e R$ 49,99 para acesso mensal ilimitado.
- Histórico de provedores anteriores permanece identificável e não pode ser reclassificado como Asaas.
