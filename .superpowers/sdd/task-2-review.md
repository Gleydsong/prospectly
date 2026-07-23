# Re-revisão — Task 2: provider OpenStreetMap

**Veredito: `APPROVED`**

Escopo conferido: `## Global Constraints`, `### Task 2`, relatório atualizado e
todos os arquivos definidos pela task. Esta revisão não alterou código de
produção.

## Confirmação dos achados anteriores

| Achado | Estado | Evidência |
| --- | --- | --- |
| Relação Nominatim não era validada contra a cidade | Resolvido | A seleção compara campos municipais e fallback de `display_name` normalizados antes de usar a area (`openstreetmap.provider.ts:100-111`, `260-270`); o teste rejeita município errado na mesma UF (`openstreetmap.provider.spec.ts:93-107`). |
| Cache sem TTL/limite | Resolvido | Cache LRU tem TTL padrão de 15 min e máximo de 500 entradas (`openstreetmap.provider.ts:216-242`), com testes de expiração e evicção (`openstreetmap.provider.spec.ts:199-237`). |
| Retry de erros HTTP permanentes | Resolvido | Apenas 429/5xx e erros de rede/timeout são repetidos; 4xx permanente falha sanitizado na primeira tentativa (`openstreetmap.provider.ts:118-131`, `273-305`), coberto em `openstreetmap.provider.spec.ts:256-264`. |

## Gate 1 — Conformidade integral com a especificação

**Aprovado.**

- Provider contrato, token, saída `NormalizedBusiness` e enums esperados estão
  definidos (`domain/search-provider.ts:1-21`; `domain/normalized-business.ts:1-21`).
- Categorias usam mapeamento fechado para `amenity`, `shop`, `craft`, `office` e
  `tourism`; entrada vazia/não suportada falha (`osm-category-map.ts:1-45`).
- Nominatim usa `countrycodes=br`, valida país, UF e cidade antes do Overpass
  (`openstreetmap.provider.ts:89-116`, `245-270`).
- Website respeita precedência `website`, `contact:website`, `url`; ausência vira
  `NO_WEBSITE_REPORTED`, sem alegar confirmação absoluta
  (`openstreetmap.provider.ts:141-180`).
- URLs, User-Agent, timeout e limite de resultados são configuráveis, documentados
  e validados (`configuration.ts:14-20`, `validation.ts:20-49`, `.env.example:15-20`).

## Gate 2 — Qualidade e correção

**Aprovado.**

- **Injeção Overpass:** o texto do usuário não é interpolado na query; ele é
  transformado em tags pré-definidas e valores/chaves são escapados
  (`osm-category-map.ts:3-45`; `openstreetmap.provider.ts:85-139`).
- **SSRF/configuração:** os endpoints são exclusivamente variáveis de ambiente,
  não fazem parte de `SearchProviderInput`, e aceitam somente HTTP/HTTPS
  (`validation.ts:20-34`). Sob o limite de confiança de configuração de deploy,
  não existe SSRF controlável por usuário. Caso endpoints se tornem dados editáveis
  pela aplicação, será necessário acrescentar bloqueio de IPs privados/redirects.
- **Robustez HTTP:** cada tentativa usa `AbortController`, User-Agent é enviado em
  ambos os providers, respostas upstream são sanitizadas, retry é seletivo e
  respeita `Retry-After` (`openstreetmap.provider.ts:201-208`, `256-305`).
- **Cache:** evita chamadas repetidas sem crescimento indefinido, inclusive quando
  falha uma resolução (`openstreetmap.provider.ts:216-242`).
- **Sem rede em teste:** todos os testes injetam `fetchMock`
  (`openstreetmap.provider.spec.ts:8-19`).

## Verificação executada

```text
pnpm --filter @prospectly/api test -- openstreetmap.provider.spec.ts --runInBand
PASS: 1 suíte, 46 testes

pnpm --filter @prospectly/api typecheck
PASS
```

## Severidade consolidada

- Critical: nenhum.
- Important: nenhum.
- Minor: nenhum.
