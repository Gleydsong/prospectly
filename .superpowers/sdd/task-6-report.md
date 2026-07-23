# Task 6 — Web CSV workflow report

## Status

DONE_WITH_CONCERNS

The Web CSV workflow is implemented against the Task 4 HTTP contracts only. No backend service, Redis worker, or external network dependency was started.

## Scope delivered

- Added typed CSV import API functions for preview, creation, history, individual jobs, and row errors.
- Added TanStack Query hooks with two-second polling only for `PENDING` and `PROCESSING` imports.
- Added `/imports` page and sidebar navigation entry.
- Implemented CSV-only client selection, explicit preview, five-row display, mapping selectors, required company mapping, explicit job creation, and reset of the file input only after a successful creation.
- Implemented import history, status/counter summary, and row-level error display.
- Preserved the existing Tailwind/Card/Button/Badge visual language and accessible labels, roles, focus behavior, and table semantics.

## TDD evidence

### RED

Each behavior was introduced with a failing focused check before its minimal implementation:

1. `pnpm --filter @prospectly/web test -- src/components/layout/sidebar.test.tsx`
   - Failed as expected: accessible `Importar CSV` link did not exist.
2. `pnpm --filter @prospectly/web test -- src/pages/imports-page.test.tsx`
   - Failed as expected: `imports-page` module did not exist, then preview and confirmation UI assertions failed before implementation.
3. `pnpm --filter @prospectly/web test -- src/features/imports/api.test.ts`
   - Failed as expected: CSV API module did not exist.
4. `pnpm --filter @prospectly/web test -- src/features/imports/hooks.test.tsx`
   - Failed as expected: import polling hook module did not exist.
5. `pnpm --filter @prospectly/web test -- src/pages/imports-page.test.tsx`
   - Failed as expected: import history/progress/error interaction was absent.

### GREEN

Focused verification after implementation:

```text
pnpm --filter @prospectly/web test -- src/features/imports/api.test.ts src/features/imports/hooks.test.tsx src/pages/imports-page.test.tsx src/components/layout/sidebar.test.tsx

Test Files  4 passed (4)
Tests       9 passed (9)
```

Additional verification:

```text
pnpm --filter @prospectly/web typecheck  # passed
pnpm --filter @prospectly/web lint       # passed
pnpm --filter @prospectly/web build      # passed
```

The Vite build emitted the existing bundle-size advisory (`860.52 kB` JavaScript, above the 500 kB warning threshold); it does not fail the build and is outside this task's CSV scope.

## Auto-review

- Contracts match Task 4: multipart field names are `file` and `mapping`; mapping is JSON-serialized; routes are `/imports/csv/preview`, `/imports/csv`, `/imports`, `/imports/:id`, and `/imports/:id/errors`.
- Polling is bounded to active states and stops for `COMPLETED` and `FAILED` states.
- The client never treats preview as an import; creating the job remains an explicit action.
- The confirmation control is disabled without `companyName` mapping; the backend remains authoritative for mapping validation.
- File state and the native input reset only after `createCsvImport` succeeds; failed creation keeps the selected file for retry.
- No Task 7 files, API files, migrations, or backend-runtime integrations were changed.
- No real backend was used, by explicit task constraint. Runtime integration of the browser with the Task 4 server is intentionally deferred to Task 7.

## Review remediation

The Task 6 review found one critical, two important, and one minor issue. All have been corrected without changing Task 7 or backend code.

### Critical: real Axios multipart transport

- Both multipart posts now pass a request-level `Content-Type: false` Axios header. This explicitly prevents inheritance of the global JSON header, preserves the `FormData` body through Axios transforms, and leaves the browser to generate the multipart boundary.
- `apps/web/src/features/imports/api.multipart.test.ts` uses the real Axios instance and a custom adapter after the Axios transform pipeline. It proves both preview and creation still contain `FormData` and that Axios has no user-specified content type to serialize or override.

### Important: pagination and retriable query failures

- History and row errors now maintain independent page state (`10` and `20` rows respectively) and render the shared `Pagination` control from the API `meta` contract.
- Selecting a different import, or successfully creating one, resets row-error pagination to page one.
- History and row-error query failures now render a safe, retriable error state instead of an empty state.

### Minor: failed job copy

- A `FAILED` import now says `A importação falhou antes de ser concluída.` rather than claiming successful completion.

### Post-remediation verification

```text
pnpm --filter @prospectly/web test
Test Files  9 passed (9)
Tests       29 passed (29)

pnpm --filter @prospectly/web typecheck  # passed
pnpm --filter @prospectly/web lint       # passed
pnpm --filter @prospectly/web build      # passed
```

The production build still emits Vite's bundle-size advisory. Its current main bundle is `861.62 kB` uncompressed (`249.97 kB` gzip), compared with `860.52 kB` recorded before remediation. Code splitting was not expanded in this corrective pass because it is not necessary for the CSV correctness fixes and the application-wide route-loading strategy needs a dedicated, broad validation task.
