# Fase 3 — Prospecção e importação de leads

## Objetivo

Construir a Fase 3 do Prospectly para encontrar empresas brasileiras sem website por categoria, cidade e UF, importar resultados selecionados como leads e importar listas CSV com processamento assíncrono, deduplicação e isolamento por organização.

## Escopo

### Incluído

- Pesquisa nacional por categoria, cidade e UF.
- OpenStreetMap como provedor inicial sem chave.
- Nominatim para resolver o município e Overpass para localizar empresas.
- Processamento assíncrono com BullMQ e Redis.
- Histórico, status e resultados persistidos.
- Filtro “somente sem site” ativo por padrão.
- Importação seletiva de resultados.
- Upload, pré-visualização, mapeamento e importação de CSV.
- Deduplicação forte e identificação de possíveis duplicados.
- Testes unitários, integração e front-end sem dependência de internet.

### Fora do escopo

- Google Places, Yelp ou outros provedores pagos.
- Confirmação automática absoluta de que uma empresa não possui website.
- Análise técnica do website, scoring e campanhas.
- WebSocket; o acompanhamento usa polling HTTP.

## Regra central

Ausência das tags `website`, `contact:website` e `url` no OpenStreetMap significa `NO_WEBSITE_REPORTED`, não confirmação definitiva. Resultados importados entram com status `TO_REVIEW`, tag `sem-site` e nota informando origem e necessidade de validação.

## Arquitetura

```text
Web
 |
POST /api/v1/searches
 |
SearchService cria Search(PENDING)
 |
BullMQ / Redis
 |
OpenStreetMapSearchProcessor
 |
Nominatim resolve cidade e UF
 |
Overpass busca estabelecimentos
 |
normalização brasileira
 |
SearchResult
 |
GET /api/v1/searches/:id via polling
 |
POST /api/v1/searches/:id/import
 |
deduplicação + Lead + tag sem-site
```

### Módulos

- `prospecting`: contrato de provider, integração OpenStreetMap, pesquisas, resultados, fila e importação seletiva.
- `imports`: upload CSV, detecção de delimitador, pré-visualização, mapeamento, fila, erros e histórico.
- `leads`: normalização, criação compartilhada e deduplicação.
- Web: pesquisa, polling, resultados selecionáveis, importação e fluxo CSV.

## Pesquisa OpenStreetMap

### Entrada

```ts
interface CreateSearchInput {
  category: string;
  city: string;
  state: BrazilianStateCode;
  onlyWithoutWebsite: boolean;
}
```

`onlyWithoutWebsite` assume `true`. Categoria, cidade e UF são obrigatórios. UF usa as 27 siglas válidas.

### Provider

Nominatim encontra município compatível com cidade, UF e país `BR`. Overpass consulta a área retornada usando tags comerciais relevantes: `amenity`, `shop`, `craft`, `office` e `tourism`. O mapeamento de categoria para tags fica isolado e testável.

Endpoints Nominatim e Overpass são configuráveis. Chamadas enviam `User-Agent` identificável, usam timeout, retry com backoff, concorrência limitada e cache da resolução do município. Respostas são normalizadas antes da persistência.

### Resultado normalizado

```ts
interface NormalizedBusiness {
  externalId: string;
  companyName: string;
  category?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city: string;
  state: BrazilianStateCode;
  country: 'BR';
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  source: 'OPENSTREETMAP';
  websitePresence: WebsitePresence;
}
```

## Processamento assíncrono

`POST /searches` cria registro `PENDING`, agenda job e responde `202`. Processor muda status para `PROCESSING`, substitui resultados da execução de maneira idempotente e encerra como `COMPLETED`. Falha final registra mensagem sanitizada e status `FAILED`.

BullMQ usa Redis já previsto no projeto. Jobs possuem tentativas limitadas, backoff exponencial e identificador derivado da pesquisa para impedir duplicação. Reinício da API não perde trabalhos persistidos.

## API

```text
POST /api/v1/searches
GET  /api/v1/searches
GET  /api/v1/searches/:id
GET  /api/v1/searches/:id/results
POST /api/v1/searches/:id/import

POST /api/v1/imports/csv/preview
POST /api/v1/imports/csv
GET  /api/v1/imports
GET  /api/v1/imports/:id
GET  /api/v1/imports/:id/errors
```

Todos os acessos usam `organizationId` e usuário derivados do JWT. Operações de escrita preservam RBAC atual. Recursos de outra organização retornam `404`, evitando revelar existência.

## Dados e migrations

Adicionar enum:

```prisma
enum WebsitePresence {
  NO_WEBSITE_REPORTED
  WEBSITE_FOUND
  NEEDS_REVIEW
}
```

Adicionar a `Lead`:

- `websitePresence WebsitePresence @default(NEEDS_REVIEW)`
- `websiteCheckedAt DateTime?`
- `websiteCheckSource String?`

Adicionar a `SearchResult`:

- `websitePresence WebsitePresence`
- `normalizedData Json`
- unicidade `(searchId, externalId)`

Adicionar a `SearchStatus` o valor `PROCESSING`. Adicionar unicidade `(organizationId, source, externalId)` em `Lead`. Campos `source`, `externalId`, `openingHours` e presença de website passam pela criação compartilhada de leads.

## Deduplicação

Ordem de comparação:

1. organização + fonte + identificador externo;
2. domínio normalizado;
3. telefone brasileiro normalizado;
4. e-mail lowercase;
5. nome normalizado + cidade + UF.

Identificador externo, domínio, telefone ou e-mail iguais formam duplicado forte e são ignorados. Nome + cidade + UF formam duplicado provável e são devolvidos como conflito para revisão, sem criação automática. Importação usa transação e restrições únicas para proteger contra concorrência.

Telefone é persistido em formato normalizado compatível com números brasileiros; e-mail e domínio ficam lowercase. Soft-deleted não é recriado silenciosamente.

## Importação dos resultados

Usuário seleciona resultados pertencentes à própria pesquisa. Backend importa em lote, vincula `SearchResult.importedLeadId`, cria tag `sem-site` e usa:

- `source = OPENSTREETMAP`;
- `status = TO_REVIEW`;
- `websitePresence = NO_WEBSITE_REPORTED` quando aplicável;
- nota com origem e aviso de validação manual.

Resposta informa importados, ignorados, inválidos e conflitos prováveis.

## CSV

Aceitar somente `.csv`, com limite de tamanho e linhas configurável. Detectar delimitador `,` ou `;`, reconhecer UTF-8 com BOM e rejeitar arquivo sem cabeçalho. Pré-visualização retorna cabeçalhos, amostra e campos sugeridos sem persistir leads.

Mapeamento suporta pelo menos:

- nome da empresa obrigatório;
- telefone, e-mail e website;
- categoria;
- endereço, cidade, UF e CEP;
- observações e tags.

Confirmação cria `Import(PENDING)` e agenda job. Processor valida cada linha, cria leads válidos, registra cada falha em `ImportError` e atualiza contadores. Importação parcial é permitida. Conteúdo é tratado como texto; fórmulas não são executadas.

## Interface web

### Pesquisa

- Formulário categoria, cidade e UF.
- “Somente sem site” ativo por padrão.
- Histórico com `PENDING`, `PROCESSING`, `COMPLETED` e `FAILED`.
- Polling enquanto busca estiver ativa.
- Tabela com nome, telefone, endereço, categoria e presença de website.
- Seleção individual e em massa.
- Resultados já importados ficam bloqueados.
- Resumo da importação.

### CSV

- Seleção do arquivo.
- Pré-visualização e mapeamento.
- Confirmação explícita.
- Acompanhamento por polling.
- Resumo e erros por linha.

## Erros e operação

- Erros públicos não expõem corpo integral do provider nem secrets.
- Timeout, rate limit ou indisponibilidade geram retry; falha final fica auditável.
- Endpoint desativado ou Redis indisponível falha de forma explícita.
- Logs incluem `searchId` ou `importId`, `organizationId` e correlation ID.
- Consultas e resultados são paginados.

## Testes

### Unitários

- Mapeamento de categorias para tags OSM.
- Normalização da resposta OSM.
- Detecção de presença de website.
- UF e telefone brasileiros.
- Deduplicação forte e provável.
- Parsing, delimitador e mapeamento CSV.

### Integração

- Criação e processamento de pesquisa com provider mockado.
- Polling e paginação de resultados.
- Importação seletiva e idempotente.
- Isolamento entre organizações.
- Falha e retry do provider.
- CSV com linhas válidas e inválidas.

### Front-end

- Validação do formulário.
- Polling somente durante processamento.
- Estados vazio, carregando, concluído e falha.
- Seleção e importação.
- Upload, pré-visualização e mapeamento CSV.

Nenhum teste automatizado depende da internet.

## Critérios de conclusão

- Fluxo de pesquisa completo funciona com provider mockado e com OpenStreetMap configurado.
- Importação seletiva cria leads sem duplicação.
- CSV fornece pré-visualização, processamento parcial e relatório de erros.
- Isolamento multi-tenant e RBAC cobertos por testes.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build` passam.
- Migration Prisma é gerada e validada.
