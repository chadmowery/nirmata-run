# Phase 14: Stash, Vault & Run Modes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 14-stash-vault-run-modes
**Areas discussed:** Stash/Vault persistence, Virtual Shell & Sim mode, Weekly enforcement & Ritual, Seeded runs & leaderboard, Vault slot limits & schema, Daily Challenge rules, Run mode differences matrix, Extraction-to-Vault flow

---

## Stash/Vault Persistence

**User correction (before options presented):** "The stash is the vault. We should only have run inventory and a vault."

| Option | Description | Selected |
|--------|-------------|----------|
| Extend PlayerProfile | Add stash[] and vault[] to existing profile | |
| Separate stash JSON | Dedicated file per player | |
| *User override* | Merge Stash and Vault into single Vault | Yes |

**User's choice:** Merged Stash + Vault into a single "Vault" persistent store.
**Notes:** Two-tier system only: Run Inventory (in-game) and Vault (persistent). No Stash/Vault distinction.

---

## Virtual Shell & Sim Mode

| Option | Description | Selected |
|--------|-------------|----------|
| No equipment loss on death | Sim = safe mode, no gear lost | |
| Temporary Shell clone | Copy of Shell, originals safe | |
| Default loadout only | Fixed starter gear for Sims | |
| *User override* | Real Shell, real gear, normal death loss | Yes |

**User's choice:** "No equipment loss on death but equipped software and other items are lost on death."
**Notes:** Sim uses real Shell and real gear. Death still destroys equipped Firmware/Augments/Software. Shell itself not Factory Reset.

---

## Vault Item Access

| Option | Description | Selected |
|--------|-------------|----------|
| Virtual Shells handle it | Vault items always available, Sims use temp copies | |
| Vault items locked from Sims | Can't use Vault gear in Simulations | |
| *User override* | Players can use vault items in any run | Yes |

**User's choice:** "Players can use vault items in any run. It's up to them to decide when to use vaulted items."
**Notes:** No locking mechanic. Player agency over risk.

---

## Weekly Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Profile flag + server block | Track weeklyAttemptUsed + weekNumber | Yes |

**User's choice:** Profile flag + server block
**Notes:** Server rejects repeat attempts. Reset on Format C:.

## Factory Reset (Weekly Death)

| Option | Description | Selected |
|--------|-------------|----------|
| Strip all equipment + reset upgrades | Maximum punishment | |
| Normal death + upgrade reset | Normal loss plus upgrades revert to base | Yes |
| Normal death only | Same as other modes | |

**User's choice:** Normal death + upgrade reset
**Notes:** Upgrades are the extra Weekly stakes beyond standard equipment loss.

## Pre-run Ritual

| Option | Description | Selected |
|--------|-------------|----------|
| API-only in Phase 14 | Build endpoints, UI in Phase 15 | Yes |
| Minimal React UI | Simple transfer screen | |

**User's choice:** API-only in Phase 14

**User correction:** "All runs have the same pre-run ritual where players create their loadout for the run."
**Notes:** Ritual is universal across all run modes, not Weekly-exclusive.

---

## Seeded Runs

| Option | Description | Selected |
|--------|-------------|----------|
| Date-based hash | Deterministic from date | |
| Server-generated rotation | Admin-managed seed storage | Yes |

**User's choice:** Server-generated rotation

## Leaderboard Storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSON file per period | data/leaderboards/daily-YYYY-MM-DD.json | Yes |
| Single leaderboard JSON | One file with nested sections | |

**User's choice:** JSON file per period

## Scoring Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Depth + kills + loot + speed | All four factors composite | Yes |
| Depth-weighted composite | Depth primary, others tiebreakers | |

**User's choice:** Depth + kills + loot + speed (equal composite)

---

## Vault Slot Limits

| Option | Description | Selected |
|--------|-------------|----------|
| 30 slots (per STASH-02) | Original requirement | Yes |
| Unlimited | No cap | |
| Larger cap (100+) | Generous but finite | |

**User's choice:** 30 slots

## Vault Item Schema

| Option | Description | Selected |
|--------|-------------|----------|
| New VaultItem type | Purpose-built schema | |
| Reuse RunInventoryItem | Add itemType field to existing | Yes |

**User's choice:** Reuse RunInventoryItem with added itemType

---

## Daily Challenge Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Unlimited attempts | Best score counts | |
| Limited attempts (e.g., 3) | Moderate pressure | |
| One attempt per day | High pressure | Yes |

**User's choice:** One attempt per day

| Option | Description | Selected |
|--------|-------------|----------|
| Normal death rules | Same equipment loss as Sim | Yes |
| Equipment loss + partial Vault tax | Extra punishment | |

**User's choice:** Normal death rules (moderate stakes = no upgrade reset, unlike Weekly)

---

## Run Mode Matrix

**User confirmed** the full matrix with correction that Ritual is universal across all modes.

## Sim Seeds

**User confirmed:** Random seed per Sim run (covered by matrix confirmation).

---

## Extraction-to-Vault Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Run-ender persists to profile | Atomic write on extraction | |
| Deferred write via API | Two-step decoupled | |
| *User override* | Extraction deposits to overflow/limbo | Yes |

**User's choice:** Items go to overflow/limbo state. Players must clear space before next run.

## Vault Full Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Oldest items auto-discard | FIFO push out | |
| Extraction blocked until space | Limbo until managed | Yes |
| Overflow lost | Items beyond 30 lost | |

**User's choice:** "Players must clear enough space in their vault, sell, or discard items held in limbo from previous run and/or reward."
**Notes:** Run launch blocked while overflow exists. Creates natural between-run management step.

---

## Claude's Discretion

- VaultItem schema details beyond itemType
- Overflow limbo data structure
- Seed rotation storage and admin API
- Scoring formula weights
- Leaderboard max entries
- RunModeManager implementation pattern
- Attempt tracking reset timing

## Deferred Ideas

- Overflow management UI — Phase 15
- Ritual ceremony UI — Phase 15
- Run mode selection UI — Phase 15
- Leaderboard display UI — Phase 15
- Vault expansion mechanism — future phase
- Automatic reset scheduling — deferred
