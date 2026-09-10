# Billing

O contexto de Billing vende créditos e acesso mensal para organizações da Prospectly e preserva a correspondência entre pagamento confirmado e benefício concedido.

## Language

**Meio de pagamento**:
A forma escolhida pelo pagador para quitar uma compra: PIX, cartão de crédito ou cartão de débito.
_Avoid_: Gateway, provedor, cartão

**Provedor de pagamento**:
O serviço externo responsável por processar um meio de pagamento. Asaas é o provedor exclusivo de pagamentos PIX e cartões suportados.
_Avoid_: Meio de pagamento, adquirente

**Pacote de créditos**:
Uma compra avulsa que adiciona uma quantidade fixa de créditos ao saldo da organização após confirmação do pagamento.
_Avoid_: Plano de créditos, assinatura de créditos

**Acesso mensal ilimitado**:
O benefício que libera os recursos elegíveis da organização por um ciclo de 30 dias. Pode ser adquirido por PIX avulso ou mantido por assinatura no cartão de crédito.
_Avoid_: Lifetime, pacote ilimitado

**Assinatura mensal**:
O acordo de renovação automática do acesso mensal ilimitado, disponível somente por cartão de crédito.
_Avoid_: PIX mensal, débito mensal

**Entitlement**:
O benefício pertencente à organização depois que um pagamento foi confirmado de forma autoritativa.
_Avoid_: Retorno do checkout, pagamento pendente

**Confirmação de pagamento**:
A comprovação autoritativa do estado financeiro no provedor. Redirecionamentos e callbacks de navegação não são confirmação.
_Avoid_: Página de sucesso, retorno do checkout

**Checkout hospedado**:
A experiência de pagamento controlada pelo provedor na qual os dados completos do cartão não passam pela Prospectly.
_Avoid_: Checkout transparente, formulário de cartão da Prospectly

**Perfil de cobrança**:
Os dados legais e de contato da organização usados para identificar o cliente perante o provedor de pagamento.
_Avoid_: Cartão salvo, perfil do usuário

**Pagador**:
A pessoa que inicia uma compra em nome da organização. O pagador não é o proprietário do benefício adquirido.
_Avoid_: Organização, cliente Asaas

**Período pago**:
O intervalo de acesso mensal já confirmado financeiramente. Cancelar a renovação não reduz esse intervalo.
_Avoid_: Período de tolerância, renovação pendente

**Reversão**:
A retirada total ou parcial de um benefício após estorno ou chargeback confirmado. Créditos consumidos permanecem representados como saldo negativo auditável.
_Avoid_: Apagar compra, absorver perda

**Contrato histórico**:
Uma relação financeira criada por um provedor anterior que permanece identificável e exige tratamento de suporte antes de uma nova assinatura.
_Avoid_: Assinatura Asaas, migração automática

**Tentativa de checkout**:
O registro durável de uma intenção de compra antes de qualquer criação no provedor externo.
_Avoid_: Clique no botão, sessão do navegador

**Abandono de tentativa**:
O encerramento de uma tentativa ainda não confirmada porque o pagador iniciou outro checkout; a cobrança correspondente deixa de ser pagável no provedor.
_Avoid_: Estorno, cancelar assinatura, revisão necessária

**Revisão necessária**:
O estado de uma tentativa cujo resultado externo não pode ser determinado com segurança e que bloqueia nova criação até confirmação ou intervenção.
_Avoid_: Falha definitiva, retry automático

**Inbox de webhook**:
O histórico durável dos eventos recebidos do provedor antes da aplicação de seus efeitos de negócio.
_Avoid_: Callback, log de webhook

**Reconciliação**:
A confirmação periódica do estado financeiro autoritativo de compras e assinaturas que ainda não chegaram a um estado terminal.
_Avoid_: Reprocessar criação, confiar no callback
