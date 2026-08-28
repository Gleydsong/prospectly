# Inventário de dados pessoais

Última revisão técnica: 2026-08-28  
Classificações são técnicas. **Base legal = LEGAL_REVIEW_REQUIRED** quando o código não pode decidir.

| Dado | Classificação | Origem | Finalidade | Armazenamento | Quem acessa | Terceiros | Retenção (técnica) | Exclusão | Base legal esperada | Risco |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User.email / name | PERSONAL_DATA | Cadastro, Google | Conta, comunicação | Postgres | Titular; membros da org veem nome em atividades | Resend/SMTP | Enquanto conta ativa; anonimização no delete | `DELETE /privacy/account` | Contrato | HIGH |
| User.passwordHash | AUTHENTICATION_DATA | Cadastro | Autenticação | Postgres (Argon2) | Ninguém em claro | — | Até exclusão | Anonimização zera hash | Contrato | CRITICAL se vazar |
| RefreshToken.ip / userAgent | TECHNICAL_IDENTIFIER | Login | Sessão / abuso | Postgres | Sistema | — | Job: revogados 30d; expirados 7d | Job retenção | Legítimo interesse segurança | MEDIUM |
| Reset/verify token hash | AUTHENTICATION_DATA | Fluxos auth | Recuperação | Postgres | Sistema | E-mail | Expira 1h / 24h; job limpa | Job | Contrato | HIGH |
| ConsentRecord | PERSONAL_DATA | Register / `/privacy/consent` | Evidência de aceite | Postgres | Titular | — | Histórico da conta | Cascade user | Consentimento / contrato | MEDIUM |
| Organization.name / slug | BUSINESS_CONTACT_DATA / NON_PERSONAL | Cadastro | Tenant | Postgres | Membros | — | Org ativa | Cascade org | Contrato | LOW |
| BillingProfile.name, email, phone, cpfCnpj | PERSONAL_DATA / FINANCIAL_DATA | Checkout Asaas | Cliente gateway | Postgres plaintext | OWNER/ADMIN | Asaas | Enquanto perfil existir | Cascade org. Criptografia app: backlog | Contrato / obrigação fiscal LEGAL_REVIEW | HIGH |
| CreditPurchase / webhooks | FINANCIAL_DATA | Gateways | Cobrança | Postgres (payload webhook) | Sistema / OWNER | Abacate, Asaas, Stripe legado | LEGAL_REVIEW | Não no self-delete | Obrigação legal possível | HIGH |
| Lead.email/phone/whatsapp/address | BUSINESS_CONTACT_DATA ou PERSONAL_DATA (MEI/PF) | Manual, CSV, OSM, Places | Prospecção do **controlador cliente** | Postgres (soft-delete) | Membros da org | OSM, Google Places | Definido pelo cliente; soft-delete ≠ erasure | Soft-delete; suppression hash no opt-out | **LEGAL_REVIEW_REQUIRED** (LI / RIPD) | CRITICAL (prospecção) |
| LeadContact.* | PERSONAL_DATA | CRM | Contactos da empresa | Postgres | Membros | — | Idem lead | Cascade lead | LEGAL_REVIEW | HIGH |
| SearchResult.data / OpportunityCandidate.company JSON | BUSINESS_CONTACT_DATA / PERSONAL_DATA | Providers | Staging de descoberta | Postgres | Membros | OSM/Places | Enquanto run/search existir | Cascade org | LEGAL_REVIEW | HIGH |
| Import.stagedRows | PERSONAL_DATA | CSV | Processamento | Postgres temporário | Sistema | — | Apagado ao COMPLETED/FAILED | Já implementado | Contrato (operador) | HIGH se retido |
| ImportError.data | PERSONAL_DATA | CSV inválido | Diagnóstico | Postgres | OWNER | — | Job zera após 30d do completed | Job retenção | Contrato | MEDIUM |
| WaitlistEntry.email | PERSONAL_DATA | Landing | Aviso de acesso | Postgres | Ops | Resend opcional | LEGAL_REVIEW (proposta 18 meses) | Manual / futuro job | Consentimento | MEDIUM |
| AuditLog.ip | TECHNICAL_IDENTIFIER | Ações | Segurança | Postgres | OWNER (implícito DB) | Host logs | LEGAL_REVIEW 12–24m | Não no self-delete | Segurança / obrigação | MEDIUM |
| localStorage prospectly-auth | PERSONAL_DATA | Web | UX sessão | Browser | Titular | — | Até logout | Logout | Contrato | LOW |
| Cookie refresh_token | AUTHENTICATION_DATA | API | Sessão | Browser HttpOnly | Browser/API | — | 7d | Logout | Contrato | HIGH |
| Cookie consent JSON | TECHNICAL_IDENTIFIER | Landing | Preferência cookies | localStorage | Titular | — | Até limpar storage | Banner / limpar site | Consentimento (essencial = info) | LOW |
| Prompts LLM | NON_PERSONAL após sanitizer | Opportunity / WhatsApp AI | Texto assistido | Não persistidos; `AiRun` só metadados | Sistema | Ollama local | N/A | N/A | LEGAL_REVIEW se PII vazar | HIGH se sanitizer falhar |
| SuppressionEntry.valueHash | TECHNICAL_IDENTIFIER | OPT_OUT | Impedir reimport | Postgres | Sistema | — | Enquanto org existir | Cascade org | Execução de direitos / LI | MEDIUM |

## Dados sensíveis (art. 5º, II)

Não há campos de saúde, biometria, religião, raça, vida sexual ou opinião política no schema. Análise de websites de leads pode **indiretamente** capturar texto público — minimizar e não enviar a LLM. **CRITICAL PRIVACY AREA** se isso mudar.

## Crianças / adolescentes

Produto B2B. Sem verificação de idade. **LEGAL_REVIEW_REQUIRED** se o cadastro puder ser feito por menor.
