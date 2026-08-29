# RIPD — pré-avaliação (não é o relatório formal)

Última revisão: 2026-08-28

A LGPD exige Relatório de Impacto quando o tratamento for de alto risco (art. 5º, XVII e art. 38). Isto é um **filtro de engenharia**.

| Funcionalidade | Alto risco? | Motivo | RIPD formal |
| --- | --- | --- | --- |
| Prospecção OSM/Places em escala + persistência de telefone/e-mail | Sim, potencial | Volume, dados potencialmente de PF, profiling comercial | `LEGAL_REVIEW_REQUIRED` |
| Scoring de leads / Opportunity Finder | Sim, potencial | Decisão assistida sobre “oportunidade”; não é decisão legal automatizada exclusiva | Avaliar com DPO |
| Variantes WhatsApp (IA, envio manual) | Médio | Gera mensagem; humano envia; sanitizer omite contacto | Monitorar |
| CSV import/export | Médio | Bulk PII; injection mitigada | Procedimento do controlador |
| Billing CPF/CNPJ | Médio-alto | Dado cadastral fiscal em claro | Avaliar cifrar + DPA Asaas |
| Waitlist | Baixo | E-mail único, finalidade estreita | Provavelmente não |
| Auth / sessões | Baixo-médio | Segurança | Não como RIPD de prospecção |
| LLM cloud (se `*_AI_BASE_URL` não for local) | Alto | Transferência de contexto | Obrigatório reavaliar |

**Conclusão técnica:** o núcleo “achar e guardar contactos de negócios locais” é o principal candidato a RIPD. Prospectly atua como **operador** do SaaS; a organização cliente é **controladora** do outreach. Isso não elimina RIPD do operador sobre o desenho do produto.
