# Settings page complete (UI over existing APIs)

**Date:** 2026-07-25  
**Status:** Approved — implementing on `feat/settings-complete-ui`  
**Approach:** UI over existing APIs (no S3, no magic-link invites)

## Goal

Make `/settings` a complete account hub aligned with the dark zinc + cobalt app: profile (name + photo), organization rename, polished billing, invite members into the org (shared pipeline/activities), LGPD page + account deletion (DSR), cleaner scoring.

## Scope

### In

1. **Profile card** — avatar (upload compressed client-side → `avatarUrl` data URL or https), editable name, read-only email, locale
2. **Organization card** — rename via `PATCH /organizations/current` (OWNER/ADMIN)
3. **Billing card** — status row + currency/interval selects when not ACTIVE; portal/cancel when available
4. **Members card** — list; invite modal (name, email, role, generated temp password + copy); role change + remove for OWNER/ADMIN
5. **Privacy card** — link to `/settings/privacy`; export DSR; delete account modal → DSR DELETE
6. **Privacy page** — in-app LGPD summary + link to landing `/privacy`
7. **Scoring** — remove technical keys under labels

### Out

- Magic-link / email invites
- Object storage for avatars
- Automated hard-delete of accounts
- Cross-org pipeline sharing

## API changes

- `UpdateProfileDto.avatarUrl`: accept `https://…` **or** `data:image/(jpeg|png|webp);base64,…` with max decoded size ~120KB; increase max string length accordingly

## Web routes

- `/settings` — hub
- `/settings/privacy` — LGPD summary (protected, AppLayout)

## Security / UX notes

- Invite temp password shown once with copy; warn to share via secure channel
- Account deletion requires typed confirmation (`EXCLUIR` / `DELETE`)
- RBAC: invite/update/remove members and rename org only for OWNER/ADMIN; UI hides actions otherwise
