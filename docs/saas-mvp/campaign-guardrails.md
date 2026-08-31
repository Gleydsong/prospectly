# Guardrails de campanha (pré-requisitos de envio automático)

> Status: a Fase 3.1 entrega **só cadências assistidas**. Outreach automático deve permanecer desligado até cada item abaixo estar implementado e revisado.

## Modo atual

- Templates suportam preview seguro de variáveis (`{{companyName}}`, etc.).
- Estágios viram **tarefas manuais** (e-mail, ligação, WhatsApp, LinkedIn).
- Nenhum provedor envia mensagens a partir do Prospectly.
- Respostas da API na criação de tarefa de estágio incluem `autoSend: false`.

## Obrigatório antes de ligar auto-send

1. **Lista de suppression**
   - Bloquear por e-mail, domínio e telefone no escopo do tenant.
   - Honrar `Lead.doNotContact` e suppressions globais antes de qualquer enqueue.

2. **Opt-out**
   - Link de unsubscribe / parar em um clique em toda mensagem de saída.
   - Efeito imediato; sem atraso de lote antes da suppression.

3. **Rate limits**
   - Tetos por usuário, por domínio e por organização (tenant).
   - Proteção contra burst e horários de silêncio das janelas de contato da campanha.

4. **Aprovação humana**
   - Primeiras campanhas automáticas exigem aprovação explícita de OWNER/ADMIN.
   - Manter um caminho assistido de fallback.

5. **Auditoria e base legal**
   - Registrar message id, versão do template, finalidade, base legal, ator e hash do destinatário.
   - **Não** guardar corpos completos de mensagem com PII desnecessária em metadados de auditoria.

6. **Idempotência**
   - Deduplicar envios por `(campaignId, leadId, stageId, templateVersion)`.
   - Reprocessamento seguro de job via outbox / chaves únicas do provedor.

7. **Consentimento e LGPD**
   - Confirmar que finalidade de coleta e retenção alinham com `docs/saas-mvp/lgpd-checklist.md`.
   - Pular leads sem consentimento exigido quando o canal demandar.

## Fora de escopo explícito da Fase 3.1

- Provedores SMTP/API ligados para disparos de prospecção
- Teste A/B
- Follow-ups automáticos disparados por webhook
- Workers em background que chamam APIs de e-mail ou WhatsApp para campanhas

## Checklist de rollout

- [ ] CRUD da lista de suppression + testes de enforcement
- [ ] Endpoint de opt-out + confirmação na landing
- [ ] Limites por tenant / domínio / usuário
- [ ] Fluxo de aprovação
- [ ] Auditoria de mensagem sem vazamento de secret
- [ ] Jobs de envio idempotentes
- [ ] Feature flag `CAMPAIGN_AUTO_SEND_ENABLED=false` por padrão
