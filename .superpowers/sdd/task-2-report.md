# Task 2 — OpenStreetMap provider

Status: DONE

## Review remediation

The Task 2 review identified one Important and two Minor findings. All were corrected with additional RED/GREEN cycles:

- Nominatim municipality selection now requires a normalized match for the requested city. It checks `city`, `town`, `municipality`, and `village`, with the first `display_name` segment as a deliberate fallback. Accent, case, punctuation, and whitespace differences are normalized. A same-UF but different-city relation is now rejected before Overpass is called.
- Municipality cache entries now expire after a TTL (15 minutes by default) and use bounded LRU eviction (500 entries by default). Both bounds are overridable for deterministic tests.
- Retry now occurs only for native fetch failures/timeouts and HTTP `429`/`5xx`. Permanent `4xx` responses immediately return the same sanitized public error. `Retry-After` seconds or HTTP-date values are honored for transient HTTP retries.

## Delivered

- Created the `SearchProvider` contract, Brazilian UF type/validation list, provider token, and `NormalizedBusiness` contract using Prisma's `WebsitePresence`.
- Added an isolated category-to-OSM mapping covering `amenity`, `shop`, `craft`, `office`, and `tourism`; unsupported or empty categories are rejected.
- Added `OpenStreetMapProvider` with native, injectable `fetch`, abort timeout, sanitized errors, exponential retry, Nominatim municipality cache, Nominatim BR/UF validation, and Overpass area queries.
- Normalizes IDs, contact data, Brazilian location fields, coordinates, address, and website presence. Website precedence is `website`, `contact:website`, then `url`; absent tags are `NO_WEBSITE_REPORTED`.
- Added OSM endpoints, user-agent, timeout, and result-limit defaults to configuration, environment validation, and `.env.example`.

## TDD evidence

### RED

1. `npm test -- --runInBand src/modules/prospecting/infrastructure/openstreetmap.provider.spec.ts`
   - Failed as expected with `TS2307`: missing `osm-category-map` and `openstreetmap.provider` modules.
2. After the initial provider GREEN, configuration tests were added and the same command failed as expected with `TS2339`: missing `configuration().openStreetMap`.
3. Cache/retry tests were added and the focused run failed as expected: repeated municipality resolution consumed an Overpass response, and transient provider errors were not retried.
4. Municipality-city regression test failed as expected: a same-UF São José dos Campos relation incorrectly generated `area(3603549904)` instead of São Paulo's `area(3603550308)`.
5. TTL and LRU cache tests each failed first because the provider options/cache had no expiration or entry cap.
6. Permanent-HTTP retry regression failed as expected: a `404` was fetched three times instead of once.

### GREEN

`npm test -- --runInBand src/modules/prospecting/infrastructure/openstreetmap.provider.spec.ts`

- PASS — 1 suite, 46 tests.
- HTTP uses the injected Jest mock only; no test accesses the internet.

`npm run typecheck`

- PASS — `tsc --noEmit -p tsconfig.json`.

## Files changed

- `apps/api/src/modules/prospecting/domain/search-provider.ts`
- `apps/api/src/modules/prospecting/domain/normalized-business.ts`
- `apps/api/src/modules/prospecting/infrastructure/osm-category-map.ts`
- `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.ts`
- `apps/api/src/modules/prospecting/infrastructure/openstreetmap.provider.spec.ts`
- `apps/api/src/config/configuration.ts`
- `apps/api/src/config/validation.ts`
- `apps/api/.env.example`

## Auto-review

- Confirmed only Task 2 files and its required report were changed by this task; no existing Task 1 files were modified.
- Confirmed provider errors expose only `OpenStreetMap provider request failed`, not response or upstream details.
- Confirmed the municipality is restricted by `countrycodes=br` and must match the requested UF before Overpass runs.
- Confirmed `onlyWithoutWebsite` filters to `NO_WEBSITE_REPORTED`, preserving the central rule that this is not an absolute confirmation.
- Confirmed municipality selection rejects a different city in the requested UF; cache is TTL-bounded and LRU-limited; permanent `4xx` responses are not retried.
- No blocking concerns. Provider registration in a Nest module is intentionally deferred to the async search orchestration of Task 3.
