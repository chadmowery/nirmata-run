# Adversarial Re-Review — In-Game Issue Reporting & Crash Ticketing (`TK-RPT-100`)

- **Branch:** `fix/tk-rpt-100-issues` (HEAD `085906fb`, base `feature/tk-rpt-100-issue-reporting` @ `751577f8`)
- **Prior Report:** [`docs/reports/2026-11-11-adversarial-review-issue-reporting.md`](./2026-11-11-adversarial-review-issue-reporting.md)
- **Spec:** [`docs/design/IN-GAME-ISSUE-REPORTING.md`](../design/IN-GAME-ISSUE-REPORTING.md) (v1.1)
- **Date:** 2026-11-14
- **Reviewer:** Antigravity (adversarial-review skill)

---

## 1. Executive Summary

**Verdict: SUBSTANTIALLY REMEDIATED — 1 remaining security/spec gap (High) and 3 new/residual issues (1 Medium, 2 Low) should be fixed before merge.**

All **3 blockers (C-1..C-3)**, **8 high-severity findings (H-1..H-8)**, **13 medium findings (M-1..M-13)**, and **14 low findings (L-1..L-14)** from the 2026-11-11 audit have been implemented in code and backed by passing tests. `npm run typecheck`, `npm run lint`, `npm test` (244 files / 1,630 tests), and `npm run build` all pass cleanly on `085906fb`.

However, adversarial re-checking uncovered **one remaining session-ID leak into GitHub issues** (bypassing the C-2 fix via client `recentLogs`) and **one capture-phase keyboard regression** in the report modals, plus two minor edge cases:

1. **Full `sessionId` still leaks into GitHub issues via `recentLogs` (High):** `src/app/page.tsx:124` logs the full `sessionId` with `logger.info(...)`, which `initLoggerSink()` captures into `logRingBuffer` and includes unredacted in `ClientDiagnostics.recentLogs` on manual reports and client crashes.
2. **Capture-phase `e.stopPropagation()` on `window` blocks child `keydown` events in both modals (Medium):** `ReportCrashModal.tsx` and `ReportIssueModal.tsx` call `e.stopPropagation()` on every `keydown` in the `window` capture phase, preventing `keydown` from reaching inputs, textareas, selects, and buttons inside the modal.
3. **Side effect inside React state updater (`ReportIssueModal.tsx`)** and **suppressed first dedupe comment after `searchIssueByFingerprint` fallback (`delivery.ts`)** (Low).

---

## 2. Scope & Verification Results

| Check | Result |
| :-- | :-- |
| Commits reviewed | `fa5d6ac4`..`085906fb` (36 commits on `fix/tk-rpt-100-issues`, 71 files changed, +4,068/−696) |
| `npm run typecheck` | ✅ Clean (`tsc --noEmit`, exit 0) |
| `npm run lint` | ✅ Clean (`eslint src/`, exit 0) |
| `npx vitest run` | ✅ 244 / 244 files passed, 1,630 / 1,630 tests passed |
| `npm run build` | ✅ Clean (`next build`, exit 0; `/api/reports`, `/api/reports/crash`, `/api/reports/status` registered) |

---

## 3. Prior Audit Verification Matrix

| Prior Finding(s) | Status | Verification Notes |
| :-- | :-- | :-- |
| **C-1** Outbox worker never started | ✅ Verified Fixed | [`outbox.ts`](../../src/server/reports/outbox.ts#L333-L341) initializes `getReportOutbox()` (`globalThis`-guarded) and calls `startWorker()` on module init and `enqueue()`. |
| **C-2** Full `sessionId` in issue body | ⚠️ **Partial** | Server drafts now use `buildAllowListedIssueSnapshot` and truncate `sessionId` in `TurnSnapshotData`. **However**, full `sessionId` still leaks via `page.tsx:124` → `logRingBuffer` → `recentLogs` (see **NH-1** below). |
| **C-3** Untrusted strings unescaped in markdown/title | ✅ Verified Fixed | [`composer.ts`](../../src/server/reports/composer.ts#L108-L287) and [`sanitize.ts`](../../src/shared/reports/sanitize.ts#L102-L118) apply `sanitizeErrorName`, `sanitizeTitle`, `sanitizeInlineValue`, and fence Environment. |
| **H-1** Missing `API_FAILURE` & `SERVER_5XX` wiring | ✅ Verified Fixed | `reportableFetch` wired in `setup.ts`, `page.tsx`, and Hub components; `action/route.ts` creates `SERVER_5XX` drafts in outer catch; `setup.ts` queues `errData.crashReport`. |
| **H-2** Boot crash status race | ✅ Verified Fixed | [`report-store.ts`](../../src/client/reports/report-store.ts#L71-L129) buffers crashes in `preStatusQueue` until `fetchStatus()` resolves. |
| **H-3** `global-error` report panel | ✅ Verified Fixed | [`global-error.tsx`](../../src/app/global-error.tsx) renders a self-contained inline-styled panel that checks `/api/reports/status` and posts `REACT_RENDER` crashes. |
| **H-4** Dry-run pollutes persistent index | ✅ Verified Fixed | [`fingerprint-index.ts`](../../src/server/reports/fingerprint-index.ts#L152-L153) & [`delivery.ts`](../../src/server/reports/delivery.ts#L261-L262) isolate dry-run to in-memory `dryRunFingerprintIndex`. |
| **H-5** 128 KB cap & validate before rate limit | ✅ Verified Fixed | [`body-limit.ts`](../../src/server/reports/body-limit.ts) enforces 128 KB stream cap; both routes check status, read body, and run Zod before `reportsRateLimiter.consume()`. |
| **H-6** Placeholder server summary metadata | ✅ Verified Fixed | [`crash/route.ts`](../../src/app/api/reports/crash/route.ts#L93-L97) passes `cfg.buildSha`, `draft.sealed.mode`, `floor`, `turn`, `phase`. |
| **H-7** Concurrency dedupe race | ✅ Verified Fixed | [`delivery.ts`](../../src/server/reports/delivery.ts#L140-L162) serializes per fingerprint via `withFingerprintLock`; [`outbox.ts`](../../src/server/reports/outbox.ts#L230-L310) guards `state === 'running'`. |
| **H-8** Missing §11 wiring/spec tests | ✅ Verified Fixed | Added tests across `crash/__tests__/route.test.ts`, `report-store.test.ts`, `collectors.test.ts`, `outbox.test.ts`, and `reports-security.test.ts`. |
| **M-1..M-13** | ✅ Verified Fixed | Auth 403 classification, `getGitHubClient` singleton & label caching, `Previously: #N`, `UNTRUSTED PLAYER INPUT` markers, bounded `t`, server-side `draft.source`, focus trap & `titleId`, submit-dismiss guard, `F8` availability gate, `idempotencyKey`, swapped logger args, storage interfaces & hosting docs, `.env.example` / `README.md` / `TRACKING.md`. |
| **L-1..L-14** | ✅ Verified Fixed | `crypto.randomInt` + outbox collision check, fixed-point sanitizer + `<T>` preservation + `nr-*` neutralization, surrogate-safe fence-preserving truncation, outbox 4xx/invalid/disk handling, `reportableFetch` same-origin/query strip, `DEBUG` sink skip, tmpdir test isolation, Zod `sessionStorage` recovery, memoized diagnostics, layer aliases, `delivery.ts` extraction, per-session `DraftStore` cap. |

---

## 4. New & Residual Findings

### 🟠 High

#### NH-1 — Full `sessionId` (bearer token) still leaks into GitHub issues via `ClientDiagnostics.recentLogs` (Residual C-2)
- **Where:**
  - [`src/app/page.tsx#L124`](../../src/app/page.tsx#L124): `logger.info(\`Server session initialized: ${sessionId}\`, 'NETWORK');`
  - [`src/client/reports/ring-buffers.ts#L45-L55`](../../src/client/reports/ring-buffers.ts#L45-L55): `initLoggerSink()` captures every non-`DEBUG` `logger` call into `logRingBuffer`.
  - [`src/shared/reports/sanitize.ts#L95-L97`](../../src/shared/reports/sanitize.ts#L95-L97): `sanitizeLogMessage()` does not redact UUIDs or session IDs.
  - (Also note: server `logger` calls in [`src/app/api/action/route.ts`](../../src/app/api/action/route.ts#L73), [`src/app/api/session/route.ts`](../../src/app/api/session/route.ts#L90), and [`src/server/session/session-manager.ts`](../../src/server/session/session-manager.ts#L98) still log full `sessionId` to server stdout, whereas spec §9 states "Session ID truncated to 8 chars everywhere in issues and logs".)
- **Impact:**
  - Every time a player starts a session via `page.tsx` and subsequently submits a manual report (with diagnostics enabled) or triggers any client crash (`CLIENT_ERROR`, `CLIENT_REJECTION`, `REACT_RENDER`, `API_FAILURE`), the full `sessionId` bearer token is transmitted in `recentLogs` and written into the public/AI-consumed GitHub issue body.
- **Required Fix:**
  1. Truncate `sessionId` to `${sessionId.slice(0, 8)}…` in [`src/app/page.tsx#L124`](../../src/app/page.tsx#L124) (and in server `logger.*` calls per spec §9).
  2. Add defense-in-depth redaction in `sanitizeLogMessage()` (or `initLoggerSink()`) for `session(Id)?[:= ]+<token>` / UUID patterns when `sessionId` is known, and add a regression test asserting full `sessionId` cannot pass through `recentLogs` into `composeIssueBody`.

---

### 🟡 Medium

#### NM-1 — Capture-phase `e.stopPropagation()` on `window` blocks child `keydown` events in both report modals
- **Where:**
  - [`src/components/ui/reports/ReportCrashModal.tsx#L29-L42`](../../src/components/ui/reports/ReportCrashModal.tsx#L29-L42)
  - [`src/components/ui/reports/ReportIssueModal.tsx#L77-L87`](../../src/components/ui/reports/ReportIssueModal.tsx#L77-L87)
- **Detail:** Both modals register `window.addEventListener('keydown', handleKeyDown, true)` (capture phase) and unconditionally execute `e.stopPropagation()` for **every** key (not only `Escape`). Because `useModalFocusTrap` registers its capture listener earlier, `Tab` focus trapping still runs, but all other `keydown` events are stopped at `window` before reaching any child element inside the modal.
- **Impact:**
  - React `onKeyDown` handlers inside the modal never fire, and keyboard interactions on `<button>`, `<select>`, `<input>`, and `<textarea>` elements (e.g., `Enter`/`Space` activation on buttons, arrow navigation on `<select>`) can be blocked in real browsers. Unit tests missed this because they use `fireEvent.change` / `fireEvent.click` rather than real browser keyboard dispatch.
- **Required Fix:**
  - Attach `onKeyDown={(e) => e.stopPropagation()}` on the modal container (bubble phase) or only stop propagation to game listeners **after** the event has reached the modal's target (i.e., use bubble phase on `window` or on the modal overlay, and only call `e.stopPropagation()` in capture phase for `Escape`).

---

### 🔵 Low

- **NL-1 — Side effect inside React state updater (`ReportIssueModal.tsx`):** [`ReportIssueModal.tsx#L45-L51`](../../src/components/ui/reports/ReportIssueModal.tsx#L45-L51) calls `closeManualReport()` (which mutates Zustand state) inside `setConfirmingDiscard((prev) => ...)`. In React 19 StrictMode, updater functions are invoked twice, causing double store updates. Read `confirmingDiscard` directly (or via a ref) outside the state updater.
- **NL-2 — First dedupe comment suppressed after `searchIssueByFingerprint` fallback (`delivery.ts`):** In [`delivery.ts#L278-L311`](../../src/server/reports/delivery.ts#L278-L311), when `searchIssueByFingerprint` discovers an existing open issue on GitHub (e.g., after a server restart), `activeIndex.recordNewIssue(fingerprint, searchedIssue)` sets `lastCommentAt = now`. The immediately following `activeIndex.recordOccurrence(fingerprint)` sees `now - lastCommentAt < 10 min` and sets `canComment = false`, suppressing the first occurrence comment on that issue. Pass `lastCommentAt: 0` (or an option) when hydrating from GitHub search so the first post-restart occurrence can comment normally.

---

## 5. Actionable Remediation Plan

- [x] **NH-1 (High):** Truncate `sessionId` in [`src/app/page.tsx#L124`](../../src/app/page.tsx#L124) (and server `logger` calls) and add a regression test ensuring `recentLogs` cannot leak a full `sessionId` into `composeIssueBody`. *(Fixed: added `truncateSessionId`/`redactKnownTokens`/`redactSessionTokens` in `sanitize.ts`, wired active session token redaction into `initLoggerSink` and `composeIssueBody`, truncated `sessionId` across client/server `logger` calls, and added regression tests.)*
- [x] **NM-1 (Medium):** Remove unconditional `e.stopPropagation()` from the `window` capture-phase `keydown` listeners in [`ReportCrashModal.tsx`](../../src/components/ui/reports/ReportCrashModal.tsx#L39) and [`ReportIssueModal.tsx`](../../src/components/ui/reports/ReportIssueModal.tsx#L84) (stop propagation in bubble phase on the dialog/overlay instead, keeping `Escape` handled cleanly). *(Fixed: removed unconditional `e.stopPropagation()` from `window` capture-phase listeners, added `onKeyDown={(e) => e.stopPropagation()}` on both modal overlays, guarded `InputManager` against active `aria-modal="true"` dialogs, and added regression tests.)*
- [x] **NL-1 (Low):** Move `closeManualReport()` out of the `setConfirmingDiscard` updater in [`ReportIssueModal.tsx#L45-L51`](../../src/components/ui/reports/ReportIssueModal.tsx#L45-L51). *(Fixed: read `confirmingDiscard` directly in `requestClose`, moved `closeManualReport()` outside `setConfirmingDiscard`, and added a StrictMode regression test.)*
- [x] **NL-2 (Low):** Initialize `lastCommentAt = 0` when hydrating `fingerprintIndex` from `searchIssueByFingerprint` in [`delivery.ts#L278`](../../src/server/reports/delivery.ts#L278). *(Fixed: added optional `{ lastCommentAt?: number }` parameter to `FingerprintIndex.recordNewIssue` / `FingerprintIndexInterface`, passed `{ lastCommentAt: 0 }` during search fallback hydration in `delivery.ts`, and added unit & route regression tests.)*
- [x] Re-run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` after fixing *(Verified on `8a7e53eb`: typecheck clean, lint clean, 244 / 244 files and 1,639 / 1,639 tests passed, `next build` clean)*.
- [ ] Complete the §11 manual scratch-repo verification with a live test PAT and `GITHUB_ISSUES_ENABLED=true`.
