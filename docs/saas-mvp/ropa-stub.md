# ROPA stub — Registro de Atividades de Tratamento (MVP)

Última revisão: 2026-08-01  
Status: **rascunho operacional** — não substitui ROPA jurídico completo.

## Papéis

| Papel | Quem |
| --- | --- |
| Controlador | Organização cliente (tenant) para leads/CRM e outreach |
| Operador | Prospectly (SaaS) para hospedagem, prospecção assistida e ferramentas |
| Titular | Usuário da conta; contatos/pessoas físicas ligadas a empresas prospectadas |

## Categorias de dados (separação)

| Categoria | Exemplos | Base legal (hipótese MVP) |
| --- | --- | --- |
| Conta de usuário | e-mail, nome, hash de senha, locale, termos | Contrato / execução de cadastro |
| Organização / billing | nome, plano, IDs de pagamento | Contrato |
| Empresas (B2B) | razão social, domínio, endereço comercial, telefone público | Interesse legítimo do controlador cliente (avaliar caso a caso) |
| Pessoas físicas associadas | e-mail/telefone que identifiquem MEI/PF | Interesse legítimo + necessidade de RIPD quando aplicável |
| Auditoria | action, entityId, metadados mínimos | Obrigação legal / segurança |

## Subprocessadores (inventário inicial)

| Subprocessador | Finalidade | Dados típicos |
| --- | --- | --- |
| Postgres (host do deploy) | Persistência | Conta, leads, audit, DSR |
| Redis | Filas / rate limit | IDs de job, throttling |
| Stripe / Abacate | Cobrança | IDs de cliente, eventos de webhook |
| Render / Vercel (ou equivalente) | Hosting | Logs técnicos, IP |
| Google Places (opcional) | Enriquecimento selecionado | Queries geográficas / campos de negócio |
| OpenStreetMap / Nominatim | Descoberta barata | Queries geográficas / POIs públicos |
| Provedor de e-mail transacional | Verificação / DSR stub | E-mail do usuário |

## Direitos do titular (DSR)

- Exportação / exclusão: solicitação via API → revisão OWNER → confirmação (stub assíncrono na fase 4.2).
- Execução real de purge/export completo: backlog (checklist LGPD).

## Retenção (a formalizar)

| Entidade | Prazo proposto (rascunho) |
| --- | --- |
| User / Membership | Enquanto conta ativa + prazo legal pós-cancelamento |
| Lead / Contact | Definido pelo controlador cliente; soft-delete disponível |
| AuditLog | Mínimo necessário para segurança/compliance (ex.: 12–24 meses) |
| DataSubjectRequest | Até conclusão + evidência de confirmação |

## Decisão de interesse legítimo (contato pessoal)

Prospectly **não** afirma interesse legítimo genérico para outreach. Cada organização cliente deve documentar finalidade, necessidade, balancing test e opt-out antes de contatar pessoas físicas identificáveis. Dados de mapas públicos não dispensam essa análise.
