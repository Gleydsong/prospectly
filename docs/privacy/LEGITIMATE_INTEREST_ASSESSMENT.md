# Avaliação de legítimo interesse (técnica, não jurídica)

Última revisão: 2026-08-28  
**Não** substitui LIA formal nem decide que o teste está aprovado.

## 1. Prospecção de estabelecimentos via mapas + contacto

| Campo | Conteúdo |
| --- | --- |
| Finalidade | Gerar lista de empresas locais para outreach **feito pelo cliente** (controlador) |
| Benefício esperado | Produtividade comercial B2B |
| Necessidade | OSM/Places já devolvem telefone/e-mail públicos; o produto persiste isso no tenant |
| Alternativas menos invasivas | Importar só nome+cidade; ocultar contacto até opt-in; delay de enriquecimento |
| Expectativa do titular | MEI/PF pode **não** esperar CRM de terceiros a partir de mapa |
| Impacto | Contacto não solicitado; reimportação (mitigada por suppression hash) |
| Risco | HIGH / RIPD possível |
| Salvaguardas | Tenant isolation, DNC, suppression, sem auto-send, sanitizer LLM, opt-out em campanha |
| Opt-out | `CampaignLeadResult.OPT_OUT` → `doNotContact` + hash; sem portal público do titular-lead |
| Conclusão técnica | Tratamento é o core do produto e **não** está juridicamente validado neste repositório |
| Legal review | `LEGAL_REVIEW_REQUIRED` — balancing test por tipo de titular (PJ vs PF/MEI), transparência na política, RIPD |

## 2. Segurança da conta (IP em refresh token, lockout, audit)

| Campo | Conteúdo |
| --- | --- |
| Finalidade | Abuso, session reuse, auditoria |
| Necessidade | Padrão de auth |
| Alternativas | Não guardar IP (perde forense) |
| Expectativa | Razoável em SaaS |
| Salvaguardas | Redaction em logs; retenção de tokens |
| Conclusão técnica | Compatível com LI de segurança **se** minimizado |
| Legal review | Confirmar prazo AuditLog |

## 3. Waitlist da landing

Provável consentimento (e-mail voluntário), não LI. Ainda assim: finalidade só aviso de acesso; sem remarketing no código.
