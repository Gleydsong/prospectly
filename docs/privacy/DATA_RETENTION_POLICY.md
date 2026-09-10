# Política de retenção (técnica)

Última revisão: 2026-09-10  
Prazos abaixo são **defaults de engenharia**. Obrigações fiscais/contábeis = `LEGAL_REVIEW_REQUIRED`.

| Tipo | Retenção | Justificativa técnica | Ação após expiração |
| --- | --- | --- | --- |
| Refresh tokens revogados | 30 dias | Replay detection / debug | `DELETE` (`RetentionService`) |
| Refresh tokens expirados | 7 dias após `expiresAt` | Sessão morta | `DELETE` |
| Hash reset/verify expirado | Imediato após expiry + job diário | Segredo inútil | `NULL` nos campos |
| CSV stagedRows | Até COMPLETED/FAILED | Retry do job | Já apagado no fluxo de import |
| ImportError.data | 30 dias após completed/failed | Diagnóstico de linha | `data = null` (mensagem pública permanece) |
| User conta ativa | Enquanto membership existir | Prestação do SaaS | Anonimização self-service |
| User anonimizado | Linha residual (e-mail `deleted+uuid@anonymized.invalid`) | Integridade FK / anti-reuso | Não reaproveitar para login |
| Lead soft-deleted | Indefinido no código | Unique keys ainda ocupam identidade | **Não** é erasure LGPD; org deve decidir |
| Comunicação sincronizada | Segue o Lead | Histórico da ficha (R6); não é outbox | Soft-delete esconde; hard-delete do Lead faz cascade. Job `privacy-retention` **não** apaga. Disconnect **não** apaga. |
| Suppression hashes | Vida da organização | Impedir reimport após opt-out | Cascade delete da org |
| ConsentRecord | Vida da conta | Evidência | Cascade user |
| AuditLog | Indefinido no código | Segurança | Job **não** apaga. Proposta 12–24m: LEGAL_REVIEW |
| Billing / webhooks | Indefinido | Financeiro | LEGAL_REVIEW |
| Waitlist | Indefinido | Marketing de produto | LEGAL_REVIEW (proposta 18 meses sem notify) |
| AiRun metadados | Vida da org | Custo/debug sem prompt | Cascade org |
| Backups Render | Política do provedor | DR | Restore pode ressuscitar PII |

Job: fila BullMQ `privacy-retention`, repeat 24h, idempotente, logs sem PII.
