# Design: provider Google Places

**Data:** 2026-07-23  
**Status:** Aprovado

## Objetivo

Adicionar Google Places como provider de busca opcional sem quebrar o fluxo padrão OpenStreetMap.

## Decisões

- Usuário escolhe provider por busca (`provider` opcional na criação; default `OPENSTREETMAP`)
- Sem `GOOGLE_PLACES_API_KEY`, Google fica oculto em `GET /searches/providers` e rejeitado com 400 se solicitado
- Registry de adapters `SearchProvider`; caminho OSM inalterado
- Places API (New) Text Search; mapear para `NormalizedBusiness` com `source: GOOGLE_PLACES`
- Import usa `LeadSource.GOOGLE_PLACES` + place id como `externalId`

## Não-objetivos

- Merge dual-provider em uma busca
- Substituir OSM
- Cache de respostas Google além da persistência existente em SearchResult
