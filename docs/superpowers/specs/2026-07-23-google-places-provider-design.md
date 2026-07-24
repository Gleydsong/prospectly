# Google Places Provider Design

**Date:** 2026-07-23  
**Status:** Approved

## Goal

Add Google Places as optional search provider without breaking OpenStreetMap default flow.

## Decisions

- User picks provider per search (`provider` optional on create; default `OPENSTREETMAP`)
- Without `GOOGLE_PLACES_API_KEY`, Google is hidden from `GET /searches/providers` and rejected with 400 if requested
- Registry of `SearchProvider` adapters; OSM path unchanged
- Places API (New) Text Search; map to `NormalizedBusiness` with `source: GOOGLE_PLACES`
- Import uses `LeadSource.GOOGLE_PLACES` + place id as `externalId`

## Non-goals

- Dual-provider merge in one search
- Replacing OSM
- Caching Google responses beyond existing SearchResult persistence
