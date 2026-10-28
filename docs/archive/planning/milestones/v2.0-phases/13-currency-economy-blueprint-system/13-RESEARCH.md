# Phase 13: Currency, Economy & Blueprint System - Research

**Researched:** 2026-04-02
**Domain:** Game economy systems, multi-tier currency, blueprint progression, weekly reset mechanics
**Confidence:** MEDIUM

## Summary

Phase 13 implements a three-tier currency system (Scrap, Neural Blueprints, Flux) with Blueprint discovery-compilation-installation lifecycle, weekly reset with Legacy Code degradation, and server-validated economy. The phase migrates from component-based currency (ScrapComponent) to inventory-based currency storage, adds Blueprint library persistence via JSON files, and creates admin tooling for economy management.

**Key architectural shift:** Currency becomes inventory items instead of components, creating inventory pressure (5 shared slots for Software AND currency). This design pattern is unusual but creates interesting gameplay tension per the design decisions.

**Primary recommendation:** Follow the existing ECS component + Zod pattern for all new state (WalletComponent for persistent balances, BlueprintLibrary for unlocked blueprints). Use Node.js fs.promises for file I/O with proper error handling. Implement currency operations through the action pipeline, between-run operations via REST API endpoints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Currency Drop Model:**
- D-01: All currencies drop as physical pickup entities (walk over to collect)
- D-02: All currencies occupy run inventory slots (5-slot shared with Software), uncapped stack sizes
- D-03: Replace ScrapComponent with inventory-based Scrap, migrate Anchor interaction
- D-04: No extraction multipliers — depth-based loot tables handle risk/reward
- D-05: Blueprints drop as identified Locked Files (label shows exact Firmware/Augment before pickup)
- D-06: Flux drops from Tier 2/3 enemies AND bonus awarded on extraction
- D-07: Tier 1 enemies have ~2% Blueprint chance (Tier 2/3 are primary sources)
- D-08: Currency pickup feedback is stack increment + message log only

**Blueprint Lifecycle:**
- D-09: Compilation happens between-run only (Locked Files are dead weight during runs)
- D-10: Compiling unlocks Blueprint permanently for the week (unlimited copies)
- D-11: Duplicate Locked Files auto-convert to Flux bonus
- D-12: Augments follow identical lifecycle to Firmware (unified system)
- D-13: No player-facing compilation UI in Phase 13 (API + test harness only, UI in Phase 15)
- D-14: Blueprint library stored server-side in player profile JSON
- D-15: Two-gate installation — Flux to compile, Scrap to install on Shell
- D-16: Uninstall returns to library (can reinstall on different Shell for Scrap)

**Weekly Reset (Format C:):**
- D-17: Installed Firmware becomes Legacy Code with doubled Heat cost
- D-18: Installed Augments become Legacy with halved payload magnitude
- D-19: Shell upgrades reset to base model weekly
- D-20: Currency persists with configurable caps (expansion mechanism deferred)
- D-21: No cap during runs, cap applied on extraction
- D-22: Winner's Item uses curated rotation (pre-defined list, not player performance)
- D-23: Weekly reset via admin-only API endpoint (manual, not scheduled)

**Economy Pacing:**
- D-24: Generous tempo — 1-2 extractions from floors 5-10 compile one Blueprint
- D-25: Scrap sinks: Anchor descend, Blueprint installation, Software purchasing
- D-26: Flux sinks: Blueprint compilation, Shell upgrades (both reset weekly)
- D-27: Death pity is Scrap only (25%), Blueprints and Flux lost
- D-28: All economy values in centralized economy.json config

**Software Shop:**
- D-29: Rotating stock per week tied to weekly seed
- D-30: Shop sells up to v2.x Software (Legendary v3.x only from drops)
- D-31: Shop is API-only in Phase 13 (UI in Phase 15)

**Server Validation & Admin:**
- D-32: Hybrid validation — in-run via action pipeline, between-run via REST API
- D-33: Full admin CRUD — reset, inspect, grant/revoke, force-compile, modify caps

**Player Profile Persistence:**
- D-34: JSON file per session in data/profiles/{sessionId}.json (gitignored)

**Legacy Visual Identity:**
- D-35: Legacy items get legacy flag + "DEPRECATED" tag with desaturated icon
- D-36: Legacy status visible in HUD during runs

### Claude's Discretion
- Exact Zod schema shapes for WalletComponent, BlueprintLibrary, PlayerProfile, ShopState
- Currency drop amounts per enemy tier (within economy.json)
- Flux compilation cost formula per Blueprint rarity
- Scrap installation cost scaling
- Default currency cap values
- Software shop stock size and rotation algorithm
- Shell upgrade cost formulas and max upgrade levels
- Admin API authentication/authorization mechanism
- Duplicate Blueprint → Flux conversion amount
- Extraction Flux bonus calculation
- Run inventory migration details
- Player profile read/write patterns and file locking strategy

### Deferred Ideas (OUT OF SCOPE)
- Currency cap expansion mechanism
- Automatic weekly reset scheduling (cron/calendar-based)
- Player-facing compilation and shop UI (deferred to Phase 15)
- Version Patch effectiveness reduction (BP-06 dropped)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ECON-01 | Raw Scrap: common currency from all enemies, used for repairs/purchases | Inventory-based stacking pattern, entity template for drops |
| ECON-02 | Neural Blueprints: rare drops from Tier 2/3 unlocking Firmware/Augments | Locked File entity pattern with identified labels |
| ECON-03 | Flux: premium currency from deep runs/extraction for upgrades/compilation | Dual-source faucet (enemy drops + extraction bonus) |
| ECON-04 | Death pity: 25% Scrap payout, all other currency lost | Pipeline death handler extension |
| ECON-05 | Server-validated transactions through action pipeline | Existing pipeline pattern + new REST endpoints |
| ECON-06 | Faucet/sink balance to prevent inflation | economy.json configuration with all values |
| BP-01 | Blueprints found as "Locked File" drops | Entity template + Item component pattern |
| BP-02 | Flux compilation at Neural Deck adds to library | REST API compile endpoint + PlayerProfile storage |
| BP-03 | Install from library onto Shell | REST API install endpoint + Scrap deduction |
| BP-04 | Weekly reset deletes uninstalled Blueprints | Admin API reset endpoint + library clearing |
| BP-05 | Installed Firmware survives as Legacy Code with doubled Heat | AbilityDef.isLegacy flag + Heat cost doubling |
| BP-06 | Weekly Version Patch reduces Legacy effectiveness | DROPPED FROM SCOPE per Context |
| BP-07 | Winner's Item special Blueprint each Monday | Curated rotation list in economy.json |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Schema validation and typing | Already project dependency, type-safe validation for all economy state, API payloads, and JSON persistence |
| Next.js API Routes | 16.1.6 | REST endpoints for between-run operations | Already project framework, serverless functions for compile/install/purchase/admin |
| Node.js fs.promises | Built-in | JSON file persistence | No external dependency, async file I/O for profile storage, Node 18+ has stable promises API |
| json-diff-ts | 4.10.0 | State delta calculation | Already project dependency, existing pipeline pattern for state changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.11 | Client state management | Already in project for gameStore, extend for economy UI state (wallet display, shop state) |
| Vitest | 4.1.0 | Testing framework | Already in project, write tests for economy math, Blueprint compilation, weekly reset logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON files | SQLite/PostgreSQL | JSON simpler for MVP, inspectable, no DB setup. Database would enable complex queries, atomic transactions, but adds deployment complexity |
| fs.promises | ORM (Prisma, Drizzle) | Direct fs calls simpler for single-file operations. ORM would help if schema evolves or we need migrations |
| Manual Zod schemas | TypeScript type guards | Zod provides runtime validation + type inference in one. Type guards would be more verbose and error-prone |

**Installation:**
```bash
# No new packages needed — all dependencies already in package.json
# Verify versions:
npm list zod next vitest zustand
```

**Version verification:** All core dependencies verified from existing package.json (read 2026-04-02). These are current stable versions as of April 2026.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shared/
│   ├── components/
│   │   ├── wallet.ts              # WalletComponent (persistent balance state)
│   │   ├── blueprint-library.ts    # BlueprintLibrary (compiled blueprints)
│   │   ├── player-profile.ts       # PlayerProfile (aggregates wallet, library, upgrades)
│   │   └── shop-state.ts           # ShopState (weekly rotation stock)
│   ├── types.ts                    # Add economy action schemas
│   └── pipeline.ts                 # Extend for currency pickup, pity payout
├── game/
│   ├── entities/templates/
│   │   ├── blueprint-locked.json   # Locked File entity template
│   │   ├── flux.json               # Flux currency entity
│   │   └── economy.json            # Centralized economy config
│   ├── systems/
│   │   ├── currency-pickup.ts      # Extends item-pickup for stacking
│   │   └── shop-rotation.ts        # Weekly shop stock generation
├── app/api/
│   ├── economy/
│   │   ├── compile/route.ts        # Blueprint compilation endpoint
│   │   ├── install/route.ts        # Blueprint installation endpoint
│   │   ├── purchase/route.ts       # Software shop purchase endpoint
│   │   └── upgrade/route.ts        # Shell upgrade endpoint
│   └── admin/
│       ├── reset/route.ts          # Weekly reset trigger
│       ├── grant/route.ts          # Grant currency/blueprints
│       └── inspect/route.ts        # Inspect player state
data/
├── profiles/                       # Gitignored player profile JSON
│   └── {sessionId}.json
```

### Pattern 1: Component-Based Persistent State
**What:** ECS components with Zod schemas for all persistent economy state
**When to use:** Any state that survives between runs (wallet balances, Blueprint library, Shell upgrades)
**Example:**
```typescript
// src/shared/components/wallet.ts
import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const Wallet = defineComponent('wallet', z.object({
  scrap: z.number().int().min(0).default(0),
  flux: z.number().int().min(0).default(0),
  scrapCap: z.number().int().positive().default(10000),
  fluxCap: z.number().int().positive().default(1000),
}));

export type WalletData = z.infer<typeof Wallet.schema>;
```

### Pattern 2: Inventory-Based Currency with Uncapped Stacks
**What:** Currency exists as entities in run inventory with special stacking rules
**When to use:** During active runs for Scrap, Blueprints, Flux pickup
**Example:**
```typescript
// Extend RunInventoryItem to handle currency stacking
export interface CurrencyStackItem {
  type: 'scrap' | 'blueprint' | 'flux';
  amount: number; // Uncapped — can be any positive integer
  blueprintId?: string; // For Blueprint stacks, which specific blueprint
}

// Currency pickup adds to existing stack OR creates new stack if slot available
function handleCurrencyPickup(sessionId: string, currencyType: string, amount: number): boolean {
  const inventory = runInventoryRegistry.getOrCreate(sessionId);
  
  // Find existing currency stack of this type
  const existingStack = inventory.currency.find(c => c.type === currencyType);
  if (existingStack) {
    existingStack.amount += amount; // Uncapped addition
    return true;
  }
  
  // No existing stack — need a new slot
  if (inventory.currency.length + inventory.software.length >= inventory.maxSlots) {
    return false; // Inventory full
  }
  
  inventory.currency.push({ type: currencyType, amount });
  return true;
}
```

### Pattern 3: File-Based Profile Persistence
**What:** JSON files for player profile with atomic read/write
**When to use:** Between-run state persistence (wallet, library, upgrades)
**Example:**
```typescript
// src/game/systems/profile-persistence.ts
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

const ProfileSchema = z.object({
  sessionId: z.string(),
  wallet: z.object({
    scrap: z.number().int().min(0),
    flux: z.number().int().min(0),
  }),
  blueprintLibrary: z.array(z.object({
    blueprintId: z.string(),
    type: z.enum(['firmware', 'augment']),
    compiledAt: z.number(), // Timestamp
  })),
  shellUpgrades: z.object({
    speed: z.number().int().min(0).default(0),
    armor: z.number().int().min(0).default(0),
    additionalPorts: z.number().int().min(0).default(0),
  }),
  weekSeed: z.number(), // Which week this profile is valid for
});

export type PlayerProfile = z.infer<typeof ProfileSchema>;

const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');

export async function loadProfile(sessionId: string): Promise<PlayerProfile | null> {
  const filePath = path.join(PROFILES_DIR, `${sessionId}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return ProfileSchema.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // Profile doesn't exist
    }
    throw error; // Validation or other errors
  }
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
  const filePath = path.join(PROFILES_DIR, `${profile.sessionId}.json`);
  
  // Atomic write: write to temp file, then rename
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(profile, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}
```

### Pattern 4: Centralized Economy Configuration
**What:** Single JSON file with all economy tuning values
**When to use:** All numeric values for drops, costs, caps, rates
**Example:**
```typescript
// src/game/entities/templates/economy.json
{
  "version": "1.0.0",
  "currencyDrops": {
    "scrap": {
      "tier1": { "min": 5, "max": 15, "chance": 1.0 },
      "tier2": { "min": 20, "max": 40, "chance": 1.0 },
      "tier3": { "min": 50, "max": 100, "chance": 1.0 }
    },
    "blueprint": {
      "tier1": { "chance": 0.02 },
      "tier2": { "chance": 0.15 },
      "tier3": { "chance": 0.30 }
    },
    "flux": {
      "tier2": { "min": 1, "max": 3, "chance": 0.40 },
      "tier3": { "min": 3, "max": 8, "chance": 0.60 },
      "extractionBonus": { "baseAmount": 10, "perFloorMultiplier": 2 }
    }
  },
  "costs": {
    "compilation": {
      "common": 50,
      "uncommon": 100,
      "rare": 200,
      "legendary": 500
    },
    "installation": {
      "firmware": 25,
      "augment": 15
    },
    "shellUpgrade": {
      "speed": { "baseCost": 30, "perLevelMultiplier": 1.5 },
      "armor": { "baseCost": 40, "perLevelMultiplier": 1.5 },
      "additionalPort": { "baseCost": 100, "perPortMultiplier": 2.0 }
    }
  },
  "caps": {
    "scrap": 10000,
    "flux": 1000
  },
  "pity": {
    "deathScrapPercent": 0.25
  },
  "shop": {
    "stockSize": 6,
    "maxRarity": "rare"
  },
  "conversion": {
    "duplicateBlueprintToFlux": 20
  },
  "winnersItems": [
    "PHASED_OVERDRIVE",
    "NEURAL_RECURSION",
    "STATIC_COLLAPSE",
    "VOID_ECHO"
  ]
}
```

### Pattern 5: REST API for Between-Run Operations
**What:** Next.js API routes with Zod validation for economy mutations
**When to use:** Operations that happen at the Neural Deck (compile, install, purchase, upgrade)
**Example:**
```typescript
// src/app/api/economy/compile/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadProfile, saveProfile } from '@game/systems/profile-persistence';
import economyConfig from '@game/entities/templates/economy.json';

const CompileRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = CompileRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request', details: result.error }, { status: 400 });
    }

    const { sessionId, blueprintId, rarity } = result.data;
    const profile = await loadProfile(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if already compiled
    const alreadyCompiled = profile.blueprintLibrary.some(bp => bp.blueprintId === blueprintId);
    if (alreadyCompiled) {
      return NextResponse.json({ error: 'Blueprint already compiled' }, { status: 400 });
    }

    // Check Flux cost
    const cost = economyConfig.costs.compilation[rarity];
    if (profile.wallet.flux < cost) {
      return NextResponse.json({ error: 'Insufficient Flux', required: cost, current: profile.wallet.flux }, { status: 400 });
    }

    // Deduct Flux and add to library
    profile.wallet.flux -= cost;
    profile.blueprintLibrary.push({
      blueprintId,
      type: 'firmware', // TODO: derive from blueprintId
      compiledAt: Date.now(),
    });

    await saveProfile(profile);
    return NextResponse.json({ success: true, remainingFlux: profile.wallet.flux });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Pattern 6: Pipeline Extension for Currency Operations
**What:** Add new action types to existing pipeline for in-run currency operations
**When to use:** Currency pickup, Scrap spending at Anchor, extraction cap enforcement
**Example:**
```typescript
// Extend src/shared/pipeline.ts processAction
case 'PICKUP_CURRENCY': {
  if (!sessionId) {
    eventBus.emit('MESSAGE_EMITTED', { text: 'Session required for currency pickup.', type: 'error' });
    return;
  }
  
  const currencyEntity = world.getComponent(action.entityId, Item);
  const currencyType = action.currencyType; // 'scrap' | 'blueprint' | 'flux'
  const amount = action.amount;
  
  const success = runInventoryRegistry.addCurrency(sessionId, currencyType, amount);
  if (success) {
    eventBus.emit('CURRENCY_PICKED_UP', { currencyType, amount });
    eventBus.emit('MESSAGE_EMITTED', { text: `+${amount} ${currencyType}`, type: 'info' });
    
    // Remove entity from world
    const pos = world.getComponent(action.entityId, Position);
    if (pos) grid.removeItem(action.entityId, pos.x, pos.y);
    world.destroyEntity(action.entityId);
  } else {
    eventBus.emit('MESSAGE_EMITTED', { text: 'Inventory full', type: 'error' });
  }
  break;
}
```

### Anti-Patterns to Avoid

- **Anti-pattern: Currency as mutable global state** — Don't store wallet balances in Zustand store. Wallets must be server-authoritative. Use components/profile files.
- **Anti-pattern: Synchronous file I/O** — Don't use fs.readFileSync/writeFileSync in API routes. Always use fs.promises for async operations.
- **Anti-pattern: Direct component mutation in API routes** — API routes don't have direct ECS access. They read/write profile JSON, which gets loaded into components at run start.
- **Anti-pattern: Client-side currency math** — All currency operations must be validated server-side. Client can display optimistic updates but server is source of truth.
- **Anti-pattern: Hard-coded economy values** — All drop rates, costs, caps must be in economy.json. No magic numbers scattered across code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File locking for concurrent profile writes | Custom mutex/semaphore system | Atomic write pattern (write to .tmp, rename) + single-threaded Node.js | Node.js is single-threaded, fs.rename is atomic on POSIX. Custom locks add complexity without benefit for single-player game |
| Currency cap enforcement | Complex validation logic everywhere | Centralized validation function called at extraction event | Caps only apply on extraction (D-21), single enforcement point prevents bugs |
| Blueprint duplicate detection | Manual array iteration in multiple places | Set-based lookup using blueprintId as key | O(1) lookup vs O(n) search, prevent accidental duplicate compiles |
| Weekly seed generation | Custom PRNG for weekly rotation | Use Date-based seed (e.g., ISO week number of year) | Date.now() provides repeatable seed per week, no custom PRNG needed |
| Admin authentication | Custom JWT/session system | Next.js middleware with simple token check | Simple bearer token sufficient for admin-only endpoints, full auth system overkill |

**Key insight:** This is a single-player game with server authority only for anti-cheat. Complex distributed systems patterns (distributed locks, event sourcing, CQRS) are unnecessary. Simple file I/O + atomic writes + validation functions are sufficient.

## Common Pitfalls

### Pitfall 1: Inventory Slot Accounting Mismatch
**What goes wrong:** Currency items occupy inventory slots, but if you track currency.length + software.length separately, you can overflow the 5-slot limit.
**Why it happens:** Two different arrays (currency[], software[]) both competing for the same maxSlots value.
**How to avoid:** Maintain a single "occupied slots" counter that sums both arrays, or merge into a single discriminated union array.
**Warning signs:** Tests pass individually but fail when currency + software mix. Player can't pick up items despite "empty slots" shown in UI.

### Pitfall 2: Extraction Cap Enforcement Timing
**What goes wrong:** If you enforce caps during the run, players lose currency unexpectedly. If you don't enforce at extraction, they hoard infinitely.
**Why it happens:** D-21 specifies "no cap during runs, capped on extraction" but this requires careful event ordering.
**How to avoid:** Enforce caps only in the EXTRACTION_TRIGGERED handler, after transferring inventory but before saving to profile.
**Warning signs:** Players complain about "lost currency" or economy inflation despite caps being set.

### Pitfall 3: Legacy Code Mutation During Weekly Reset
**What goes wrong:** If you mutate the AbilityDef component directly during weekly reset, you affect ALL instances of that ability (including ones in other players' inventories).
**Why it happens:** Components are data on entities. Entities can be templates or runtime instances. Mutating the template mutates all instances.
**How to avoid:** Legacy status is per-player, not per-blueprint. Store Legacy status in the PlayerProfile's installed items list, not in the AbilityDef component.
**Warning signs:** One player's reset affects another player's abilities. Blueprint costs wrong after reset.

### Pitfall 4: ScrapComponent Migration Incomplete
**What goes wrong:** You remove ScrapComponent but forget to update all systems that read it (Anchor interaction, death pity, UI displays).
**Why it happens:** Scrap is used in multiple systems. Grep finds code references but not runtime dependencies.
**How to avoid:** Write a failing integration test first: "Anchor descend with inventory Scrap". Then migrate all code paths until test passes.
**Warning signs:** Game crashes when interacting with Anchor. Death pity gives 0 Scrap. UI shows undefined Scrap value.

### Pitfall 5: Duplicate Blueprint → Flux Conversion Race Condition
**What goes wrong:** Player picks up duplicate Blueprint, conversion to Flux triggers, but Flux entity spawns where Blueprint was. Player walks over it, triggering pickup, but inventory slot is still occupied by the "converting" Blueprint item.
**Why it happens:** Async entity creation/destruction during pickup processing.
**How to avoid:** Handle duplicate conversion synchronously in the pickup handler — destroy Blueprint entity, increment Flux stack in inventory, no intermediate state.
**Warning signs:** Player reports "picked up Blueprint but got nothing" or "Flux appeared on ground after pickup".

### Pitfall 6: Weekly Reset Doesn't Check weekSeed Before Reset
**What goes wrong:** Admin triggers reset multiple times in same week, wiping player progress each time.
**Why it happens:** No idempotency check in reset endpoint.
**How to avoid:** Store current weekSeed in global config. Reset endpoint checks if profile.weekSeed === currentWeekSeed; if yes, skip reset for that player.
**Warning signs:** Players lose Blueprints mid-week. Support tickets about "disappeared items".

## Code Examples

Verified patterns from existing source code:

### Existing Component Definition Pattern
```typescript
// From src/shared/components/scrap.ts
import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const Scrap = defineComponent('scrap', z.object({
  amount: z.number().int().min(0).default(0),
}));

export type ScrapData = z.infer<typeof Scrap.schema>;
```

### Existing Action Pipeline Extension Pattern
```typescript
// From src/shared/pipeline.ts (ANCHOR_DESCEND action)
case 'ANCHOR_DESCEND': {
  const scrap = world.getComponent(entityId, Scrap);
  if (!scrap || scrap.amount < action.cost) {
    eventBus.emit('MESSAGE_EMITTED', {
      text: `INSUFFICIENT_SCRAP: ${action.cost} REQUIRED`,
      type: 'error'
    });
    return;
  }
  scrap.amount -= action.cost;
  // ... stability refill logic
  break;
}
```

### Existing Item Pickup Pattern
```typescript
// From src/game/systems/item-pickup.ts
function onEntityMoved(payload: T['ENTITY_MOVED']) {
  const { entityId, toX, toY } = payload;
  const actor = world.getComponent(entityId, Actor);
  if (!actor || !actor.isPlayer) return;
  
  const itemsAtPos = grid.getItemsAt(toX, toY);
  if (itemsAtPos.size === 0) return;
  
  const items = Array.from(itemsAtPos);
  for (const itemId of items) {
    if (!world.hasComponent(itemId, Item)) continue;
    
    // Handle Scrap currency (currently component-based, to be migrated)
    const itemScrap = world.getComponent(itemId, Scrap);
    if (itemScrap) {
      const playerScrap = world.getComponent(entityId, Scrap);
      if (playerScrap) {
        playerScrap.amount += itemScrap.amount;
      }
    }
    
    eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
    grid.removeItem(itemId, toX, toY);
    world.destroyEntity(itemId);
  }
}
```

### Existing Next.js API Route Pattern
```typescript
// From src/app/api/action/route.ts
import { NextResponse } from 'next/server';
import { ActionRequestSchema } from '@shared/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = ActionRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request', details: result.error }, { status: 400 });
    }

    const { sessionId, action } = result.data;
    // ... process action
    
    return NextResponse.json({ success: true, delta });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Existing Run Inventory Pattern
```typescript
// From src/game/systems/run-inventory.ts
export class RunInventoryRegistry {
  private inventories: Map<string, RunInventory> = new Map();
  private readonly MAX_SLOTS = 5;

  getOrCreate(sessionId: string): RunInventory {
    let inventory = this.inventories.get(sessionId);
    if (!inventory) {
      inventory = { sessionId, maxSlots: this.MAX_SLOTS, software: [] };
      this.inventories.set(sessionId, inventory);
    }
    return inventory;
  }

  addSoftware(sessionId: string, item: RunInventoryItem): boolean {
    const inventory = this.getOrCreate(sessionId);
    if (inventory.software.length >= inventory.maxSlots) {
      return false;
    }
    inventory.software.push(item);
    return true;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Currency as ECS components (ScrapComponent) | Currency as inventory items with stacking | Phase 13 (2026-04) | Creates inventory pressure (slots are shared resource), more interesting gameplay decisions |
| Per-run economies with no persistence | Between-run progression with weekly reset | Phase 13 (2026-04) | Introduces meta-game layer, players optimize for weekly cycles |
| Flat currency systems | Multi-tier currency with distinct sinks | Modern roguelike standard (2020+) | Each currency has clear purpose, prevents "optimal currency" problem |
| Permanent unlocks | Weekly reset with Legacy Code penalty | Live-service roguelike pattern (2022+) | Prevents power creep, forces meta-shifts, keeps game fresh |

**Deprecated/outdated:**
- ScrapComponent for currency storage — migrating to inventory-based in Phase 13
- Direct component mutation for economy operations — all economy ops now go through pipeline or API for server validation

## Validation Architecture

> Nyquist validation is enabled per .planning/config.json

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npm test -- --run --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ECON-01 | Scrap drops from all enemy tiers, picked up via inventory | integration | `npm test -- src/game/systems/__tests__/currency-pickup.test.ts -x` | ❌ Wave 0 |
| ECON-02 | Blueprint drops from Tier 2/3 with identification labels | integration | `npm test -- src/game/systems/__tests__/blueprint-drops.test.ts -x` | ❌ Wave 0 |
| ECON-03 | Flux drops from enemies + extraction bonus calculation | integration | `npm test -- src/game/systems/__tests__/flux-economy.test.ts -x` | ❌ Wave 0 |
| ECON-04 | Death pity pays 25% Scrap, other currency lost | integration | `npm test -- src/shared/__tests__/death-pity.test.ts -x` | ❌ Wave 0 |
| ECON-05 | Server validates all currency transactions | integration | `npm test -- src/app/api/__tests__/economy-validation.test.ts -x` | ❌ Wave 0 |
| ECON-06 | Faucet/sink balance (drops vs costs) | unit | `npm test -- src/game/systems/__tests__/economy-balance.test.ts -x` | ❌ Wave 0 |
| BP-01 | Locked File entity creation with Item + label | unit | `npm test -- src/game/entities/__tests__/blueprint-entity.test.ts -x` | ❌ Wave 0 |
| BP-02 | Compilation consumes Flux, adds to library | integration | `npm test -- src/app/api/economy/__tests__/compile.test.ts -x` | ❌ Wave 0 |
| BP-03 | Installation consumes Scrap, equips from library | integration | `npm test -- src/app/api/economy/__tests__/install.test.ts -x` | ❌ Wave 0 |
| BP-04 | Weekly reset deletes uninstalled Blueprints | integration | `npm test -- src/app/api/admin/__tests__/reset.test.ts -x` | ❌ Wave 0 |
| BP-05 | Legacy Code doubles Heat cost for installed Firmware | unit | `npm test -- src/game/systems/__tests__/legacy-code.test.ts -x` | ❌ Wave 0 |
| BP-07 | Winner's Item revealed from curated rotation | unit | `npm test -- src/game/systems/__tests__/winners-item.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- {affected test file} -x` (fail-fast mode)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual economy balance verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/game/systems/__tests__/currency-pickup.test.ts` — covers ECON-01 (Scrap/Flux/Blueprint pickup from entities)
- [ ] `src/game/systems/__tests__/blueprint-drops.test.ts` — covers ECON-02 (Blueprint identification labels)
- [ ] `src/game/systems/__tests__/flux-economy.test.ts` — covers ECON-03 (Flux dual sources: drops + extraction)
- [ ] `src/shared/__tests__/death-pity.test.ts` — covers ECON-04 (25% Scrap pity on death)
- [ ] `src/app/api/__tests__/economy-validation.test.ts` — covers ECON-05 (server validation for compile/install/purchase)
- [ ] `src/game/systems/__tests__/economy-balance.test.ts` — covers ECON-06 (faucet/sink balance math)
- [ ] `src/game/entities/__tests__/blueprint-entity.test.ts` — covers BP-01 (Locked File entity structure)
- [ ] `src/app/api/economy/__tests__/compile.test.ts` — covers BP-02 (compilation Flux deduction + library addition)
- [ ] `src/app/api/economy/__tests__/install.test.ts` — covers BP-03 (installation Scrap deduction + Shell equip)
- [ ] `src/app/api/admin/__tests__/reset.test.ts` — covers BP-04 (weekly reset library clearing)
- [ ] `src/game/systems/__tests__/legacy-code.test.ts` — covers BP-05 (Heat doubling for Legacy Firmware)
- [ ] `src/game/systems/__tests__/winners-item.test.ts` — covers BP-07 (Winner's Item curated rotation)
- [ ] `src/game/systems/__tests__/profile-persistence.test.ts` — test loadProfile/saveProfile functions (read/write/atomic rename)
- [ ] `src/game/systems/__tests__/inventory-slot-accounting.test.ts` — test currency + software slot counting (Pitfall 1)
- [ ] `src/shared/__tests__/extraction-cap-enforcement.test.ts` — test caps applied only at extraction (Pitfall 2)

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns (components, pipeline, API routes) — verified by reading source files 2026-04-02
- package.json dependency versions — verified Zod 4.3.6, Next.js 16.1.6, Vitest 4.1.0, Zustand 5.0.11
- Phase 13 CONTEXT.md — all locked decisions (D-01 through D-36) read 2026-04-02
- REQUIREMENTS.md — ECON-01 through ECON-06, BP-01 through BP-07 verified

### Secondary (MEDIUM confidence)
- Node.js fs.promises API stability — Node 18+ (LTS) has stable promises API, widely adopted pattern
- Atomic file write pattern (write to .tmp, rename) — POSIX standard, used in production systems
- Zod for runtime validation — industry standard pattern for TypeScript projects as of 2024-2026
- Multi-tier currency roguelike patterns — observed in Hades (Darkness/Keys/Nectar), Slay the Spire (Gold/Keys/Relics), modern roguelike standard

### Tertiary (LOW confidence)
- Weekly reset mechanics in live-service roguelikes — pattern from Destiny 2 (2017+), adapted to single-player roguelikes in 2022+, still evolving design space
- Game economy tuning values (drop rates, costs) — these are highly game-specific, no universal "correct" values, requires playtesting iteration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already in project, versions verified from package.json
- Architecture: HIGH - Patterns directly from existing codebase (components, pipeline, API routes)
- Pitfalls: MEDIUM - Derived from design decisions + common ECS/inventory system issues, not battle-tested yet
- Economy tuning: LOW - Drop rates and costs are game-specific, require playtesting to validate

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — stack is stable, economy.json pattern is mature, weekly reset is design constraint not tech constraint)

---

*Research complete. Ready for planning.*
