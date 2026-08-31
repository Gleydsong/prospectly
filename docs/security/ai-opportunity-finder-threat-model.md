# Modelo de ameaças — AI Opportunity Finder

## Fronteiras e dados

Entradas do usuário, dados de provedores e HTML remoto são não confiáveis. O modelo recebe somente serviço, perfil e campos comerciais mínimos; telefone, e-mail e endereço não são enviados para gerar explicações. Saídas do modelo passam por Zod e não executam ações externas.

## Controles

- autenticação, e-mail verificado, RBAC e throttling globais;
- isolamento por `organizationId` antes de qualquer acesso a candidatos;
- país e UF restritos ao Brasil;
- idempotência no início da execução, consumo e reembolso de créditos;
- score determinístico e versionado, separado da explicação de IA;
- `TRUE`, `FALSE` e `UNKNOWN` distintos, com fonte, confiança, instante e tipo de evidência;
- SSRF bloqueia credenciais em URL, metadata, DNS para redes não públicas, redirects inseguros, IPv4/IPv6 privados, multicast e documentação;
- limites de 20 candidatos, concorrência 4, 5 explicações, corpo HTTP limitado e deadline;
- erros públicos estáveis; logs não incluem prompt, resposta bruta ou dados de contato;
- salvamento no CRM exige ação humana e a ingestão existente faz deduplicação.

## Riscos residuais

- A resolução DNS é revalidada em cada salto, mas o `fetch` nativo não fixa o IP validado à conexão; infraestrutura de produção deve também bloquear egress para redes privadas/metadata.
- Detectores HTML são heurísticos. Ausência de elemento detectado é inferência, não prova.
- Qualidade e cobertura variam conforme OpenStreetMap/Google Places e disponibilidade dos websites.
