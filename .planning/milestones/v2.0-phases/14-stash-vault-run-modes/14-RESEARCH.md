# Phase 14: Stash, Vault & Run Modes - Research

**Researched:** 2026-04-02
**Domain:** Persistent inventory storage, run mode systems, seeded competitive runs, leaderboard scoring
**Confidence:** HIGH

## Summary

Phase 14 implements a persistent Vault inventory system (replacing the in-memory stash), three distinct run modes with mode-specific risk/reward profiles, server-generated seeded runs for competitive play, and a leaderboard system with composite scoring. The architecture follows the established JSON file-based persistence pattern, extends the existing PlayerProfile schema, and integrates with the run-ender and extraction systems from Phase 12.

The technical domain is well-understood: deterministic seeded generation using the existing rot-js RNG infrastructure, JSON file storage for profiles and leaderboards, run mode configuration objects passed through the engine factory, and overflow management via API-enforced constraints. The phase is primarily extension work on existing systems rather than greenfield development.

**Primary recommendation:** Extend PlayerProfile schema with vault/overflow/attempt-tracking fields, create a RunModeConfig object passed through EngineInitConfig, implement mode-aware death handling in run-ender, and use the existing mulberry32 PRNG pattern for seed management rather than rot-js RNG (which is floor-specific, not run-wide).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vault Persistence (Replaces Stash + Vault)**
- **D-01:** Two-tier inventory only: Run Inventory (in-game, 5 slots) and Vault (persistent between-run storage). No separate Stash — the Vault IS the persistent store.
- **D-02:** Players can use Vault items in ANY run mode. No item locking. Risk is the player's call.
- **D-03:** Vault has a 30-slot limit (per STASH-02). Creates inventory management decisions.
- **D-04:** Vault items reuse the RunInventoryItem schema with an added `itemType` field (firmware/augment/software). Same shape in-run and in-vault, less duplication.
- **D-05:** Vault data stored in PlayerProfile JSON (extend existing `data/profiles/{sessionId}.json`). Add `vault: VaultItem[]` array alongside existing wallet/blueprintLibrary/installedItems.

**Extraction-to-Vault Flow**
- **D-06:** On ANCHOR_EXTRACT, run-ender converts run inventory items to VaultItems and deposits them into an overflow/limbo state on the PlayerProfile. Currency goes to wallet with cap enforcement (per Phase 13 D-21).
- **D-07:** Vault overflow: extracted items land in a limbo array on the profile. Before the next run, players MUST clear enough space — sell, discard, or rearrange — to get under the 30-slot Vault cap. Run launch is blocked while overflow exists.
- **D-08:** The overflow management is API-only in Phase 14 (discard/sell endpoints). Phase 15 adds the UI.

**Virtual Shell & Simulation Mode**
- **D-09:** Neural Simulation uses the player's real Shell and real gear — no Virtual Shell cloning or default loadouts.
- **D-10:** Death in Sim mode loses equipped Firmware/Augments/Software (same as all modes). Shell itself is NOT Factory Reset.
- **D-11:** Extracted loot from Sim runs transfers to real Vault. Full loot, no reduction.

**Run Mode Rules Matrix**
- **D-12:** Three run modes with distinct rules (see table in CONTEXT.md)
- **D-13:** Pre-run Ritual is universal — ALL run modes have the loadout preparation step where players equip items from Vault onto their Shell. Not Weekly-exclusive.
- **D-14:** Ritual is API-only in Phase 14 (equip-from-Vault endpoints). Phase 15 adds the ceremony UI.

**Weekly One-Shot Enforcement**
- **D-15:** Weekly attempt tracking via PlayerProfile: `weeklyAttemptUsed: boolean` + `weekNumber: number`. Server rejects Weekly run launch if already attempted this week. Resets on weekly Format C:.
- **D-16:** Shell Factory Reset on Weekly death = normal equipment loss (Firmware/Augments/Software) PLUS Shell stat and Port upgrades revert to base. Upgrades are the extra Weekly stakes.
- **D-17:** Daily attempt tracking: same pattern as Weekly — `dailyAttemptUsed: boolean` + `dayNumber: number`. One attempt per day, server-enforced.

**Seeded Runs & Leaderboard**
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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STASH-01 | The Stash is the player's persistent inventory for extracted items (Firmware, Augments, Software, Materials) | PlayerProfile vault array extension, JSON persistence pattern, RunInventoryItem reuse |
| STASH-02 | The Vault is a small protected sub-inventory (e.g., 30 slots) — items placed here cannot be used in Neural Simulations, only in Daily/Weekly runs | **REVISED by D-02:** Vault is now the single persistent store, no item locking, 30-slot cap enforced via overflow management |
| STASH-03 | Items in the Vault are "Locked" for competitive runs to prevent practice-mode consumption | **DROPPED by D-02:** No item locking mechanism needed, players choose risk |
| STASH-04 | Server-side persistence ensures Stash/Vault state survives between sessions | PlayerProfile JSON file persistence at `data/profiles/{sessionId}.json` |
| RUN-01 | Neural Simulation mode: unlimited runs using "Virtual Shells" — low stakes, full loot drops, used for practice and stash building | **REVISED by D-09:** Uses real Shell/gear, no Virtual Shell cloning; Random seed per run (D-22) |
| RUN-02 | Daily Challenge mode: all players share the same daily seed, cumulative high-score leaderboard, moderate stakes | Shared seed from server rotation (D-18), daily leaderboard JSON (D-19), one attempt per day (D-17) |
| RUN-03 | Weekly One-Shot mode: all players share the same weekly seed, one attempt per week, full stakes — Firmware/Augments/Software lost on death, Shell Factory Reset on failure | Shared seed from server rotation (D-18), weekly leaderboard JSON (D-19), one attempt per week (D-15), Shell upgrade reset (D-16) |
| RUN-04 | Run mode selection happens at the Neural Deck before starting a run | API-only in Phase 14 (D-14), UI in Phase 15; API endpoint returns available modes, run launch endpoint accepts mode parameter |
| RUN-05 | Each run mode has distinct rules for what equipment is at risk, how scoring works, and which Shell type (Virtual vs Physical) is used | RunModeConfig passed through EngineInitConfig, mode-aware run-ender logic (D-12) |
| RUN-06 | Virtual Shells in Neural Simulation mode are temporary copies — equipment attached to them doesn't come from the player's real Stash | **DROPPED by D-09:** Simulation uses real Shell/gear, loot goes to real Vault |
| RUN-07 | The Weekly One-Shot includes a pre-run "Ritual" step where the player moves their best items from Stash/Vault into their Active Shell | **REVISED by D-13:** Ritual is universal to all modes, API-only in Phase 14 (D-14) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Schema validation and TypeScript inference | Already used for PlayerProfile, economy config, all data schemas; zero-cost abstraction at runtime |
| rot-js | 2.2.1 | RNG seeding for dungeon generation | Already used for floor-level seeding via `RNG.setSeed()` and `RNG.getUniform()`; stable, feature-complete (0.5.0 from 2014) |
| Node.js fs/promises | Built-in | Async file system operations | Project standard for PlayerProfile persistence; atomic writes via temp file + rename pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom mulberry32 PRNG | N/A (in-repo) | Seeded random for weekly/daily seed rotation | Already implemented in `shop-rotation.ts`; preferred over rot-js for run-wide seeding (rot-js is floor-specific) |
| Next.js API Routes | 16.1.6 | REST endpoints for run mode, leaderboard, vault operations | Project standard for economy endpoints; `/api/run-mode/launch`, `/api/leaderboard/submit`, `/api/vault/overflow` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON file storage | SQLite / PostgreSQL | JSON is simpler for file-per-entity pattern, no query needs, inspectable with cat/less, already proven in profile-persistence.ts; database adds dependency for marginal benefit |
| Custom mulberry32 | rot-js RNG for seed rotation | rot-js is used for spatial generation (floor layouts), mulberry32 is already proven for shop rotation; keep separation of concerns |
| Leaderboard in profile JSON | Separate leaderboard service | File-based leaderboards match project scale (single-player with shared seeds, not MMO); can migrate to DB later if needed |

**Installation:**
```bash
# All dependencies already installed in package.json
# Zod: 4.3.6
# rot-js: 2.2.1
# next: 16.1.6
```

**Version verification:** Versions confirmed from package.json (read during research 2026-04-02). Training data aligns with installed versions.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── game/
│   ├── systems/
│   │   ├── profile-persistence.ts    # Extend PlayerProfile schema
│   │   ├── run-inventory.ts          # Vault read/write integration
│   │   ├── run-ender.ts              # Mode-aware death handling
│   │   ├── vault-manager.ts          # NEW: overflow, discard, sell
│   │   ├── run-mode-config.ts        # NEW: mode definitions
│   │   └── seed-rotation.ts          # NEW: seed storage and retrieval
│   ├── engine-factory.ts             # Extend EngineInitConfig with runMode
│   └── entities/templates/
│       ├── economy.json              # Extend with scoring weights
│       └── run-modes.json            # NEW: mode config (attempts, stakes)
├── app/api/
│   ├── run-mode/
│   │   ├── launch/route.ts           # Launch run with mode + seed
│   │   └── available/route.ts        # Get available modes (check attempts)
│   ├── leaderboard/
│   │   ├── submit/route.ts           # Server-validated score submission
│   │   ├── daily/route.ts            # GET daily leaderboard
│   │   └── weekly/route.ts           # GET weekly leaderboard
│   ├── vault/
│   │   ├── overflow/route.ts         # List/manage overflow items
│   │   ├── discard/route.ts          # Discard item from overflow
│   │   └── sell/route.ts             # Sell item from overflow for scrap
│   └── admin/
│       ├── seed-rotation/route.ts    # Manage seed rotation
│       └── reset-attempts/route.ts   # Reset daily/weekly attempts
data/
├── profiles/                         # Existing
├── leaderboards/                     # NEW: daily/weekly JSON files
└── seeds/                            # NEW: seed rotation storage
```

### Pattern 1: PlayerProfile Schema Extension
**What:** Extend existing PlayerProfile Zod schema with vault, overflow, and attempt tracking.
**When to use:** All vault persistence, extraction, overflow management, run launch validation.
**Example:**
```typescript
// Source: Existing pattern in src/game/systems/profile-persistence.ts

const VaultItemSchema = z.object({
  entityId: z.number(),
  templateId: z.string(),
  rarityTier: z.string(),
  itemType: z.enum(['firmware', 'augment', 'software']), // D-04
  extractedAtFloor: z.number(),
  extractedAtTimestamp: z.number(),
});

const OverflowItemSchema = VaultItemSchema; // Same shape (Claude's discretion)

const AttemptTrackingSchema = z.object({
  weekNumber: z.number().default(0),        // D-15
  weeklyAttemptUsed: z.boolean().default(false),
  dayNumber: z.number().default(0),         // D-17
  dailyAttemptUsed: z.boolean().default(false),
});

export const PlayerProfileSchema = z.object({
  sessionId: z.string(),
  wallet: z.object({
    scrap: z.number().int().min(0).default(0),
    flux: z.number().int().min(0).default(0),
  }).default({ scrap: 0, flux: 0 }),
  blueprintLibrary: z.array(BlueprintEntrySchema).default([]),
  installedItems: z.array(InstalledItemSchema).default([]),
  shellUpgrades: z.record(z.string(), ShellUpgradesSchema).default({}),
  weekSeed: z.number().default(0),
  vault: z.array(VaultItemSchema).default([]),              // D-05: 30-slot cap enforced in logic
  overflow: z.array(OverflowItemSchema).default([]),        // D-07: limbo for extraction
  attemptTracking: AttemptTrackingSchema.default({}),       // D-15, D-17
  createdAt: z.number().default(() => Date.now()),
});
```

### Pattern 2: Run Mode Configuration Object
**What:** Pass run mode config through EngineInitConfig to systems.
**When to use:** Engine factory, run-ender system, leaderboard submission, any mode-aware logic.
**Example:**
```typescript
// Source: Extended pattern from src/game/engine-factory.ts EngineInitConfig

export enum RunMode {
  SIMULATION = 'simulation',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export interface RunModeConfig {
  mode: RunMode;
  seed: string;                     // D-18: server-provided seed
  isLeaderboardEligible: boolean;   // D-22: false for Simulation
  deathPenalty: {
    loseEquipment: boolean;         // D-12: true for all modes
    resetShellUpgrades: boolean;    // D-16: true for Weekly only
  };
}

export interface EngineInitConfig {
  width: number;
  height: number;
  seed: string;
  isClient?: boolean;
  shellRecord?: ShellRecord;
  sessionId?: string;
  profile?: PlayerProfile;
  runMode?: RunModeConfig;          // NEW: mode-specific rules
}
```

### Pattern 3: Extraction-to-Vault Pipeline with Overflow
**What:** Extend run-ender to write extracted items to vault overflow array.
**When to use:** On ANCHOR_EXTRACT event in run-ender system.
**Example:**
```typescript
// Source: Extended pattern from src/game/systems/run-ender.ts executeRunEnd()

async function executeRunEnd(playerId: EntityId, reason: string, isSuccess: boolean) {
  if (!sessionId) return;

  if (isSuccess) {
    // Currency: existing extraction logic (cap enforcement per Phase 13 D-21)
    const profile = await loadProfile(sessionId);
    if (!profile) throw new Error('Profile not found');

    // Items: move run inventory to vault overflow (D-06)
    const runInventory = runInventoryRegistry.getOrCreate(sessionId).software;
    const vaultItems: VaultItem[] = runInventory.map(item => ({
      ...item,
      itemType: inferItemType(item.templateId), // firmware/augment/software
      extractedAtFloor: floorNumber,
      extractedAtTimestamp: Date.now(),
    }));

    profile.overflow.push(...vaultItems); // D-07: lands in limbo
    await saveProfile(profile);

    // Clear run inventory after vault write
    runInventoryRegistry.clearSoftware(sessionId);
  } else {
    // Death: existing pity logic + mode-aware shell reset (D-16)
    if (runMode?.deathPenalty.resetShellUpgrades) {
      profile.shellUpgrades = {}; // Weekly Factory Reset
    }
  }
}
```

### Pattern 4: Leaderboard JSON File Per Period
**What:** Store leaderboard entries in period-specific JSON files.
**When to use:** Score submission, leaderboard retrieval.
**Example:**
```typescript
// Source: New pattern following data/profiles/{sessionId}.json convention

// Leaderboard schema (Claude's discretion)
const LeaderboardEntrySchema = z.object({
  sessionId: z.string(),
  score: z.number(),
  depth: z.number(),
  kills: z.number(),
  lootValue: z.number(),
  turns: z.number(),
  timestamp: z.number(),
});

const LeaderboardSchema = z.object({
  period: z.string(),               // "daily-2026-04-02" or "weekly-2026-W14"
  seed: z.string(),
  entries: z.array(LeaderboardEntrySchema).max(100), // Max entries (Claude's discretion)
});

// File paths (D-19)
// data/leaderboards/daily-2026-04-02.json
// data/leaderboards/weekly-2026-W14.json

async function submitScore(sessionId: string, runStats: RunStats, period: string) {
  const leaderboardPath = path.join('data', 'leaderboards', `${period}.json`);
  let leaderboard = await loadLeaderboard(leaderboardPath) ?? createEmpty(period);
  
  const score = calculateScore(runStats); // D-20: composite formula
  const entry = { sessionId, score, ...runStats, timestamp: Date.now() };
  
  leaderboard.entries.push(entry);
  leaderboard.entries.sort((a, b) => b.score - a.score); // Descending
  leaderboard.entries = leaderboard.entries.slice(0, 100); // Keep top 100
  
  await saveLeaderboard(leaderboardPath, leaderboard);
}
```

### Pattern 5: Seed Rotation Storage
**What:** Store server-generated seeds in JSON rotation file.
**When to use:** Run launch (get current seed), admin API (manage rotation).
**Example:**
```typescript
// Source: New pattern (Claude's discretion on exact schema)

const SeedRotationSchema = z.object({
  daily: z.object({
    currentDayNumber: z.number(),
    seed: z.string(),
    generatedAt: z.number(),
  }),
  weekly: z.object({
    currentWeekNumber: z.number(),
    seed: z.string(),
    generatedAt: z.number(),
  }),
});

// data/seeds/rotation.json
async function getCurrentDailySeed(): Promise<string> {
  const rotation = await loadSeedRotation();
  const today = getDayNumber(); // e.g., days since epoch or YYYYMMDD
  
  if (rotation.daily.currentDayNumber !== today) {
    // Generate new daily seed (D-18: server-generated, not date hash)
    rotation.daily.seed = generateRandomSeed();
    rotation.daily.currentDayNumber = today;
    rotation.daily.generatedAt = Date.now();
    await saveSeedRotation(rotation);
  }
  
  return rotation.daily.seed;
}
```

### Anti-Patterns to Avoid
- **Date-derived seed hashing:** D-18 specifies server-generated seeds, not date hashes. Don't use `hash(YYYY-MM-DD)` — use stored random seeds with rotation logic.
- **Client-side score calculation:** D-21 specifies server-validated scores. Client submits run stats, server calculates score. Never trust client-provided scores.
- **Synchronous file writes:** Use async `fs/promises` with atomic write pattern (temp file + rename) per existing `saveProfile()`.
- **Vault cap enforcement on pickup:** D-07 specifies overflow management happens between runs, not during extraction. Let extraction succeed, handle overflow before next launch.
- **Mixing rot-js RNG for run seeds:** rot-js `RNG.setSeed()` is global state used for floor generation. Use mulberry32 for run-level seed derivation (already proven in shop-rotation.ts).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seeded PRNG for run seeds | Custom hash-based RNG | Existing mulberry32 in `shop-rotation.ts` | Already implemented, tested, proven for weekly seed stability; rot-js RNG has global state collision risk with floor generation |
| Schema validation | Manual JSON parsing with type assertions | Zod schemas with `.parse()` | Project standard (PlayerProfile, economy.json); runtime type safety, clear error messages, TypeScript inference |
| Atomic file writes | Direct `fs.writeFile()` | Temp file + rename pattern | Already used in `saveProfile()`; prevents corruption on crash/interruption |
| Run mode state machine | Ad-hoc conditionals scattered across systems | RunModeConfig passed through engine init | Centralized mode rules, testable in isolation, single source of truth |
| Score calculation | Ad-hoc formulas in client | Server-validated scoring function with configurable weights | D-21 enforces server authority; weights in economy.json for balance tuning |
| Leaderboard sorting/filtering | Manual array operations | Zod-validated JSON with top-N slicing | Ensures consistent schema, prevents unbounded file growth, matches profile persistence pattern |

**Key insight:** This phase is primarily extension work on proven patterns. The project already has:
- PlayerProfile persistence (extend schema)
- Run-ender with extraction/death flows (add mode-awareness)
- Seed management (mulberry32 for rotation, rot-js for floor generation)
- API endpoint patterns (follow economy endpoints)
- JSON config files (economy.json → extend with scoring weights)

The risk is NOT "can we build X" but "did we integrate correctly with existing systems." Testing strategy should focus on integration points: extraction-to-vault, mode-aware death, attempt tracking validation, seed rotation freshness.

## Common Pitfalls

### Pitfall 1: Seed Collision Between Run and Floor Generation
**What goes wrong:** Using rot-js `RNG.setSeed()` for both run-level seeds (daily/weekly) and floor-level seeds causes determinism to break — floor generation overwrites run-level RNG state.
**Why it happens:** rot-js RNG is global state (`RNG.setSeed()` affects all consumers). Floor-manager already calls `RNG.setSeed(hashSeedForPlacement(floorSeed))` on every floor transition.
**How to avoid:** Use mulberry32 (shop-rotation.ts pattern) for run-level seeding (seed rotation, leaderboard period keys). Reserve rot-js RNG exclusively for spatial generation (dungeon layout, entity placement). Never call `RNG.setSeed()` with run seeds.
**Warning signs:** Daily/weekly runs with same seed produce different floor layouts between players. Shop rotation broken after implementing run modes.

### Pitfall 2: Vault Overflow Blocks Extraction
**What goes wrong:** Extraction fails if vault overflow would exceed 30 slots, leaving player stuck mid-run.
**Why it happens:** Misreading D-07 as "block extraction if vault full" instead of "extraction always succeeds, overflow management happens before next run."
**How to avoid:** Extraction ALWAYS writes to `profile.overflow` array, never checks vault capacity. Run launch validation checks `profile.overflow.length === 0` and rejects if overflow exists. Overflow is a between-run state, not an in-run blocker.
**Warning signs:** Players report "can't extract because vault full" — this should never happen. Extraction should always succeed.

### Pitfall 3: Mode-Specific Death Rules Applied Incorrectly
**What goes wrong:** Shell Factory Reset happens on all deaths, not just Weekly. Or Daily deaths don't lose equipment.
**Why it happens:** Run-ender doesn't receive runMode config, or mode detection logic is wrong.
**How to avoid:** Pass `RunModeConfig` through `EngineInitConfig` to engine-factory, thread to run-ender via constructor/init. Run-ender reads `runMode.deathPenalty.resetShellUpgrades` (D-16) and `runMode.deathPenalty.loseEquipment` (D-12). Default to safest penalty if runMode is undefined (lose equipment, no shell reset).
**Warning signs:** Players report "lost Shell upgrades in practice mode" or "kept items after Daily death."

### Pitfall 4: Attempt Tracking Doesn't Reset
**What goes wrong:** Players can't launch Daily after previous day, or Weekly after Format C:.
**Why it happens:** Attempt reset logic not called when day/week number changes.
**How to avoid:** Run launch endpoint checks `profile.attemptTracking.dayNumber !== currentDayNumber()` (D-17) and resets `dailyAttemptUsed = false`. Weekly reset (existing `executeWeeklyReset()`) must reset `weeklyAttemptUsed = false` and update `weekNumber` (D-15). Admin API endpoint for manual reset.
**Warning signs:** Players report "can't play Daily/Weekly even though period changed."

### Pitfall 5: Client-Submitted Scores Enable Cheating
**What goes wrong:** Players submit fabricated scores by modifying client requests.
**Why it happens:** Score calculation happens client-side, API trusts client-provided score value.
**How to avoid:** D-21 specifies server-validated scores. Client submits `{ sessionId, runStats: { depth, kills, lootValue, turns } }`. Server calculates score using formula from economy.json, validates against profile state (did they actually complete a run?), writes to leaderboard. Never accept `score` field from client.
**Warning signs:** Leaderboard shows impossible scores (negative turns, depth > 15, etc.).

### Pitfall 6: Leaderboard File Growth Unbounded
**What goes wrong:** Daily leaderboard JSON files grow to megabytes over time.
**Why it happens:** No max entries limit, all scores kept forever.
**How to avoid:** Leaderboard schema enforces max entries (e.g., 100 per period). After adding new entry, sort descending by score and slice to top N. Old periods remain small, can archive/delete after period ends.
**Warning signs:** Leaderboard API slows down, file sizes in `data/leaderboards/` grow large.

### Pitfall 7: Vault Item Type Inference Fails
**What goes wrong:** Extracted items land in vault with wrong `itemType`, can't be equipped.
**Why it happens:** `inferItemType(templateId)` logic doesn't match actual template naming conventions.
**How to avoid:** Item templateId naming convention must be consistent. Firmware ends with `.sh`/`.exe`/`.sys`, Augments end with `.arc`, Software has version suffix `v0`-`v3`. `inferItemType()` uses suffix/pattern matching. Document convention in CONVENTIONS.md. Test with all item types from templates.
**Warning signs:** Phase 15 UI shows "Unknown type" for vault items, equip-from-vault fails.

### Pitfall 8: Seed Rotation Admin API Not Idempotent
**What goes wrong:** Calling weekly reset twice generates two different seeds.
**Why it happens:** Admin reset endpoint doesn't check if reset already happened for this period.
**How to avoid:** Admin endpoints check `profile.weekSeed === newWeekSeed` (existing pattern in `executeWeeklyReset()`) or `rotation.weekly.currentWeekNumber === weekNumber` before generating new seed. Return early if already reset. Document idempotency guarantee.
**Warning signs:** Players report different seeds after admin manually re-runs weekly reset.

## Code Examples

Verified patterns from official sources and existing codebase:

### Extending PlayerProfile Schema
```typescript
// Source: Existing pattern in src/game/systems/profile-persistence.ts
// Extended with Phase 14 fields per D-05, D-07, D-15, D-17

import { z } from 'zod';

const VaultItemSchema = z.object({
  entityId: z.number(),
  templateId: z.string(),
  rarityTier: z.string(),
  itemType: z.enum(['firmware', 'augment', 'software']),
  extractedAtFloor: z.number(),
  extractedAtTimestamp: z.number(),
});

export const PlayerProfileSchema = z.object({
  sessionId: z.string(),
  wallet: z.object({
    scrap: z.number().int().min(0).default(0),
    flux: z.number().int().min(0).default(0),
  }).default({ scrap: 0, flux: 0 }),
  blueprintLibrary: z.array(BlueprintEntrySchema).default([]),
  installedItems: z.array(InstalledItemSchema).default([]),
  shellUpgrades: z.record(z.string(), ShellUpgradesSchema).default({}),
  weekSeed: z.number().default(0),
  vault: z.array(VaultItemSchema).default([]),
  overflow: z.array(VaultItemSchema).default([]),
  attemptTracking: z.object({
    weekNumber: z.number().default(0),
    weeklyAttemptUsed: z.boolean().default(false),
    dayNumber: z.number().default(0),
    dailyAttemptUsed: z.boolean().default(false),
  }).default({}),
  createdAt: z.number().default(() => Date.now()),
});

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
```

### Run Mode Configuration in Engine Factory
```typescript
// Source: Extended from src/game/engine-factory.ts EngineInitConfig

export enum RunMode {
  SIMULATION = 'simulation',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export interface RunModeConfig {
  mode: RunMode;
  seed: string;
  isLeaderboardEligible: boolean;
  deathPenalty: {
    loseEquipment: boolean;
    resetShellUpgrades: boolean;
  };
}

export interface EngineInitConfig {
  width: number;
  height: number;
  seed: string;
  isClient?: boolean;
  shellRecord?: ShellRecord;
  sessionId?: string;
  profile?: PlayerProfile;
  runMode?: RunModeConfig; // NEW
}

// Usage: Pass mode-specific config when creating engine
const config: EngineInitConfig = {
  width: 80,
  height: 45,
  seed: dailySeed, // From seed rotation
  sessionId: 'session-123',
  profile: playerProfile,
  runMode: {
    mode: RunMode.DAILY,
    seed: dailySeed,
    isLeaderboardEligible: true,
    deathPenalty: { loseEquipment: true, resetShellUpgrades: false },
  },
};
```

### Extraction-to-Vault with Overflow
```typescript
// Source: Extended from src/game/systems/run-ender.ts executeRunEnd()

import { loadProfile, saveProfile } from './profile-persistence';
import { runInventoryRegistry } from './run-inventory';

async function executeRunEnd(
  playerId: EntityId, 
  reason: string, 
  isSuccess: boolean,
  sessionId?: string,
  runMode?: RunModeConfig
) {
  if (!sessionId) return;
  
  const profile = await loadProfile(sessionId);
  if (!profile) throw new Error('Profile not found');

  if (isSuccess) {
    // Currency: existing logic with cap enforcement (Phase 13)
    const scrap = runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap');
    profile.wallet.scrap = Math.min(
      profile.wallet.scrap + scrap, 
      economy.caps.scrap
    );

    // Items: transfer run inventory to vault overflow (D-06, D-07)
    const runInventory = runInventoryRegistry.getOrCreate(sessionId).software;
    const vaultItems = runInventory.map(item => ({
      ...item,
      itemType: inferItemType(item.templateId),
      extractedAtFloor: floorNumber,
      extractedAtTimestamp: Date.now(),
    }));

    profile.overflow.push(...vaultItems);
    runInventoryRegistry.clearSoftware(sessionId);
  } else {
    // Death: pity + mode-specific shell reset (D-16)
    const pityScrap = Math.floor(
      runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap') * 
      economy.pity.deathScrapPercent
    );
    profile.wallet.scrap += pityScrap;

    if (runMode?.deathPenalty.resetShellUpgrades) {
      profile.shellUpgrades = {}; // Weekly Factory Reset
    }
    
    runInventoryRegistry.clear(sessionId);
  }

  await saveProfile(profile);
  
  // Emit RUN_ENDED with leaderboard eligibility flag
  eventBus.emit('RUN_ENDED', {
    reason,
    isSuccess,
    isLeaderboardEligible: runMode?.isLeaderboardEligible ?? false,
    stats: { depth: floorNumber, /* ... */ }
  });
}

function inferItemType(templateId: string): 'firmware' | 'augment' | 'software' {
  if (templateId.endsWith('.sh') || templateId.endsWith('.exe') || templateId.endsWith('.sys')) {
    return 'firmware';
  }
  if (templateId.endsWith('.arc')) {
    return 'augment';
  }
  return 'software'; // Has version suffix v0-v3
}
```

### Seed Rotation with Mulberry32
```typescript
// Source: Existing mulberry32 pattern in src/game/systems/shop-rotation.ts
// Extended for daily/weekly seed rotation (D-18)

function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateRandomSeed(): string {
  // Use crypto.randomBytes for unpredictable seeds (server-side only)
  const bytes = crypto.randomBytes(16);
  return bytes.toString('hex');
}

async function getCurrentDailySeed(): Promise<string> {
  const rotationPath = path.join('data', 'seeds', 'rotation.json');
  let rotation = await loadSeedRotation(rotationPath);
  
  const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Days since epoch
  
  if (rotation.daily.currentDayNumber !== today) {
    rotation.daily.seed = generateRandomSeed();
    rotation.daily.currentDayNumber = today;
    rotation.daily.generatedAt = Date.now();
    await saveSeedRotation(rotationPath, rotation);
  }
  
  return rotation.daily.seed;
}
```

### Leaderboard Score Calculation and Submission
```typescript
// Source: New pattern following D-20 composite scoring formula

interface RunStats {
  depth: number;
  kills: number;
  lootValue: number;
  turns: number;
}

function calculateScore(stats: RunStats): number {
  // D-20: Composite of depth + kills + loot + speed
  // Weights from economy.json (Claude's discretion on exact values)
  const weights = economy.scoring;
  
  const depthScore = stats.depth * weights.depthMultiplier;
  const killScore = stats.kills * weights.killMultiplier;
  const lootScore = stats.lootValue * weights.lootMultiplier;
  
  // Speed: inverse relationship (fewer turns = better)
  // Normalize: maxTurns / actualTurns to reward efficiency
  const speedScore = (weights.maxTurns / Math.max(stats.turns, 1)) * weights.speedMultiplier;
  
  return Math.floor(depthScore + killScore + lootScore + speedScore);
}

async function submitScore(
  sessionId: string, 
  runStats: RunStats, 
  period: string, 
  seed: string
) {
  const leaderboardPath = path.join('data', 'leaderboards', `${period}.json`);
  let leaderboard = await loadLeaderboard(leaderboardPath);
  
  if (!leaderboard) {
    leaderboard = { period, seed, entries: [] };
  }
  
  // Server calculates score (D-21: no client trust)
  const score = calculateScore(runStats);
  
  const entry = {
    sessionId,
    score,
    depth: runStats.depth,
    kills: runStats.kills,
    lootValue: runStats.lootValue,
    turns: runStats.turns,
    timestamp: Date.now(),
  };
  
  leaderboard.entries.push(entry);
  leaderboard.entries.sort((a, b) => b.score - a.score); // Descending
  leaderboard.entries = leaderboard.entries.slice(0, 100); // Top 100
  
  await saveLeaderboard(leaderboardPath, leaderboard);
  return score;
}
```

### Attempt Tracking Validation
```typescript
// Source: New pattern following D-15, D-17 attempt enforcement

function getCurrentDayNumber(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Days since epoch
}

function getCurrentWeekNumber(): number {
  // ISO week number or weeks since epoch
  const epoch = new Date('2026-01-01').getTime();
  return Math.floor((Date.now() - epoch) / (1000 * 60 * 60 * 24 * 7));
}

async function canLaunchRun(sessionId: string, mode: RunMode): Promise<boolean> {
  const profile = await loadProfile(sessionId);
  if (!profile) return false;
  
  if (mode === RunMode.SIMULATION) {
    return true; // Unlimited attempts
  }
  
  if (mode === RunMode.DAILY) {
    const today = getCurrentDayNumber();
    if (profile.attemptTracking.dayNumber !== today) {
      // New day, reset attempt
      profile.attemptTracking.dayNumber = today;
      profile.attemptTracking.dailyAttemptUsed = false;
      await saveProfile(profile);
      return true;
    }
    return !profile.attemptTracking.dailyAttemptUsed;
  }
  
  if (mode === RunMode.WEEKLY) {
    const currentWeek = getCurrentWeekNumber();
    if (profile.attemptTracking.weekNumber !== currentWeek) {
      // New week, reset attempt (also handled by Format C:)
      profile.attemptTracking.weekNumber = currentWeek;
      profile.attemptTracking.weeklyAttemptUsed = false;
      await saveProfile(profile);
      return true;
    }
    return !profile.attemptTracking.weeklyAttemptUsed;
  }
  
  return false;
}

async function markAttemptUsed(sessionId: string, mode: RunMode): Promise<void> {
  if (mode === RunMode.SIMULATION) return;
  
  const profile = await loadProfile(sessionId);
  if (!profile) throw new Error('Profile not found');
  
  if (mode === RunMode.DAILY) {
    profile.attemptTracking.dailyAttemptUsed = true;
  } else if (mode === RunMode.WEEKLY) {
    profile.attemptTracking.weeklyAttemptUsed = true;
  }
  
  await saveProfile(profile);
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npm run test -- src/game/systems/vault-manager.test.ts src/game/systems/seed-rotation.test.ts src/app/api/run-mode/__tests__/ -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STASH-01 | Vault persists extracted items in PlayerProfile JSON | integration | `npm test -- src/game/systems/vault-manager.test.ts::test_extraction_to_vault -x` | ❌ Wave 0 |
| STASH-02 | Vault enforces 30-slot cap via overflow management | unit | `npm test -- src/game/systems/vault-manager.test.ts::test_vault_overflow -x` | ❌ Wave 0 |
| STASH-04 | Vault state survives session reload | integration | `npm test -- src/app/api/session/__tests__/persistence.test.ts::test_vault_persistence -x` | ❌ Wave 0 |
| RUN-01 | Simulation mode: random seed, unlimited attempts, real gear | unit | `npm test -- src/app/api/run-mode/__tests__/launch.test.ts::test_simulation_launch -x` | ❌ Wave 0 |
| RUN-02 | Daily mode: shared seed, one attempt per day, leaderboard eligible | integration | `npm test -- src/app/api/run-mode/__tests__/launch.test.ts::test_daily_launch -x` | ❌ Wave 0 |
| RUN-03 | Weekly mode: shared seed, one attempt per week, Shell Factory Reset on death | integration | `npm test -- src/app/api/run-mode/__tests__/launch.test.ts::test_weekly_death -x` | ❌ Wave 0 |
| RUN-04 | Run launch API validates attempts and returns current seed | unit | `npm test -- src/app/api/run-mode/__tests__/launch.test.ts::test_attempt_validation -x` | ❌ Wave 0 |
| RUN-05 | Run-ender applies mode-specific death penalties | unit | `npm test -- src/game/systems/run-ender.test.ts::test_mode_aware_death -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/game/systems/vault-manager.test.ts src/game/systems/seed-rotation.test.ts -x` (fast unit tests)
- **Per wave merge:** `npm test -- src/game/systems/ src/app/api/run-mode/ src/app/api/leaderboard/ -x` (phase-specific tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/game/systems/vault-manager.test.ts` — covers extraction-to-vault, overflow, discard/sell (STASH-01, STASH-02)
- [ ] `src/game/systems/seed-rotation.test.ts` — covers daily/weekly seed generation, rotation persistence (RUN-02, RUN-03)
- [ ] `src/app/api/run-mode/__tests__/launch.test.ts` — covers mode selection, attempt validation, seed retrieval (RUN-01, RUN-02, RUN-03, RUN-04)
- [ ] `src/app/api/leaderboard/__tests__/submit.test.ts` — covers score calculation, server validation, leaderboard write
- [ ] `src/game/systems/run-ender.test.ts` — extend existing tests with mode-aware death cases (RUN-05)

Existing test infrastructure (`vitest.config.ts`, `package.json` scripts, mocking patterns in `economy/__tests__/`) covers all phase requirements. No framework installation needed.

## Sources

### Primary (HIGH confidence)
- `src/game/systems/profile-persistence.ts` — Existing PlayerProfile schema and JSON persistence pattern
- `src/game/systems/run-inventory.ts` — RunInventoryItem schema, 5-slot inventory, transferToStash() pattern
- `src/game/systems/run-ender.ts` — Extraction and death flow, RUN_ENDED event, pity calculation
- `src/game/systems/shop-rotation.ts` — Mulberry32 seeded PRNG implementation
- `src/game/engine-factory.ts` — EngineInitConfig pattern, seed handling, rot-js RNG usage
- `src/game/systems/weekly-reset.ts` — Weekly reset pattern, idempotency check, profile update
- `src/game/entities/templates/economy.json` — Economy configuration pattern
- `src/app/api/economy/compile/route.ts` — API endpoint pattern, Zod validation, profile read/write
- `.planning/phases/14-stash-vault-run-modes/14-CONTEXT.md` — User decisions (D-01 through D-22)
- `.planning/REQUIREMENTS.md` — Phase requirements STASH-01 through STASH-04, RUN-01 through RUN-07
- `package.json` — Installed versions: Zod 4.3.6, rot-js 2.2.1, Next.js 16.1.6, Vitest 4.1.0

### Secondary (MEDIUM confidence)
- rot-js GitHub repository (ondras/rot.js) — Version 0.5.0 (2014), feature-complete, BSD-3-Clause license; RNG seeding via `RNG.setSeed()` and `RNG.getUniform()` confirmed from codebase usage

### Tertiary (LOW confidence)
- None — all research findings are HIGH or MEDIUM confidence based on existing codebase and official project decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already installed and used extensively in codebase
- Architecture: HIGH - Patterns proven in Phase 13 (profile persistence), Phase 12 (run-ender), Phase 10 (run inventory)
- Pitfalls: HIGH - Based on direct analysis of existing code patterns and potential integration failure modes
- Seeded generation: HIGH - Mulberry32 already implemented, rot-js RNG usage well-established
- Leaderboard/scoring: MEDIUM - New domain for project, but straightforward JSON file pattern; scoring formula weights are Claude's discretion

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — stable dependencies, core patterns unlikely to change)
