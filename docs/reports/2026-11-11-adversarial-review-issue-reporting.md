# Adversarial Review — In-Game Issue Reporting & Crash Ticketing (`TK-RPT-100`)

- **Branch:** `feature/tk-rpt-100-issue-reporting` (HEAD `8f9620e7`, base `main` @ `7780ac95`)
- **Spec:** [`docs/design/IN-GAME-ISSUE-REPORTING.md`](../design/IN-GAME-ISSUE-REPORTING.md) (v1.1)
- **Date:** 2026-11-11
- **Reviewer:** Antigravity (adversarial-review skill)

---

## 1. Executive Summary

**Verdict: DO NOT MERGE as "Complete".** `docs/TRACKING.md` marks `TK-RPT-100` Complete, but the review found **3 blockers, 8 high-severity issues, 13 medium issues and a set of low-severity items**.

Typecheck, lint, build and all 1,573 tests pass. The suite is green because the tests mostly exercise each module in isolation. Several of the headline guarantees fail when the modules are wired together:

1. **The outbox never retries.** `startWorker()` has no caller. Reports returned as "queued" are never delivered.
2. **The full session ID goes into GitHub issues.** The session ID is a bearer token. The spec requires it to be truncated to 8 characters "everywhere in issues and logs".
3. **Untrusted client strings are interpolated unescaped into the server-authored part of the issue body.** This undermines the untrusted-input contract (§7.3) that protects an autonomous `ai-ready` consumer.
4. Two of the five crash triggers in D5 are not wired: API failures and 5xx. The root `global-error` boundary cannot show the report UI at all. Crashes that happen before `/api/reports/status` resolves are silently dropped.

The architecture is mostly clean. No ECS, Death Protocol or immutability violations were found. The `@server/*` import boundary is respected. `proxy.ts` was correctly left unchanged, and the Makefile was not used. The problems are in the reporting feature's own wiring, security and spec parity.

## 2. Scope & Methodology

| Item | Detail |
| :-- | :-- |
| Commits reviewed | `37d1aad7`..`6988b193` (RPT-01..RPT-08) plus `8f9620e7` (docs only: persistence/hosting/accounts specs, noted in F-M13) |
| Diff size | 66 files, +6,457/−90 |
| Files read in full | All `src/server/reports/*`, `src/shared/reports/{schemas,sanitize,fingerprint}.ts`, both report routes, `turn-snapshot.ts`, `error-logger.ts` diff, `action/route.ts` diff, `src/client/reports/*`, all three modals, `IssueReporterRoot`, `error.tsx`, `global-error.tsx`, `setup.ts` diff, security test, crash route test |
| Rulebooks checked | `AGENTS.md`, `src/client/AGENTS.md`, `PERSISTENCE-AND-HOSTING-SPEC.md` |
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npm test` | ✅ 243 files / 1,573 tests pass |
| `npm run build` | ✅ succeeds. `/api/reports`, `/api/reports/crash` and `/api/reports/status` are registered. |

The verification suite did not exercise the wiring gaps below. They were found by tracing call sites with `grep` and reading the code.

---

## 3. Findings

### 🔴 Critical / Blocker

#### C-1 — Outbox retry worker is never started; "queued" reports are never delivered ✅ Resolved
- **Where:** [`outbox.ts#L247-L255`](../../src/server/reports/outbox.ts#L247-L255). A repo-wide search finds **zero** callers of `startWorker` outside the definition. The routes only call `reportOutbox.enqueue(...)`.
- **Spec:** §6.5 and D16 require a process-wide worker (`setInterval` 60 s, `unref`) that retries with backoff.
- **Impact:**
  - Any report that hits a GitHub 5xx, network error, 429 or 403 returns `queued` and stays on disk forever.
  - The player is told "will retry automatically", which is false.
  - Items are only drained if a test calls `processOutboxOnce()` manually. The unit tests never notice because they call it directly.
  - Restart recovery (a spec test requirement) is also not implemented, since nothing runs after boot.
- **Fix:**
  - Start the worker lazily and idempotently, guarded on `globalThis`. A good place is the first `enqueue`, plus module init of a shared `getReportOutbox()` used by the routes.
  - Add a test that proves enqueue results in a delivery attempt without a manual `processOutboxOnce()` call.

#### C-2 — Full session ID (bearer token) is written into the GitHub issue body ✅ Resolved
- **Where:**
  - [`turn-snapshot.ts#L118`](../../src/server/utils/turn-snapshot.ts#L118) puts `sessionId: ctx.sessionId` (untruncated) in `TurnSnapshotData`.
  - [`turn-snapshot.ts#L202`](../../src/server/utils/turn-snapshot.ts#L202) stores the whole snapshot as `sealed.rawSnapshot`.
  - [`crash/route.ts#L94`](../../src/app/api/reports/crash/route.ts#L94) passes `stateSnapshot: draft.sealed.rawSnapshot`.
  - [`composer.ts#L160-L166`](../../src/server/reports/composer.ts#L160-L166) serialises it as JSON in the issue body.
- **Spec:** §9 "Session ID truncated to 8 chars everywhere in issues and logs." §2 notes the session ID "is effectively a bearer token".
- **Impact:**
  - Every server-origin crash report puts a live credential into a GitHub issue.
  - Anyone with repo read access, any integration that mirrors issues, and the `ai-ready` agent all see it.
  - The same snapshot also contains the full `error.stack` (duplicating the stack section) and the raw `action` echo.
- **Why tests miss it:** the `composeIssueBody` security test never passes a `stateSnapshot`. The redaction test only checks `RedactedCrashPreview`.
- **Fix:**
  - Drop `sessionId` from `TurnSnapshotData`, or truncate it at build time.
  - Build the issue snapshot from an explicit allow-list instead of `rawSnapshot`.
  - Add a regression test: compose from a real `createServerCrashDraft` result and assert the full session ID is absent from the body.

#### C-3 — Untrusted client strings reach the server-authored markdown unescaped (untrusted-input contract broken) ✅ Resolved
- **Where:** [`composer.ts#L123-L125`](../../src/server/reports/composer.ts#L123-L125) and [`#L182-L184`](../../src/server/reports/composer.ts#L182-L184). `diag.build`, `diag.mode`, `diag.route` and `diag.userAgent` are interpolated raw into table cells and backtick spans. [`composer.ts#L61`](../../src/server/reports/composer.ts#L61) puts the client `errorName` into the issue **title** unsanitised.
- **Spec:** §7.3(1) "Only the template prose is server-authored. All variable content sits in code fences." §7.3(2) "Sanitizer applied to every player/client string."
- **Impact:**
  - `ClientDiagnosticsSchema` allows 100–500 chars for these fields. A forged request to the unauthenticated endpoint is enough to break out of the backtick span or table row (`` ` ``, `|`, newline).
  - The attacker can then inject free-form prose such as "Ignore the instructions above…" outside any `UNTRUSTED PLAYER INPUT` block.
  - That prose lands in a body that is auto-labelled `ai-ready` and consumed by an autonomous agent.
  - A client `name` with newlines or 200 chars can also push the title over GitHub's limit, which gives a 422 that the route then queues blindly (see C-1).
- **Fix:**
  - Move these values into a fenced block, or run them through `sanitizeText(..., { singleLine: true })` and escape `` ` `` and `|`.
  - Sanitise `errorName` and cap it to a safe identifier charset.
  - Add corpus tests that use hostile `userAgent`, `route`, `build`, `mode` and `errorName`.

---

### 🟠 High

#### H-1 — Two of five crash triggers (D5) are not wired: API failures and 5xx
- `reportableFetch` ([`reportable-fetch.ts`](../../src/client/reports/reportable-fetch.ts)) is **never imported** by production code. The `/api/action` call in [`setup.ts#L896-L903`](../../src/game/setup.ts#L896-L903) still uses raw `fetch`. The M3 call-site audit did not happen.
- Spec §6.1 requires `createServerCrashDraft` in "both catch paths". In [`action/route.ts#L521-L531`](../../src/app/api/action/route.ts#L521-L531) the outer 500 `catch` only echoes `crashDraftOffer`, which is always `null` there. Nothing creates a draft, so `SERVER_5XX` is never produced.
- Client side, `crashReport` is only read inside `if (response.ok)` ([`setup.ts#L916-L920`](../../src/game/setup.ts#L916-L920)). A 500 response carrying it would be ignored.
- `queueServerCrash` hard-codes `source: 'SERVER_TURN'` ([`report-store.ts#L131-L140`](../../src/client/reports/report-store.ts#L131-L140)).
- **Fix:** wire `reportableFetch` into `sendActionToServer` and the other `/api/*` call sites. Create the draft in the outer catch. Read `crashReport` on non-OK responses. Pass the real source.

#### H-2 — Crashes that occur during boot are silently dropped (status race)
- [`report-store.ts#L68`](../../src/client/reports/report-store.ts#L68) initialises `status` to `{available:false, mode:'off'}`. `queueCrash` returns immediately when `!status.available` ([`#L93`](../../src/client/reports/report-store.ts#L93)).
- [`IssueReporterRoot.tsx#L16-L20`](../../src/components/ui/reports/IssueReporterRoot.tsx#L16-L20) fires `fetchStatus()` without awaiting it, then runs `initErrorCollectors()`, which synchronously calls `checkPendingFatalCrash()`.
- **Impact:**
  - The sessionStorage-recovered crash (spec §5.2: "prompt on next boot") is removed from storage and then discarded by `queueCrash`, so it is lost.
  - Any error thrown before the status response arrives, typically the most important boot/hydration errors, is also dropped.
- **Fix:** hold early crashes in a pre-status pending list, and flush or drop them once `fetchStatus` resolves. Only remove the persisted draft after a successful enqueue.

#### H-3 — Root `global-error` cannot present a report UI
- [`global-error.tsx`](../../src/app/global-error.tsx) replaces the root layout, which is where `IssueReporterRoot` is mounted ([`layout.tsx`](../../src/app/layout.tsx)). Collectors and modals are therefore not mounted. `captureClientCrash` queues into a store nobody renders.
- Spec §5.1 requires "its own `<html>/<body>` with a self-contained report panel and a Reload button". The panel is missing.
- The component also relies on Tailwind utility classes. Confirm they exist for the root error shell; the other app UI uses CSS modules and design tokens.
- **Fix:** mount a self-contained report panel inside `global-error` that posts directly to `/api/reports/crash`, or render `<IssueReporterRoot />` inside it.

#### H-4 — Dry-run pollutes the persistent fingerprint index with a fake issue #99999
- [`crash/route.ts#L218-L219`](../../src/app/api/reports/crash/route.ts#L218-L219) calls `fingerprintIndex.recordNewIssue(fingerprint, 99999)` in dry-run mode. The index persists to `data/report-index.json`.
- **Impact:** after flipping to live, the first matching crash finds the fake entry. `getIssue(99999)` fails, the error is swallowed, and `isOpen` stays `true` ([`#L158-L167`](../../src/app/api/reports/crash/route.ts#L158-L167)). The route then tries to comment on a nonexistent or unrelated issue, fails, and queues the comment (C-1). Real crashes never get their own issue.
- **Fix:** never write to the persistent index in dry-run, or use a separate in-memory dry-run index. Treat a 404 from `getIssue` as "missing", which creates a new issue with `Previously: #N` per §6.4.

#### H-5 — No request-body size cap, and rate limit is consumed before validation ✅ Resolved
- Spec §4: "request body ≤ 128 KB". Both routes call `req.json()` directly ([`route.ts#L27`](../../src/app/api/reports/route.ts#L27), [`crash/route.ts#L33`](../../src/app/api/reports/crash/route.ts#L33)). The per-field Zod limits (e.g. 100 logs × 500 chars + 2 × 16 KB stacks) are checked only after the full body is buffered and parsed.
- The limiter is consumed **first** ([`route.ts#L16`](../../src/app/api/reports/route.ts#L16), [`crash/route.ts#L22`](../../src/app/api/reports/crash/route.ts#L22)), before JSON parsing, schema validation and the status/availability check. Garbage or invalid requests (including `503` while the feature is off) burn the global hourly quota. With global-only limits, an unauthenticated client can lock out all legitimate reporters with 20 or 40 trivial requests.
- **Fix:**
  - Check `Content-Length` and stream-limit the body to 128 KB.
  - Run the status check and Zod validation first, then consume the slot.
  - Add `.max()` and a finite check on all numeric fields.

#### H-6 — Server-origin issues show wrong/placeholder summary data ✅ Resolved
- For draft redemption, `composeIssueBody` is called with no `diagnostics` ([`crash/route.ts#L85-L98`](../../src/app/api/reports/crash/route.ts#L85-L98)). The Summary table therefore always shows `Build dev · Mode N/A · Floor N/A · Turn N/A` ([`composer.ts#L77-L82`](../../src/server/reports/composer.ts#L77-L82)), even though floor, turn and phase are known in the sealed data.
- The spec example shows the real build (`d7770af2`), mode, floor, turn and phase. The server config already has `buildSha`.
- **Impact:** every server crash is mislabeled, which breaks triage and the dedupe comment (`build` is `undefined` → `dev`).
- **Fix:** pass `config.buildSha`, `sealed.floor`, `sealed.turn` and `sealed.phase` into the composer.

#### H-7 — `ai-ready`-path dedupe can create duplicates under concurrency
- The fingerprint lookup and the `createIssue` call are separated by network awaits with no in-flight lock ([`crash/route.ts#L135-L247`](../../src/app/api/reports/crash/route.ts#L135-L247)). The common scenario is several players hitting the same new bug at once. All miss the index and each creates an issue.
- `processOutboxOnce` also has no re-entrancy guard ([`outbox.ts#L179-L190`](../../src/server/reports/outbox.ts#L179-L190)). A run longer than the 60 s interval (many items, slow GitHub) overlaps the next one and posts the same item twice.
- **Fix:** keep a per-fingerprint in-flight `Map<string, Promise>` in the route, and skip `processOutboxOnce` while `state === 'running'`.

#### H-8 — Missing wiring/spec tests that would have caught C-1, C-2, H-1, H-2, H-4
- Spec §11 requires route tests for "429, dedupe comment vs new, dry-run, session-mismatch rejection, single-use drafts". The crash route test has 3 tests: 404 for a missing draft, one dry-run success, and a client-origin dry-run. It has no 429, dedupe, mismatch or live path.
- There is no test that composes from a real `createServerCrashDraft` result, no wiring test for the worker, and no test for boot-time crash queuing.
- The "client bundle grep" in [`reports-security.test.ts`](../../tests/security/reports-security.test.ts) only scans source text for the token name. RPT-08 specified an actual bundle or build check.
- **Fix:** add the missing tests (see §5).

---

### 🟡 Medium / Spec Gap

| ID | Finding | Location | Fix |
| :-- | :-- | :-- | :-- |
| **M-1** ✅ | **403 is treated as a rate limit unless the message contains "credentials".** A fine-grained PAT with missing permissions ("Resource not accessible…") or an expired token behaves like a 429: 8 backoff retries, then `failed/`. The spec says 401/403 bad credentials must pause the worker (`blocked-auth`). | [`github-client.ts#L114-L136`](../../src/server/reports/github-client.ts#L114-L136) | **Resolved:** Classified 403 without rate-limit headers (`retry-after`, `x-ratelimit-remaining: 0`) or rate-limit/secondary message as `GitHubAuthError`. |
| **M-2** | **`ensureLabels` runs on every request and its guard is unreliable.** The routes construct a new `GitHubClient` per request, so `labelsEnsured` never persists. That is four `POST /labels` calls per report, each returning 422 after the first. The flag is set even when ensures failed (network, 401), so failures are never retried. The outbox path never ensures labels. | [`github-client.ts#L151-L170`](../../src/server/reports/github-client.ts#L151-L170), [`route.ts#L98-L104`](../../src/app/api/reports/route.ts#L98-L104), [`crash/route.ts#L138-L141`](../../src/app/api/reports/crash/route.ts#L138-L141) | Share a singleton client (or a module-level ensured flag). Set the flag only after every label succeeds or returns 422. |
| **M-3** | **Closed or missing existing issue does not produce a "Previously: #N" issue.** `composeIssueBody` has no such parameter. A deleted or 404 issue is also treated as open. | [`crash/route.ts#L157-L167`](../../src/app/api/reports/crash/route.ts#L157-L167), [`composer.ts`](../../src/server/reports/composer.ts) | Implement §6.4: on closed or 404, create a new issue and note `Previously: #N`. |
| **M-4** ✅ | **Untrusted markers are applied only to the Player Note.** Failed Action, Recent Client Events, Environment and client-origin Stack are fenced but have no `=== UNTRUSTED PLAYER INPUT ===` label. The server-sealed snapshot also embeds the raw client `action` echo. The spec says Tend relies on these markers to "recognize untrusted sections deterministically". | [`composer.ts#L129-L186`](../../src/server/reports/composer.ts#L129-L186) | **Resolved:** Added `=== UNTRUSTED PLAYER INPUT ===` delimiters to Failed Action, Recent Client Events, Environment, and client-origin Error/Stack Trace; `action` is omitted from the allow-listed sealed snapshot. |
| **M-5** ✅ | **`recentLogs[].t` is an unbounded `z.number()`.** `new Date(t).toISOString()` throws `RangeError` for out-of-range values, so the route returns 500 after consuming rate limit. | [`schemas.ts#L23`](../../src/shared/reports/schemas.ts#L23), [`composer.ts#L97`](../../src/server/reports/composer.ts#L97) | **Resolved:** Bounded `t` with `.finite().int().min(0).max(8.64e15)` and guarded timestamp formatting in `composer.ts`. |
| **M-6** ✅ | **Server crash `source` is trusted from the client.** `SERVER_TURN` vs `SERVER_5XX` is never checked against the redeemed draft. | [`crash/route.ts#L66-L98`](../../src/app/api/reports/crash/route.ts#L66-L98) | **Resolved:** Stored `source` in `ServerCrashDraft` and used `draft.source` during redemption instead of the client's value. |
| **M-7** | **Modal accessibility falls short of spec §10.** There is no focus trap and no focus restore. `aria-labelledby="crash-report-title"` / `"manual-report-title"` point to ids that do not exist, because `TaikokuPlacard` renders no `id`. Manual-form ESC and overlay click discard typed text with no "confirm if dirty". There is no `prefers-reduced-motion` handling. | [`ReportCrashModal.tsx#L58-L63`](../../src/components/ui/reports/ReportCrashModal.tsx#L58-L63), [`ReportIssueModal.tsx#L97-L102`](../../src/components/ui/reports/ReportIssueModal.tsx#L97-L102), [`TaikokuPlacard.tsx`](../../src/components/ui/atomic/TaikokuPlacard.tsx) | Add ids, a focus trap, focus restore and a dirty-confirm. |
| **M-8** | **Dismissing during submit leaves stale state.** ESC or overlay click while `isSubmitting` calls `dismissActiveCrash`. The in-flight request later sets `submissionResult`, so the next queued crash modal opens showing the previous report's "transmitted" panel. | [`report-store.ts#L142-L248`](../../src/client/reports/report-store.ts#L142-L248), [`ReportCrashModal.tsx#L27-L31`](../../src/components/ui/reports/ReportCrashModal.tsx#L27-L31) | Ignore dismiss while submitting, or tag results with the crash id. |
| **M-9** | **`F8` ignores availability.** It opens the manual modal even when `status.available` is false (e.g. production with no token). Submit then fails with 503. Menu entries are hidden but the hotkey is not gated. | [`IssueReporterRoot.tsx#L35-L38`](../../src/components/ui/reports/IssueReporterRoot.tsx#L35-L38) | Gate on `status.available`. |
| **M-10** | **Idempotency token for the manual form is not implemented** (spec §5.4). There is no token in the schema, store or route. Only the disabled button protects against double submit. | [`report-store.ts#L258-L287`](../../src/client/reports/report-store.ts#L258-L287) | Add a client UUID and a short-TTL server dedupe. |
| **M-11** ✅ | **Logger arguments are swapped throughout the server reports modules.** The engine signature is `(message, category, ...args)`, but calls use `logger.warn('REPORTS', 'msg', {…})`. Output reads `[<message text>]  REPORTS …`, so the category is the sentence and the message is "REPORTS". This is visible in the test output. It breaks log filtering for the "loud" `blocked-auth` and "ai-ready dropped" errors the spec asks for. | `outbox.ts`, `github-client.ts`, `fingerprint-index.ts`, `dry-run.ts`, `route.ts`, `crash/route.ts` | **Resolved:** Swapped arguments to `(message, 'REPORTS', meta)` across all server report modules and routes. |
| **M-12** | **Hosting spec conflict.** `PERSISTENCE-AND-HOSTING-SPEC.md` (added on this branch) targets Firebase App Hosting with `minInstances: 0` and an ephemeral filesystem (§1). The outbox ("survives a restart") and `report-index.json` live on local disk, and drafts and rate counters live in memory. Scale-to-zero loses queued reports and dedupe state. | `outbox.ts#L54`, `fingerprint-index.ts#L25` | Reconcile before deploying. At minimum move the outbox and index behind the interfaces already named in spec §13, and set `minInstances: 1`. |
| **M-13** | **Documentation and tracking.** There is no README or env documentation for `GITHUB_ISSUES_*` / `REPORTS_*` (RPT-08 deliverable). `.env.local` carries the three empty `GITHUB_ISSUES_*` vars but no `.env.example`. `TRACKING.md` marks the work Complete with the blockers above open. | `docs/TRACKING.md`, repo root | Add env docs and `.env.example`. Revert the tracker to In Progress until the Critical and High items are closed. |

---

### 🔵 Low / Code Quality & Minor

- **L-1 — Ref IDs are weak.** `generateRefId` uses `Math.random` with 4 characters (~1M values). Collisions overwrite the same `data/report-outbox/<ref>.json` or `failed/<ref>.json`, silently losing a report ([`composer.ts#L37-L44`](../../src/server/reports/composer.ts#L37-L44), [`outbox.ts#L80-L86`](../../src/server/reports/outbox.ts#L80-L86)). Use `crypto.randomBytes` and check for an existing file.
- **L-2 ✅ — Sanitizer is not idempotent.** A single-pass comment strip lets `<!<!-- -->-- x -->` re-form a comment. This is inert inside fences but live in titles. The tag regex also strips legitimate `<T>` text. `sanitizeStack` skips zero-width stripping ([`sanitize.ts#L18-L59`](../../src/shared/reports/sanitize.ts#L18-L59), [`#L93-L100`](../../src/shared/reports/sanitize.ts#L93-L100)). Loop to a fixed point. **Resolved:** Fixed-point loop, preserved `<T>` generics, and stripped zero-width chars in `sanitizeStack`.
- **L-3 ✅ — Final hard truncation can split a UTF-16 surrogate pair or cut a closing fence** ([`composer.ts#L227-L230`](../../src/server/reports/composer.ts#L227-L230)). **Resolved:** Added surrogate-safe slicing and closing-fence preservation in `composer.ts`.
- **L-4 — Outbox edge cases.**
  - `add-comment` items with no `issueNumber` fall through and are deleted as "success" ([`outbox.ts#L205-L210`](../../src/server/reports/outbox.ts#L205-L210)).
  - Permanent 4xx/422 errors are retried 8 times.
  - `saveItem` errors are uncaught, so a full disk turns an accepted report into a 500.
- **L-5 — Manual route queues every non-network failure** (both branches enqueue identical items; [`route.ts#L107-L131`](../../src/app/api/reports/route.ts#L107-L131)). Collapse the branches and classify retryable errors.
- **L-6 — `reportableFetch` URL matching is too loose.** `urlStr.includes('/api/')` matches third-party URLs. The full URL, which may contain query-string session IDs, is embedded in the message and the fingerprint ([`reportable-fetch.ts#L19-L45`](../../src/client/reports/reportable-fetch.ts#L19-L45)).
- **L-7 — Logger sink fires for DEBUG and runs the sanitizer on every log call** (including in production, since the sink runs before the `DEBUG` filter). Hot loops evict useful entries from the 100-entry buffer and add per-log regex cost ([`logger.ts#L60-L70`](../../src/engine/utils/logger.ts#L60-L70), [`ring-buffers.ts#L48-L55`](../../src/client/reports/ring-buffers.ts#L48-L55)). Filter to INFO and above on the client.
- **L-8 — Tests touch real project paths.** The route tests write dry-run files to `logs/reports/` and `fingerprintIndex.clear()` deletes the real `data/report-index.json`. Inject temp dirs. The `reportOutbox` singleton also creates `data/report-outbox/` as an import side effect.
- **L-9 — Crash recovery trusts `sessionStorage` JSON** without Zod validation, and only the *active* crash is persisted, not queued ones ([`collectors.ts#L107-L122`](../../src/client/reports/collectors.ts#L107-L122)).
- **L-10 — `ReportIssueModal` rebuilds `buildClientDiagnostics()` on every render/keystroke** ([`ReportIssueModal.tsx#L204-L206`](../../src/components/ui/reports/ReportIssueModal.tsx#L204-L206)). Memoise it.
- **L-11 — Import alias style.** The reports code uses `@/shared/...` and `@/server/...` instead of the documented layer aliases (`@shared/*`, `@server/*`). It works, but it weakens the grep-based boundary checks in `AGENTS.md`. Also, `src/client/reports/collectors.ts` imports `@/game/ui/store`. This is allowed but should be noted for the client rulebook.
- **L-12 — Crash route is a 249-line orchestration blob in an app route**, contradicting the spec's "thin routes delegate to `@server/reports`". Extract a `deliverReport()` service shared by both routes (this would also fix M-2 and H-7).
- **L-13 — `DraftStore` eviction is global FIFO (max 50).** A flood of failing turns from other sessions can evict a victim's pending draft before they approve it. Consider per-session caps.
- **L-14 ✅ — Search-by-fingerprint trusts any open issue containing the marker string** (best-effort per spec). Player note text is fenced but still body-searchable, so a player can steer dedupe comments onto an arbitrary issue. **Resolved:** `nr-fingerprint`, `nr-ref`, `nr-report`, and `nr-comment` markers in untrusted text/stacks are neutralized by `sanitizeText`/`sanitizeStack`.

---

## 4. Architecture & Engine Compliance

| Check | Result |
| :-- | :-- |
| ECS phase discipline / intents | N/A. No systems were added. |
| Death Protocol (`world.destroyEntity`) | ✅ Not touched. |
| Immutable component updates | ✅ `turn-snapshot` only reads components. |
| Pre-rollback capture ordering | ✅ `createServerCrashDraft` runs before rollback in the inner catch ([`action/route.ts#L142-L155`](../../src/app/api/action/route.ts#L142-L155)). |
| Anti-cheat: seed absent from client preview | ✅ `RedactedCrashPreview` omits the seed. The `sealedManifest` itemises "Dungeon Generation Seed" by label only. |
| Layer boundaries (client ↛ server) | ✅ No `@server/*` imports in `src/client/reports`. |
| `proxy.ts` not blocking `/api/reports/*` | ✅ Unchanged. |
| Makefile / new deps | ✅ None. |
| Logger sink in engine layer | ✅ Dependency-free. See L-7 for the production DEBUG cost. |

## 5. Actionable Remediation Plan

**Blockers (fix before merge)**
- [x] **C-1** Start the outbox worker (idempotent, `globalThis`-guarded). Add a test that enqueue results in delivery without a manual `processOutboxOnce()`.
- [x] **C-2** Remove or truncate `sessionId` in the snapshot. Replace `rawSnapshot` with an allow-listed snapshot. Add a regression test from a real draft.
- [x] **C-3** Sanitise or fence all client-supplied values in the Summary and Environment tables, and in the title. Add hostile-input tests.

**High**
- [ ] **H-1** Wire `reportableFetch`. Create a draft in the outer 500 catch. Handle `crashReport` on non-OK responses. Pass the real `SERVER_5XX` source.
- [ ] **H-2** Buffer crashes until `fetchStatus` resolves. Do not discard recovered drafts.
- [ ] **H-3** Give `global-error` a working, self-contained report panel.
- [ ] **H-4** Stop writing a fake `99999` to the persistent index in dry-run. Treat a 404 as a missing issue.
- [x] **H-5** Enforce the 128 KB body cap. Validate before consuming the rate-limit slot.
- [x] **H-6** Feed real build, floor, turn and phase into server-origin issue summaries.
- [ ] **H-7** Add an in-flight per-fingerprint lock and an outbox re-entrancy guard.
- [ ] **H-8** Add the missing tests: 429, dedupe comment vs new, session mismatch, live-path mocks, a boot-time crash and a bundle check.

**Medium**
- [ ] **M-1..M-13**, in the order listed. Prioritise M-1 (auth classification), M-2 (label spam), M-3 (closed-issue flow), M-4 (untrusted markers) and M-11 (logger args).

**Low**
- [ ] **L-1..L-14** can follow in a cleanup pass. L-1 (ref collisions) and L-4 (silent outbox drops) are quick wins.

**Process**
- [ ] Revert the `TRACKING.md` status to In Progress until the blockers and high items are closed.
- [ ] Re-run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` after fixes.
- [ ] Perform the §11 manual verification: force a server turn error, a client throw, and an outbox retry against a scratch repo.
