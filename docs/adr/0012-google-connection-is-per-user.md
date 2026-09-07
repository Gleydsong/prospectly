# Conexão Google é da pessoa, não Integration da org

A org já tem `Integration` única por `(organizationId, provider)` para webhooks de Ferramentas (R7). Reutilizar essa tabela para a mailbox de um vendedor misturaria consentimento pessoal, um único provider por org, e entrega HTTP. A Conexão Google é OAuth da pessoa na org da sessão (`unique organizationId+userId`), com scopes de leitura, separado do Sign-In (`openid email profile`).

## Opções consideradas

- Reusar `Integration`: rejeitado — unique por provider na org, webhook, não há dono User.
- Ampliar Sign-In com gmail.readonly: rejeitado — login passaria a pedir mailbox.
- Caixa partilhada da org: rejeitado nesta release — o comercial é pessoal.
