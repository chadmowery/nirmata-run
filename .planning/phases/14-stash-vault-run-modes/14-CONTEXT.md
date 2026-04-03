# Phase 14: Stash, Vault & Run Modes - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Persistent Vault storage (single between-run inventory replacing the Stash/Vault split), three run modes (Neural Simulation, Daily Challenge, Weekly One-Shot) with mode-specific rules and stakes, server-generated seeded runs, leaderboard scoring, universal pre-run Ritual for loadout preparation, and extraction-to-Vault persistence flow with overflow management.

</domain>

<decisions>
## Implementation Decisions

### Vault Persistence (Replaces Stash + Vault)
- **D-01:** Two-tier inventory only: Run Inventory (in-game, 5 slots) and Vault (persistent between-run storage). No separate Stash — the Vault IS the persistent store.
- **D-02:** Players can use Vault items in ANY run mode. No item locking. Risk is the player's call.
- **D-03:** Vault has a 30-slot limit (per STASH-02). Creates inventory management decisions.
- **D-04:** Vault items reuse the RunInventoryItem schema with an added `itemType` field (firmware/augment/software). Same shape in-run and in-vault, less duplication.
- **D-05:** Vault data stored in PlayerProfile JSON (extend existing `data/profiles/{sessionId}.json`). Add `vault: VaultItem[]` array alongside existing wallet/blueprintLibrary/installedItems.

### Extraction-to-Vault Flow
- **D-06:** On ANCHOR_EXTRACT, run-ender converts run inventory items to VaultItems and deposits them into an overflow/limbo state on the PlayerProfile. Currency goes to wallet with cap enforcement (per Phase 13 D-21).
- **D-07:** Vault overflow: extracted items land in a limbo array on the profile. Before the next run, players MUST clear enough space — sell, discard, or rearrange — to get under the 30-slot Vault cap. Run launch is blocked while overflow exists.
- **D-08:** The overflow management is API-only in Phase 14 (discard/sell endpoints). Phase 15 adds the UI.

### Virtual Shell & Simulation Mode
- **D-09:** Neural Simulation uses the player's real Shell and real gear — no Virtual Shell cloning or default loadouts.
- **D-10:** Death in Sim mode loses equipped Firmware/Augments/Software (same as all modes). Shell itself is NOT Factory Reset.
- **D-11:** Extracted loot from Sim runs transfers to real Vault. Full loot, no reduction.

### Run Mode Rules Matrix
- **D-12:** Three run modes with distinct rules:

  | | Neural Sim | Daily Challenge | Weekly One-Shot |
  |---|---|---|---|
  | Attempts | Unlimited | 1 per day | 1 per week |
  | Shell + Gear | Real | Real | Real |
  | Pre-run Ritual | Yes | Yes | Yes |
  | Death loss | Equipped Firmware/Augments/Software | Same | Same + Shell upgrade reset |
  | Leaderboard | No | Daily | Weekly |
  | Seed | Random | Shared daily (server-generated) | Shared weekly (server-generated) |

- **D-13:** Pre-run Ritual is universal — ALL run modes have the loadout preparation step where players equip items from Vault onto their Shell. Not Weekly-exclusive.
- **D-14:** Ritual is API-only in Phase 14 (equip-from-Vault endpoints). Phase 15 adds the ceremony UI.

### Weekly One-Shot Enforcement
- **D-15:** Weekly attempt tracking via PlayerProfile: `weeklyAttemptUsed: boolean` + `weekNumber: number`. Server rejects Weekly run launch if already attempted this week. Resets on weekly Format C:.
- **D-16:** Shell Factory Reset on Weekly death = normal equipment loss (Firmware/Augments/Software) PLUS Shell stat and Port upgrades revert to base. Upgrades are the extra Weekly stakes.
- **D-17:** Daily attempt tracking: same pattern as Weekly — `dailyAttemptUsed: boolean` + `dayNumber: number`. One attempt per day, server-enforced.

### Seeded Runs & Leaderboard
- **D-18:** Seeds are server-generated and stored in a rotation. Not date-derived hashes. Admin API to manage seed rotation.
- **D-19:** Leaderboard storage: JSON file per period — `data/leaderboards/daily-YYYY-MM-DD.json` and `data/leaderboards/weekly-YYYY-WNN.json`. Same file-based pattern as player profiles.
- **D-20:** Scoring formula: composite of depth reached + enemies killed + loot value extracted + speed (turns taken). All four factors contribute. Matches run results stats from Phase 12 (D-29).
- **D-21:** Score submission happens automatically on run end (extraction or death). Server-validated — clients cannot submit arbitrary scores.
- **D-22:** Neural Simulation runs: random seed each run, no leaderboard eligibility.

### Claude's Discretion
- Exact VaultItem schema extension of RunInventoryItem (which fields to add beyond itemType)
- Overflow limbo data structure and API endpoint design
- Seed rotation storage format and admin API shape
- Scoring formula weights and normalization
- Leaderboard JSON schema and max entries per period
- RunModeManager implementation pattern (system factory vs config object)
- Daily/Weekly attempt tracking reset timing (midnight UTC? configurable?)
- How run-ender distinguishes between run modes for applying mode-specific death rules
- Sell/discard item value calculations for overflow management

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Stash & Vault — STASH-01 through STASH-04 define persistent inventory, Vault protection, server persistence
- `.planning/REQUIREMENTS.md` §Run Modes — RUN-01 through RUN-07 define 3 run modes, Virtual Shell, mode selection, Ritual
- `.planning/ROADMAP.md` §Phase 14 — Success criteria, plan breakdown (14-01 through 14-04), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/12-multi-floor-generation-stability-extraction/12-CONTEXT.md` — Extraction pipeline (D-21), death flow (D-32), run results screen (D-29-D-31), Anchor interaction, post-run destination (D-33)
- `.planning/phases/13-currency-economy-blueprint-system/13-CONTEXT.md` — PlayerProfile schema and persistence (D-34), currency caps on extraction (D-21), run inventory integration (D-02-D-03), weekly reset Format C: (D-17-D-23), economy.json config pattern (D-28)
- `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` — Shell persistence, Port configuration, equipment slots, Shell upgrades (SHELL-05)
- `.planning/phases/10-software-system-enhanced-combat/10-CONTEXT.md` — Run inventory 5-slot system (D-05), Software loss on death

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, data flow
- `.planning/codebase/STRUCTURE.md` — Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Code style, import organization

### Key Source Files
- `src/game/systems/profile-persistence.ts` — PlayerProfile schema (extend with vault[], overflow[], attempt tracking fields)
- `src/game/systems/run-inventory.ts` — RunInventoryRegistry with in-memory stashes Map and transferToStash(). Vault persistence replaces the in-memory stash.
- `src/game/systems/run-ender.ts` — Run end logic with extraction/death handling. Extend for mode-specific death rules and Vault persistence.
- `src/game/engine-factory.ts` — EngineInitConfig with seed, sessionId, profile. Extend for run mode configuration.
- `src/game/entities/templates/economy.json` — Economy configuration. Extend for scoring formula weights.
- `src/shared/pipeline.ts` — Action pipeline. Extend for Ritual equip-from-Vault actions.
- `src/app/api/` — Existing economy/admin endpoints. Add run-mode, leaderboard, seed-rotation, overflow-management endpoints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PlayerProfile` + `loadProfile()`/`saveProfile()` in `profile-persistence.ts` — Direct extension point for Vault array, overflow, and attempt tracking
- `RunInventoryRegistry` with `transferToStash()` — Current extraction flow. Replace in-memory stash with profile-persisted Vault write
- `RunInventoryItem` interface — Reuse for VaultItem with added `itemType` field
- `createRunEnderSystem()` — Already handles extraction vs death with RUN_ENDED event. Extend for mode-specific death rules
- `economy.json` — Centralized config pattern. Add scoring weights, seed rotation config
- `data/profiles/` directory pattern — Follow for `data/leaderboards/` and `data/seeds/`

### Established Patterns
- JSON file per entity for persistence (`data/profiles/{sessionId}.json`)
- Zod schemas for all data structures with defaults
- REST API routes in `src/app/api/` for server endpoints
- System factory pattern for game systems
- Action pipeline for server-validated mutations
- Event-driven architecture (eventBus.emit/on)

### Integration Points
- `src/game/systems/profile-persistence.ts` — Extend PlayerProfile schema with vault, overflow, attemptTracking
- `src/game/systems/run-ender.ts` — Mode-aware death handling, Vault persistence on extraction
- `src/game/systems/run-inventory.ts` — Replace in-memory stash with profile Vault write
- `src/game/engine-factory.ts` — Accept run mode in EngineInitConfig, pass to systems
- `src/app/api/` — New endpoints: run-mode selection, leaderboard read/submit, seed rotation, overflow management, Ritual equip
- `data/leaderboards/` — New directory for period-based leaderboard JSON files
- `data/seeds/` — New directory for server-generated seed rotation storage

</code_context>

<specifics>
## Specific Ideas

- The merged Vault (no Stash/Vault split) simplifies the mental model: you have your gear in the Vault, you equip it for a run, you extract to get more gear back into the Vault. One persistent store.
- Vault overflow/limbo creates a natural between-run management moment without blocking extraction itself — you always get your loot, but you must deal with it before going again.
- Universal Ritual (all modes, not just Weekly) means the pre-run loadout step is a core gameplay beat, not an edge case. Every run starts with "what am I bringing?"
- One-attempt Daily alongside one-attempt Weekly creates a daily/weekly cadence: practice in Sims, compete in Daily for incremental leaderboard, save your best for the Weekly.
- Server-generated seed rotation (not date-hash) gives admin control over interesting seeds and prevents seed prediction.

</specifics>

<deferred>
## Deferred Ideas

- Overflow management UI — Phase 15 (Neural Deck Hub)
- Ritual ceremony UI — Phase 15 (Neural Deck Hub)
- Run mode selection UI — Phase 15 (Neural Deck Hub)
- Leaderboard display UI — Phase 15 (Neural Deck Hub)
- Vault expansion mechanism (increasing 30-slot cap) — future phase
- Automatic daily/weekly reset scheduling (cron) — deferred, admin-triggered for now

</deferred>

---

*Phase: 14-stash-vault-run-modes*
*Context gathered: 2026-04-02*
