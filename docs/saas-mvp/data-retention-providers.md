# Retenção e atualização por provedor de dados

Última revisão: 2026-08-01

Política operacional para dados de prospecção (Phase 2.1). Os prazos abaixo são orientação de produto; o contrato/termos de cada API prevalecem.

| Provedor | Dados típicos | Retenção sugerida no Prospectly | Atualização / revalidação | Notas |
| --- | --- | --- | --- | --- |
| OpenStreetMap / Nominatim | Nome, endereço, telefone/site quando tagueados | Enquanto o lead existir na org; soft-delete com lead | Revalidar website/contato sob demanda (`lastVerifiedAt`) | Ausência de tag `website` = `NO_WEBSITE_REPORTED` (observação, não prova) |
| Google Places (Text Search) | Candidatos baratos (nome, lugar, place_id) | Enquanto o lead/search result existir | Detalhe pago só sob enriquecimento seletivo (2.2) | Não cachear além do necessário; respeitar ToS e atribuição |
| Google Places (Place Details) | Telefone, site, rating, status operacional | Preferir sobrescrever campos do lead; não espelhar payload bruto | Sob ação explícita do usuário ou regra | Registrar custo lógico no job antes da chamada |
| CSV / Manual | Campos fornecidos pelo usuário | Política da organização usuária (controlador) | Manual | Base legal e finalidade sob responsabilidade da org |
| Análise Prospectly (HTTP) | Sinais técnicos do site | Com o registro `Website` / análises | Ao clicar Verificar / enriquecer ou reanálise | Atualiza `lastVerifiedAt`, `confidenceLevel`, `websiteStatusReason` |

## Princípios

1. **Descoberta barata ≠ enriquecimento completo** — importar candidatos sem chamar Details em massa.
2. **Observação de fonte** — `NO_WEBSITE_REPORTED` nunca vira copy definitiva "empresa sem site".
3. **Minimização** — guardar só campos de decisão; evitar dump de JSON do provedor.
4. **LGPD** — ver também `lgpd-checklist.md`; telefone/e-mail de PF exigem finalidade e base legal da org cliente.
