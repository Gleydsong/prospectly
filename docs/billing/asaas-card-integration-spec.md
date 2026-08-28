# Especificação: integração Asaas para cartões

## Problem Statement

O Prospectly oferece compras de pacotes de créditos e acesso mensal, mas o fluxo atual aceita somente Pix pelo AbacatePay. A organização precisa poder pagar com cartão sem que o Prospectly capture ou processe dados do cartão, preservando o Pix existente, os contratos históricos e a ativação de benefícios somente após confirmação financeira confiável.

A integração também precisa suportar falhas ambíguas, reenvios de webhook, estornos e chargebacks sem conceder benefícios em duplicidade, sem perder eventos e sem permitir que uma tentativa incerta gere cobranças repetidas.

## Solution

Adicionar o Asaas como provedor de cartão, mantendo o AbacatePay como provedor exclusivo de Pix. Compras avulsas aceitarão crédito ou débito em página hospedada pelo Asaas; o acesso mensal aceitará crédito recorrente pelo checkout hospedado do Asaas ou Pix avulso por 30 dias pelo AbacatePay.

O Prospectly armazenará apenas o perfil mínimo de cobrança e os identificadores externos necessários. A ativação, renovação, revogação ou reversão de benefícios ocorrerá a partir de eventos autenticados, persistidos em uma inbox PostgreSQL e confirmados por consulta autoritativa ao Asaas. Toda a entrega ficará protegida por `ASAAS_ENABLED=false` até homologação e autorização explícita.

## User Stories

1. Como membro de uma organização, quero comprar um pacote de 2.000 créditos por R$ 14,99, para ampliar meu uso do Prospectly.
2. Como membro de uma organização, quero comprar um pacote de 5.000 créditos por R$ 23,99, para ampliar meu uso com melhor volume.
3. Como membro de uma organização, quero pagar um pacote por Pix, para continuar usando o fluxo AbacatePay já disponível.
4. Como membro de uma organização, quero pagar um pacote por cartão de crédito ou débito, para escolher o método mais conveniente.
5. Como membro de uma organização, quero pagar R$ 49,99 por 30 dias de acesso mensal via Pix, para obter acesso sem cadastrar cobrança recorrente.
6. Como membro de uma organização, quero contratar acesso mensal recorrente no cartão de crédito, para renovar automaticamente os períodos pagos.
7. Como comprador, quero inserir os dados do cartão apenas em página hospedada pelo Asaas, para que o Prospectly não manipule dados sensíveis do cartão.
8. Como comprador de pacote no cartão, quero ser redirecionado ao ambiente hospedado correto, para concluir a cobrança com segurança.
9. Como comprador de acesso mensal recorrente, quero ser redirecionado ao checkout hospedado do Asaas, para autorizar a recorrência com segurança.
10. Como comprador, quero retornar ao Prospectly depois do checkout, para acompanhar a confirmação do pagamento.
11. Como comprador, quero ver que o checkout está sendo confirmado quando houver uma resposta incerta, para não repetir uma cobrança por engano.
12. Como organização com checkout incerto, quero que novas tentativas fiquem bloqueadas, para evitar cobranças duplicadas enquanto a tentativa é investigada.
13. Como equipe de suporte, quero resolver uma tentativa `REVIEW_REQUIRED`, para liberar a organização depois de confirmar o resultado financeiro.
14. Como organização, quero receber créditos apenas após pagamento confirmado, para que saldo e cobrança permaneçam consistentes.
15. Como organização, quero receber acesso mensal apenas após pagamento confirmado, para que o período de acesso corresponda a receita confirmada.
16. Como organização, quero que cada renovação confirmada estenda o período pago, para manter acesso contínuo sem sobreposição incorreta.
17. Como assinante, quero cancelar a renovação futura sem perder o período já pago, para continuar usando o benefício adquirido até o vencimento.
18. Como assinante com renovação falha, quero manter somente o período já pago, para que não exista uma prorrogação artificial no MVP.
19. Como organização, quero que um estorno ou chargeback revogue imediatamente o acesso mensal correspondente, para refletir a reversão financeira.
20. Como organização, quero que um estorno ou chargeback reverta os créditos do pacote, para manter o saldo financeiro auditável.
21. Como organização que já consumiu créditos posteriormente estornados, quero que o débito permaneça registrado, para que novos usos pagos sejam bloqueados até a compensação do saldo negativo.
22. Como equipe de suporte, quero rastrear cada concessão e reversão em um ledger, para auditar o efeito de cada evento financeiro.
23. Como proprietário ou administrador, quero cadastrar e editar razão social ou nome, CPF ou CNPJ, telefone e e-mail de cobrança, para criar o pagador no Asaas.
24. Como usuário sem papel de proprietário ou administrador, quero ser impedido de alterar o perfil de cobrança, para preservar a autorização da organização.
25. Como organização, quero reutilizar meu identificador de cliente Asaas nas compras seguintes, para evitar cadastros duplicados desnecessários.
26. Como organização com contrato histórico ativo ou vencido em outro provedor, quero que ele seja preservado, para não sofrer migração, cancelamento ou reclassificação automática.
27. Como organização com contrato histórico incompatível com uma nova contratação, quero ser direcionada à auditoria ou suporte, para evitar benefícios concorrentes.
28. Como sistema, quero autenticar o webhook Asaas, para rejeitar eventos não autorizados.
29. Como sistema, quero persistir o evento antes de responder com sucesso, para não perder notificações financeiras.
30. Como sistema, quero deduplicar eventos por identificador externo, para que reenvios não concedam ou revertam benefícios duas vezes.
31. Como sistema, quero recuperar eventos cujo processamento foi interrompido, para que falhas de processo não deixem pagamentos sem tratamento.
32. Como sistema, quero reconciliar periodicamente estados pendentes, para resolver divergências entre o Prospectly e o Asaas.
33. Como sistema, quero consultar o pagamento no Asaas antes de aplicar efeitos, para confirmar cliente, valor, referência, método e estado financeiro.
34. Como operador, quero que logs financeiros omitam credenciais, tokens e dados sensíveis, para reduzir exposição operacional.
35. Como operador, quero desativar as notificações duplicadas do Asaas, para que o Prospectly seja responsável pela comunicação do produto.
36. Como equipe de engenharia, quero liberar o código com o Asaas desabilitado, para validar a entrega sem expor cobranças a usuários.
37. Como equipe de engenharia, quero homologar crédito, débito hospedado, recorrência, timeout, refund e chargeback no Sandbox, para validar o ciclo financeiro antes da produção.
38. Como responsável pelo produto, quero autorizar explicitamente a habilitação em produção, para controlar o início das cobranças reais.
39. Como responsável financeiro, quero executar um smoke financeiro controlado após a autorização, para confirmar o fluxo real com risco limitado.

## Implementation Decisions

- O AbacatePay permanece como provedor exclusivo de Pix; o Asaas será adicionado como provedor de cartões.
- O checkout avulso de pacote usará cobrança hospedada Asaas compatível com crédito ou débito. O acesso mensal recorrente usará checkout hospedado Asaas com cartão de crédito.
- O Prospectly nunca receberá, persistirá ou registrará número, validade, CVV ou token de cartão.
- Não haverá parcelamento no MVP.
- O catálogo e os preços atuais serão preservados: 2.000 créditos por R$ 14,99; 5.000 créditos por R$ 23,99; acesso mensal por R$ 49,99.
- A interface de pacotes exibirá Pix e “Cartão de crédito ou débito”. A interface mensal exibirá Pix por 30 dias e cartão de crédito recorrente.
- O perfil de cobrança será pertencente à organização e editável apenas por OWNER ou ADMIN. Ele armazenará o mínimo necessário: nome ou razão social, CPF ou CNPJ, telefone, e-mail e identificador de cliente Asaas.
- O roteador de pagamentos selecionará o provedor a partir do produto e método, preservando os adaptadores existentes e adicionando um adaptador Asaas de interface pequena.
- Uma tentativa de checkout será criada antes da chamada externa e terá referência interna estável, produto, valor, método, provedor e estado.
- Quando a criação externa retornar com sucesso, serão persistidos os identificadores Asaas e a URL hospedada antes do redirecionamento.
- Se a chamada de criação tiver resultado ambíguo, a tentativa passará para `REVIEW_REQUIRED`; novas criações para a organização serão bloqueadas e nenhum retry cego será realizado.
- Como o checkout hospedado Asaas não possui consulta pública por referência externa, tentativas `REVIEW_REQUIRED` serão resolvidas por webhook autenticado ou suporte.
- A inbox de webhooks será durável no PostgreSQL, armazenará o envelope necessário e responderá 2xx somente após persistência bem-sucedida.
- O processamento será assíncrono e idempotente, com claim atômico, lease, reclaim de itens abandonados, tentativas controladas e registro do erro sanitizado.
- Um reconciliador periódico revisará eventos e estados recuperáveis sem criar nova cobrança.
- Antes de alterar benefícios, o processador consultará `GET /v3/payments/{id}` e comparará organização ou cliente, valor, referência externa, método e estado esperado.
- `PAYMENT_CONFIRMED` será o único evento de pagamento capaz de conceder o benefício inicial após a confirmação autoritativa.
- Eventos fora de ordem ou pertencentes a um contrato histórico não poderão substituir o benefício corrente de outro provedor.
- Cancelar recorrência impedirá cobranças futuras e preservará o fim do período já pago.
- Renovação falha não criará período de carência adicional no MVP.
- Refund e chargeback revogarão imediatamente o acesso mensal associado após confirmação autoritativa.
- Refund e chargeback de pacote gerarão reversão auditável no ledger. Caso os créditos já tenham sido consumidos, o saldo poderá ficar negativo e o uso pago permanecerá bloqueado até compensação.
- Contratos históricos Stripe ou AbacatePay serão preservados e nunca migrados, cancelados ou reclassificados automaticamente. Estados ativos ou `past_due` conflitantes exigirão auditoria ou suporte.
- A autenticação do webhook Asaas será independente da autenticação do webhook AbacatePay e validará o segredo esperado sem registrá-lo.
- A nova modelagem será aditiva, terá restrições e índices para idempotência, organização, estados pendentes e leasing, além de políticas RLS equivalentes às demais entidades tenant-scoped.
- O resultado do checkout continuará usando redirecionamento validado por allowlist e consulta de estado pelo Prospectly.
- A integração será condicionada a `ASAAS_ENABLED`, com valor falso por padrão. O fluxo Asaas indisponível retornará erro de negócio seguro sem chamar o provedor.
- Credenciais e segredo de webhook serão configurados fora do repositório. Nenhum segredo será incluído em código, migração, fixture, documentação ou log.
- A ativação em produção, o smoke financeiro e qualquer ação real no Asaas exigem autorização explícita e não fazem parte da execução automatizada desta especificação.

## Testing Decisions

- Bons testes observarão comportamento por interfaces públicas e limites estáveis; não verificarão funções privadas, ordem interna de chamadas ou detalhes incidentais de implementação.
- A API de Billing será o principal seam de comportamento para checkout, perfil de cobrança, autorização, bloqueio `REVIEW_REQUIRED`, cancelamento e consulta de status.
- O cliente Asaas será testado no limite HTTP com respostas controladas para criação, consulta, timeout, erro, recorrência e cancelamento, validando contratos documentados sem chamar cobranças reais.
- O PostgreSQL real será usado para provar migrações, RLS, deduplicação da inbox, claim concorrente, lease/reclaim, reconciliação e ledger negativo.
- A interface web será testada por comportamento visível e chamadas da API para seleção de método, redirecionamento seguro, polling e mensagem de confirmação.
- Testes existentes de adaptadores de pagamento, ativação de billing, compras de créditos, tentativas mensais, webhooks, RLS tenant-scoped, allowlist de URLs e página de créditos servirão como prior art.
- Casos de regressão cobrirão duplicidade, eventos fora de ordem, mismatch de valor ou cliente, webhook inválido, contrato histórico protegido, benefício vitalício protegido e falha após envio da requisição externa.
- Nenhum teste automatizado usará credenciais reais nem criará pagamento no Asaas.
- A homologação Sandbox será executada separadamente por wizard para crédito, débito hospedado, recorrência, timeout, refund e chargeback.

## Out of Scope

- Parcelamento.
- Captura transparente de dados de cartão no Prospectly.
- Recorrência em cartão de débito.
- Migração ou cancelamento automático de contratos históricos.
- Interface ou API Prospectly para iniciar refund, chargeback ou disputa.
- Novo provedor de Pix ou migração do Pix para Asaas.
- Período de carência adicional após falha de renovação.
- Habilitação em produção, smoke financeiro real ou alteração de credenciais de produção.
- Introdução de nova infraestrutura externa ou nova fila apenas para esta integração.

## Further Notes

- A documentação técnica do Asaas deverá ser consultada pelo MCP oficial durante a implementação, especialmente para contratos de criação, consulta, webhooks, cancelamento e recorrência.
- A configuração de conta, credenciais e webhook Sandbox será conduzida pelo workflow `wizard`, pois depende de ações humanas e segredos.
- A entrega só será candidata à homologação depois de migration, RLS, testes, typecheck, lint e build aprovados.
- Dúvidas observadas no Sandbox serão registradas antes de alterar decisões arquiteturais ou habilitar o recurso.
