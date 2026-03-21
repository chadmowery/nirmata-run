# External Integrations

**Analysis Date:** 2024-05-24

## APIs & External Services

**Not detected:**
- No external APIs or SDKs (like Stripe, Supabase, AWS) detected in imports.

## Data Storage

**Databases:**
- None detected. The application uses an in-memory `SessionManager` (`src/engine/session/SessionManager.ts`) for active games.

**File Storage:**
- Local filesystem only.

**Caching:**
- None detected.

## Authentication & Identity

**Auth Provider:**
- Custom / Anonymous. Current session management relies on generated `sessionId` from API requests using `crypto.randomUUID()` in `src/app/api/session/route.ts`.

## Monitoring & Observability

**Error Tracking:**
- None detected. Relies on standard `console.error` in API routes (`src/app/api/action/route.ts`).

**Logs:**
- Standard console logging.

## CI/CD & Deployment

**Hosting:**
- Next.js default (Vercel assumed, but no explicit config found).

**CI Pipeline:**
- None detected.

## Environment Configuration

**Required env vars:**
- None detected explicitly required in codebase.

**Secrets location:**
- Not applicable.

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- None detected.

---

*Integration audit: 2024-05-24*
