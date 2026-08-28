---
status: accepted
---

# Asaas para novos pagamentos PIX e AbacatePay somente histórico

A Prospectly usará o Asaas para todos os novos pagamentos PIX. Pacotes de créditos recebem o benefício somente depois do estado autoritativo `RECEIVED`; o acesso mensal por PIX concede exatamente 30 dias e não cria renovação automática. O fluxo de cartões pelo Asaas permanece inalterado.

AbacatePay continua aceitando webhooks e reconciliação de registros históricos, mas não recebe novos checkouts depois do cutover. Contratos existentes não são migrados, cancelados ou reclassificados automaticamente.

## Considered Options

- Manter novos PIX no AbacatePay foi rejeitado porque a conta ainda não foi aprovada para produção.
- Fazer fallback automático para AbacatePay foi rejeitado porque poderia gerar cobranças duplicadas e ocultar falhas do provedor selecionado.
- PIX Automático foi deixado fora do escopo; o produto atual é pagamento avulso.

## Consequences

- `PIX_PROVIDER` controla a criação de novos checkouts e permanece `ABACATE` por padrão até a homologação e o cutover autorizados.
- `PIX_PROVIDER=ASAAS` exige `ASAAS_ENABLED=true`.
- A tentativa local é persistida antes do `POST` externo, e respostas ambíguas entram em `REVIEW_REQUIRED` sem repetição cega.
- QR code, redirecionamento e callback de navegação não concedem benefício.
- O webhook autenticado é persistido antes do processamento e o estado financeiro é confirmado por leitura autoritativa no Asaas.
- A organização guarda o ID do pagamento PIX que originou o período vigente; repetição do recebimento é inócua e reversões antigas não cancelam um período posterior.
- O ADR 0001 permanece como registro histórico e é substituído por esta decisão.
