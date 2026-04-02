# Phase 13: Currency, Economy & Blueprint System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 13-currency-economy-blueprint-system
**Areas discussed:** Currency Drop Model, Blueprint Lifecycle, Weekly Reset Severity, Economy Pacing, Server Validation Depth, Player Profile Persistence, Software Shop Design, Legacy Code Visual Identity

---

## Currency Drop Model

### How should Blueprints and Flux appear when enemies die?

| Option | Description | Selected |
|--------|-------------|----------|
| Physical pickup entities | Dropped as glowing entities on the ground. Player walks over to collect. Consistent with existing item-pickup system. | ✓ |
| Auto-collect on kill | Automatically added to run inventory when enemy dies. No floor entities. | |
| Hybrid | Scrap auto-collects, Blueprints/Flux drop as physical entities. | |

**User's choice:** Physical pickup entities
**Notes:** Consistent with existing patterns.

### Where does collected currency go during a run?

| Option | Description | Selected |
|--------|-------------|----------|
| Wallet is separate | WalletComponent tracks currencies as numeric counters, no inventory slots consumed. | |
| Currency uses inventory slots | Currencies occupy run inventory slots, competing with Software. | ✓ |

**User's choice:** Currency uses inventory slots with uncapped stack sizes.
**Notes:** User rejected the separate wallet option. All currencies + Scrap occupy an inventory slot. Stack size for currency is uncapped.

### Should extraction multipliers apply?

| Option | Description | Selected |
|--------|-------------|----------|
| Depth-based multiplier | Extraction multiplier scales with floor depth. | |
| Flat — keep what you picked up | No multiplier. Loot tables already handle risk/reward. | ✓ |

**User's choice:** Flat — no multipliers.

### Blueprint identification on drop?

| Option | Description | Selected |
|--------|-------------|----------|
| Identified on drop | See exactly what the Blueprint unlocks before picking it up. | ✓ |
| Mystery until pickup | Generic "Locked File" entity, reveals on collection. | |
| Mystery until compilation | Reveals what it unlocks only when Flux is spent to compile. | |

**User's choice:** Identified on drop.

### Tier 1 Blueprint drops?

| Option | Description | Selected |
|--------|-------------|----------|
| Tier 1 = Scrap only | Tier 1 exclusively drops Scrap. | |
| Tier 1 has tiny Blueprint chance | ~2% probability Blueprint drop from Tier 1. | ✓ |

**User's choice:** Tiny Blueprint chance from Tier 1.

### Pickup feedback?

| Option | Description | Selected |
|--------|-------------|----------|
| Stack increment + message log | Simple message log entry. Minimal, consistent. | ✓ |
| Stack increment + visual flair by rarity | Differentiated feedback by currency type. | |
| You decide | Claude's discretion. | |

**User's choice:** Stack increment + message log.

### Flux source?

| Option | Description | Selected |
|--------|-------------|----------|
| Drops as pickup entity | Flux drops from enemies. | |
| Extraction reward only | Flux awarded on successful extraction. | |
| Both sources | Small drops from enemies AND bonus on extraction. | ✓ |

**User's choice:** Both sources.

---

## Blueprint Lifecycle

### Where can compilation happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Between-run only | Compilation only at Neural Deck. Locked Files are dead weight during runs. | ✓ |
| Mid-run at Stability Anchors | Anchors double as compilation stations. | |
| Anytime during run | Compile as a turn action. | |

**User's choice:** Between-run only.

### Blueprint Library model?

| Option | Description | Selected |
|--------|-------------|----------|
| One compile = one copy | Each Locked File compiles into one entry. | |
| Compile unlocks permanently (for the week) | Compiling unlocks for all Shells until weekly reset. | ✓ |
| Compile once, install/uninstall freely | One active copy, flexible placement. | |

**User's choice:** Compile unlocks permanently for the week.

### Duplicate Locked File handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Still valuable — converts to Flux | Duplicate auto-converts to Flux bonus. | ✓ |
| Worthless duplicate | Flagged as "already compiled" at Neural Deck. | |
| Can't pick up duplicates | Grayed out / unpickable. | |

**User's choice:** Converts to Flux.

### Augment Blueprint lifecycle?

| Option | Description | Selected |
|--------|-------------|----------|
| Identical lifecycle | Same path as Firmware: Locked File → compile → install. | ✓ |
| Augments skip compilation | Augments usable immediately on extraction. | |

**User's choice:** Identical lifecycle.

### Phase 13 compilation interface?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal CLI-style screen | Simple React screen for compilation. | |
| API + test harness only | No player-facing UI. Server-side compile action tested programmatically. | ✓ |
| Extend post-run results screen | Add compile section to RunResultsScreen. | |

**User's choice:** API + test harness only.

### Blueprint library storage?

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side player profile | Stored server-side, associated with player session. | ✓ |
| ECS component on persistent player entity | BlueprintLibraryComponent on player entity. | |

**User's choice:** Server-side player profile.

### Installation cost?

| Option | Description | Selected |
|--------|-------------|----------|
| Free installation | Compilation is the only gate. | |
| Installation costs Scrap | Two-gate: Flux to compile, Scrap to install. | ✓ |
| Installation costs a turn | Free but takes a hub action slot. | |

**User's choice:** Installation costs Scrap.

### Uninstall behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Uninstall returns to library | Put back in library, reinstall on different Shell (paying Scrap again). | ✓ |
| Uninstall destroys the item | Removing destroys it permanently. | |
| No uninstall — overwrite only | Can only install over existing. | |

**User's choice:** Uninstall returns to library.

---

## Weekly Reset Severity

### Legacy Code severity?

| Option | Description | Selected |
|--------|-------------|----------|
| Doubled Heat = strong pressure to re-farm | 2x Heat cost, painful but usable. Safety net. | ✓ |
| Doubled Heat + reduced effect | 2x Heat AND 50% effectiveness. Nearly useless. | |
| Doubled Heat only, no effect reduction | 2x Heat, full power. Rewards Heat management. | |

**User's choice:** Doubled Heat = strong pressure to re-farm.

### Augment reset?

| Option | Description | Selected |
|--------|-------------|----------|
| Both Firmware and Augments become Legacy | All installed equipment degrades. | ✓ |
| Firmware only — Augments survive intact | Augments are stable foundation. | |
| Augments are wiped entirely | Deleted from Shell on reset. | |

**User's choice:** Both become Legacy.

### Augment Legacy penalty?

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced trigger chance | 50% trigger rate. Unreliable. | |
| Halved payload magnitude | Always trigger at 50% effect. Reliable but weaker. | ✓ |
| Doubled trigger cooldown | Trigger once every 2 eligible events. | |

**User's choice:** Halved payload magnitude.

### Winner's Item mechanism?

| Option | Description | Selected |
|--------|-------------|----------|
| Top Weekly run's best drop | Tied to player performance. | |
| Curated rotation | Pre-defined list rotating weekly. Predictable. | ✓ |
| Stub it for Phase 13 | Schema only, logic deferred. | |

**User's choice:** Curated rotation.

### Weekly reset trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side cron on real Mondays | Real calendar-based reset. | |
| Manual trigger via API | Admin-only API endpoint. | ✓ |
| Configurable interval | Timer from first login. | |

**User's choice:** Manual API trigger + admin-only tool, not available to players.

### Currency persistence through reset?

| Option | Description | Selected |
|--------|-------------|----------|
| Scrap and Flux persist through reset | With configurable, expandable cap. | ✓ |
| Flux resets, Scrap persists | Flux wiped weekly. | |
| Both currencies reset | Full economic reset. | |

**User's choice:** Both persist with expandable configurable cap. Cap expansion mechanism deferred.

### Over-cap behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Can't pick up — entity stays on ground | Pickup blocked at cap. | |
| Pick up but excess is lost | Clamped to cap, overflow discarded. | |
| Uncapped during runs, capped on extraction | No cap in-run, applied on extraction. | ✓ |

**User's choice:** Uncapped during runs, capped on extraction.

---

## Economy Pacing

### Compilation tempo?

| Option | Description | Selected |
|--------|-------------|----------|
| 1-2 runs (generous) | Fast feedback loop. Compile almost every session. | ✓ |
| 3-5 runs (moderate) | Few good extractions per compilation. | |
| 5-10 runs (grindy) | Significant investment per compilation. | |

**User's choice:** 1-2 runs (generous).

### Scrap sinks?

| Option | Description | Selected |
|--------|-------------|----------|
| Two sinks are enough | Anchor descend + installation. | |
| Add repair/re-init sink | Shell repair between runs. | |
| Add Software purchasing stub | Scrap-based Software shop (SOFT-07). | ✓ |

**User's choice:** Add Software purchasing stub.

### Death pity scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Scrap only (per ECON-04) | 25% Scrap, all else lost. | ✓ |
| 25% Scrap + 10% Flux | Small Flux pity. | |
| You decide | Claude's discretion. | |

**User's choice:** Scrap only.

### Economy config location?

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized economy.json | Single file for all economy parameters. | ✓ |
| Distributed across existing configs | Co-located with entity templates. | |

**User's choice:** Centralized economy.json.

### Flux sink?

| Option | Description | Selected |
|--------|-------------|----------|
| Cap is sufficient | Configurable cap prevents hoarding. | |
| Flux also used for Shell upgrades (SHELL-05) | Stats + Port expansion cost Flux. Reset weekly. | ✓ |
| Flux sink deferred | Cap only, sinks added later. | |

**User's choice:** Flux used for Shell upgrades. Both stats and Port slots upgradeable. Shell upgrades also reset weekly on Format C:.

---

## Server Validation Depth

### Validation model?

| Option | Description | Selected |
|--------|-------------|----------|
| Every transaction through action pipeline | All mutations via ActionIntent. | |
| Separate economy API endpoints | Dedicated REST endpoints. | |
| Hybrid | In-run via pipeline, between-run via API. | ✓ |

**User's choice:** Hybrid — in-run through action pipeline, between-run through dedicated API.

### Admin tooling scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset + economy inspection | Read + write access. | |
| Reset + grant only | Limited write access. | |
| Full admin CRUD | Complete control surface. | ✓ |

**User's choice:** Full admin CRUD.

---

## Player Profile Persistence

### Persistence backend?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON file per player session | Simple, no database dependency. | ✓ |
| SQLite database | Embedded database. | |
| In-memory with JSON snapshot | Fast but risk of data loss. | |

**User's choice:** JSON file per player session.

### File location?

| Option | Description | Selected |
|--------|-------------|----------|
| Project data directory | `data/profiles/` in project root (gitignored). | ✓ |
| OS temp/app data directory | OS-specific application data path. | |
| You decide | Claude's discretion. | |

**User's choice:** Project data directory.

---

## Software Shop Design

### Stock model?

| Option | Description | Selected |
|--------|-------------|----------|
| Rotating stock per week | Fixed selection tied to weekly seed. | ✓ |
| Random per session | Random selection per visit. | |
| Fixed catalog, always available | All types always purchasable. | |

**User's choice:** Rotating stock per week.

### Shop rarity ceiling?

| Option | Description | Selected |
|--------|-------------|----------|
| Up to v2.x (rare) in shop | Legendary v3.x only from drops. | ✓ |
| All rarities available | v3.x at very high cost. | |
| v0.x and v1.x only | Shop for basics only. | |

**User's choice:** Up to v2.x in shop.

---

## Legacy Code Visual Identity

### Visual treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| "Deprecated" tag + desaturated icon | `legacy: true` flag, "LEGACY"/"DEPRECATED" tag, grayed tint. | ✓ |
| Version number mismatch indicator | Show compile week vs current week in amber. | |
| Data flag only, visual deferred | Mechanics only in Phase 13. | |

**User's choice:** "Deprecated" tag + desaturated icon.

### HUD visibility?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible in HUD during runs | Firmware hotkey bar shows Legacy treatment. Doubled Heat cost visible. | ✓ |
| Between-run only | Legacy tag only in Hub/inventory screens. | |
| You decide | Claude's discretion. | |

**User's choice:** Visible in HUD during runs.

---

## Claude's Discretion

- Exact Zod schema shapes for all new components and data structures
- Currency drop amounts per enemy tier
- Flux compilation cost formula per Blueprint rarity
- Scrap installation cost scaling
- Default currency cap values
- Software shop stock size and rotation algorithm
- Shell upgrade cost formulas and max upgrade levels
- Admin API authentication mechanism
- Duplicate Blueprint → Flux conversion amount
- Extraction Flux bonus calculation
- Run inventory migration details
- Player profile file locking strategy

## Deferred Ideas

- Currency cap expansion mechanism — deferred to later phase
- Automatic weekly reset scheduling — Phase 13 builds logic, scheduling deferred
- Player-facing compilation and shop UI — deferred to Phase 15
- Version Patch effectiveness reduction (BP-06) — dropped from scope
