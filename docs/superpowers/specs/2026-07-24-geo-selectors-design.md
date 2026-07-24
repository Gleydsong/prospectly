# Design: Seletores geográficos encadeados (País → Região → Cidade)

**Data:** 2026-07-24  
**Branch:** `selectores`  
**Status:** Aprovado para implementação

## Objetivo

No formulário de pesquisa, após o usuário selecionar o **país**, as opções de **região** e **cidade** passam a ser apenas selects (sem digitar). Fluxo obrigatório:

1. País  
2. Região (habilitada após país)  
3. Cidade (habilitada após região; lista filtrada pela região)

## Decisões

| Tema | Decisão |
|------|---------|
| Cobertura | Todos os países já em `PROSPECTING_COUNTRY_CODES` |
| Fonte de dados | API backend (não JSON solto no frontend) |
| Persistência | Dataset via biblioteca `country-state-city` (sem novas tabelas Prisma nesta fase) |
| Cascata | País → Região → Cidade |
| Auth | Mesmos endpoints autenticados da API (Bearer), leitura liberada a qualquer role autenticada |

## Contratos HTTP

### `GET /api/v1/geo/regions?country=PT`

Resposta:

```json
{
  "data": [
    { "code": "11", "name": "Lisboa" }
  ]
}
```

- `400` se `country` ausente ou fora da lista de prospecting  
- `code` = código administrativo da lib (ex.: UF `SP` no BR)

### `GET /api/v1/geo/cities?country=PT&region=11`

Resposta:

```json
{
  "data": [
    { "name": "Lisboa" }
  ]
}
```

- `400` se país/região inválidos  
- Cidade enviada na criação da search continua sendo o **nome** (string), compatível com providers OSM/Google

## UI

- País muda → limpa região e cidade; carrega regiões  
- Região muda → limpa cidade; carrega cidades  
- Cidade/região desabilitadas até pré-requisito preenchido  
- Loading/erro nos selects com mensagem segura  
- Validação: não permite submit com cidade/região vazias

## Testes

- Unit: `GeoService` (BR/PT, país inválido, região inválida)  
- Integration/e2e HTTP: endpoints geo com auth  
- Web: SearchPage — após país PT, região vira select; cidade só após região; submit envia nomes corretos

## Fora de escopo

- Digitação livre / autocomplete fuzzy  
- Todas as aldeias do mundo (cobertura = dataset da lib)  
- Alterar CSV import (continua BR-centrado)

## Documentação contínua

Cada entrega atualiza `.superpowers/sdd/progress.md` e um report curto da task em `.superpowers/sdd/`.
