# Phase 8: Firmware & Neural Heat System — Research

**Researched:** 2026-03-29
**Status:** Complete

## Executive Summary

Phase 8 introduces three interconnected systems — Heat management, Firmware ability activation, and Kernel Panic consequences — all wired into the existing turn-based action pipeline. The research below maps every requirement (FIRM-01 through FIRM-11) to concrete implementation paths grounded in the current codebase. The biggest architectural challenge is the targeting cursor mode (D-06), which requires a new input state machine layer on top of the existing `InputManager`. Everything else follows established patterns cleanly.

---

## 1. Component Design

### 1.1 HeatComponent

**Pattern:** Follow `defineComponent()` from `src/engine/ecs/types.ts` with Zod schema. One file per component in `src/shared/components/`.

```typescript
// src/shared/components/heat.ts
export const Heat = defineComponent('heat', z.object({
  current: z.number().min(0).default(0),
  maxSafe: z.number().int().positive().default(100),
  baseDissipation: z.number().positive().default(5),
  ventPercentage: z.number().min(0).max(1).default(0.5),
  isVenting: z.boolean().default(false),
}));
```

**Design rationale:**
- `current` tracks accumulated Heat from 0 upward (no cap — FIRM-02 says "above 100 triggers Corruption Zone," implying Heat can exceed 100).
- `maxSafe` is the safe zone threshold (default 100). FIRM-10 says equipment can "raise safe zone above 100" — this field enables that.
- `baseDissipation` is the base rate per turn (D-02: 5 Heat/turn). Stability stat modifies this at runtime (D-03).
- `ventPercentage` supports D-13 (50% removal) and future equipment modification.
- `isVenting` tracks the vulnerability flag (D-14) so other systems can check it during damage resolution.

**Registration:** Add to `COMPONENTS_REGISTRY` in `src/shared/components/index.ts`.

### 1.2 AbilityDef Component

Each Firmware ability is its own entity (following the "every entity type definable in JSON" constraint). The `AbilityDef` component defines ability parameters.

```typescript
// src/shared/components/ability-def.ts
export const AbilityDef = defineComponent('abilityDef', z.object({
  name: z.string(),
  heatCost: z.number().int().min(0),
  range: z.number().int().min(0),
  effectType: z.enum(['dash', 'ranged_attack', 'toggle_vision']),
  damageAmount: z.number().int().min(0).default(0),
  dashDistance: z.number().int().min(0).default(0),
  visionRadius: z.number().int().min(0).default(0),
  heatPerTurn: z.number().int().min(0).default(0),  // For sustained abilities like Extended_Sight
  isToggle: z.boolean().default(false),
  isActive: z.boolean().default(false),  // Runtime state for toggle abilities
}));
```

**Why this shape:** The `effectType` discriminator lets the FirmwareSystem branch on ability type. Fields like `dashDistance` and `visionRadius` are type-specific but kept flat (not nested unions) for JSON template simplicity and Zod schema ergonomics. Unused fields default to 0.

### 1.3 StatusEffects Stub

Per D-09, a lightweight stub designed for Phase 9 forward-compatibility.

```typescript
// src/shared/components/status-effects.ts
export const StatusEffects = defineComponent('statusEffects', z.object({
  effects: z.array(z.object({
    name: z.string(),
    duration: z.number().int().min(0),
    magnitude: z.number().default(0),
    source: z.string().optional(),  // Forward-compat: who applied it
  })),
}));
```

**Forward-compatibility notes:**
- `source` field anticipates Phase 9's Augment trigger tracking.
- The array of objects is extensible — Phase 9 can add `triggerType`, `stackId`, etc. without breaking the schema (Zod's `.extend()` or schema migration).
- The tick-down system in Phase 8 is a simple reducer: decrement `duration`, filter out zeros.

---

## 2. Action Pipeline Integration

### 2.1 GameAction Extensions

Current `GameAction` enum (`src/game/input/actions.ts`):
```typescript
MOVE_NORTH, MOVE_SOUTH, MOVE_EAST, MOVE_WEST, WAIT, PAUSE
```

**New entries per D-05:**
```typescript
USE_FIRMWARE_0 = 'USE_FIRMWARE_0',
USE_FIRMWARE_1 = 'USE_FIRMWARE_1',
USE_FIRMWARE_2 = 'USE_FIRMWARE_2',
VENT = 'VENT',
CANCEL_TARGET = 'CANCEL_TARGET',
CONFIRM_TARGET = 'CONFIRM_TARGET',
```

**New bindings:**
```typescript
Digit1: GameAction.USE_FIRMWARE_0,
Digit2: GameAction.USE_FIRMWARE_1,
Digit3: GameAction.USE_FIRMWARE_2,
KeyV: GameAction.VENT,
```

### 2.2 ActionIntent Extensions

Current `ActionIntentSchema` in `src/shared/types.ts` uses `z.discriminatedUnion('type', [...])`.

**New schemas:**
```typescript
export const UseFirmwareActionSchema = z.object({
  type: z.literal('USE_FIRMWARE'),
  slotIndex: z.number().int().min(0).max(2),
  targetX: z.number().int(),
  targetY: z.number().int(),
});

export const VentActionSchema = z.object({
  type: z.literal('VENT'),
});
```

Add both to the `ActionIntentSchema` discriminated union.

### 2.3 Server-Side Processing (`route.ts`)

Current flow: `action.type` → `MOVE` or `WAIT` → `turnManager.submitAction(actionKey)`.

**Extension pattern:**
```typescript
} else if (action.type === 'USE_FIRMWARE') {
  actionKey = `USE_FIRMWARE_${action.slotIndex}`;
  // Target coordinates stored in pipeline context or embedded in action
} else if (action.type === 'VENT') {
  actionKey = GameAction.VENT;
}
```

The server must validate:
1. Player has a Firmware equipped at `slotIndex` (check `FirmwareSlots.equipped[slotIndex]`)
2. Target is within ability range
3. Player has enough... actually, player can always USE firmware — Heat accumulates freely. The Kernel Panic risk is the gating mechanism, not a hard block (D-10).

### 2.4 TurnManager Integration

Current `submitAction(action: string)` in `TurnManager` processes the action, deducts energy, then calls `playerActionHandler(action, entityId)`.

**Key insight:** Firmware abilities consume a full turn (D-07). The existing energy deduction (`defaultActionCost: 1000`) already handles this. We don't need a separate cost — the `USE_FIRMWARE_N` actions are just alternative action types that consume the same energy as movement.

The `playerActionHandler` in `setup.ts` needs to branch:
```typescript
if (action.startsWith('USE_FIRMWARE_')) {
  const slotIndex = parseInt(action.split('_')[2]);
  firmwareSystem.activateAbility(entityId, slotIndex, targetX, targetY);
} else if (action === 'VENT') {
  heatSystem.vent(entityId);
}
```

**Challenge:** The target coordinates need to flow from input to server to handler. Two approaches:
1. **Embed in TurnManager context** — Add an optional `targetContext` alongside the action string.
2. **Separate lookup** — Store the target on a component (e.g., `TargetingIntent`) before submitting the action, and the system reads it.

**Recommendation:** Option 1 is cleaner. Modify `submitAction(action: string, context?: { targetX: number, targetY: number })` and pass context through to the handler. This is a minimal change to TurnManager's interface.

---

## 3. Targeting System (D-06)

### 3.1 Architecture

The targeting cursor is a new **input mode** — a state machine within InputManager. Current InputManager is stateless (maps key → action → handler). Targeting requires:

1. **Entering targeting mode:** Player presses `1`/`2`/`3`
2. **Cursor movement:** Arrow/WASD moves the cursor (not the player)
3. **Confirmation:** Enter/Space confirms target
4. **Cancellation:** Escape exits targeting mode

**Recommended approach:** Create a `TargetingState` object that InputManager checks before dispatching:

```typescript
interface TargetingState {
  active: boolean;
  firmwareSlotIndex: number;
  cursorX: number;
  cursorY: number;
  range: number;
  validTargets: Set<string>;
}
```

When targeting is active, `InputManager.keydownHandler` routes arrow keys to cursor movement instead of `GameAction.MOVE_*`. This avoids modifying the existing action binding system.

### 3.2 Mouse Support

PixiJS provides `FederatedPointerEvent` on sprites/containers. The cursor layer (a PixiJS overlay) listens for `pointermove` and `pointerdown` events:
- `pointermove` → Update cursor position to hovered tile
- `pointerdown` → Confirm target (same as Enter/Space)

**Integration:** The rendering system already has access to the PixiJS stage and camera. A `TargetingOverlay` PixiJS component renders:
- Highlighted valid tiles (within range)
- Cursor sprite at current target position
- Path preview (optional, for dash abilities)

### 3.3 Valid Target Calculation

For each ability `effectType`:
- **`dash`**: All walkable tiles within `dashDistance` of the player (straight line, ignoring collision per Phase_Shift spec)
- **`ranged_attack`**: All tiles within `range` with line-of-sight (reuse rot.js FOV or simple Bresenham)
- **`toggle_vision`**: No target needed — toggles on/off. Skip targeting mode entirely.

---

## 4. Heat System Design

### 4.1 Dissipation (FIRM-05, D-01, D-02, D-03)

**When:** Start of player's turn (D-01), during `Phase.PRE_TURN`.

**Formula (D-03):**
```
effectiveDissipation = baseDissipation + (stability * stabilityModifier)
```

Where `stabilityModifier` is a tuning constant. With Striker stability=5 and Bastion stability=15, a modifier of 0.5 gives:
- Striker: 5 + (5 * 0.5) = 7.5 → ~6 turns to cool from Neural_Spike (40 Heat)
- Bastion: 5 + (15 * 0.5) = 12.5 → ~3 turns to cool from Neural_Spike

This creates the intended archetype differentiation.

**System placement:** Register as a `Phase.PRE_TURN` system on the World, or handle via EventBus → `TURN_START` event. Since TurnManager already emits `TURN_START`, subscribing to it is the cleanest path.

**Concern:** `TURN_START` fires during `executeTurnCycle()` BEFORE `PRE_TURN` systems. This is perfect — the player sees their cooled Heat before deciding.

### 4.2 Vent Action (FIRM-06, D-13, D-14, D-15, D-16)

**Mechanic:**
1. Remove 50% of current Heat (`heat.current *= (1 - heat.ventPercentage)`)
2. Apply vulnerability flag: either a StatusEffects entry `{ name: 'VENTING_VULNERABLE', duration: 1, magnitude: 0 }` or set `heat.isVenting = true` and clear it next turn
3. Consume full turn via `TurnManager.submitAction('VENT')`

**Vulnerability implementation:** The `isVenting` boolean on HeatComponent is simpler and avoids coupling to the StatusEffects stub. The combat system checks `heat.isVenting` on the defender — if true, armor is set to 0 for that attack. The HeatSystem clears `isVenting` at the start of the player's next turn (same dissipation hook).

### 4.3 Kernel Panic (FIRM-03, FIRM-04, D-09, D-10, D-11, D-12)

**When:** After Firmware ability resolves (D-10), IF Heat > maxSafe.

**Tier table (FIRM-04):**

| Heat % | Range | Base Chance | Effect |
|--------|-------|-------------|--------|
| 101-120% | 101-120 | 15% | HUD_GLITCH (2 turns) |
| 121-140% | 121-140 | 30% | INPUT_LAG (3 turns) |
| 141-160% | 141-160 | 50% | FIRMWARE_LOCK (2 turns) |
| 161%+ | 161+ | 75% | CRITICAL_REBOOT |

**Stability modifier (D-12):**
```
effectiveChance = baseChance - (stability * stabilityReductionPerPoint)
```

Example: `stabilityReductionPerPoint = 1.0`. Striker (stability 5): 15% - 5% = 10% at Tier 1. Bastion (stability 15): 15% - 15% = 0% at Tier 1 (Bastion is practically immune to minor Kernel Panics). This can be tuned.

**CRITICAL_REBOOT (D-11):**
- Skip next 2 turns (stun)
- Force Heat to 0
- Implementation: Add a `StatusEffects` entry `{ name: 'CRITICAL_REBOOT', duration: 2 }`. The TurnManager's player action handler checks for this status and auto-skips if present.

**Alternatives considered:**
- Adding a `stunTurns: number` field to HeatComponent — simpler but couples stun to Heat specifically. Using StatusEffects is cleaner and generalizes to Phase 9.

---

## 5. Firmware System

### 5.1 Ability Resolution

Each `effectType` has a distinct resolution path:

**`dash` (Phase_Shift.sh):**
1. Validate target within `dashDistance` tiles in a straight line
2. Move player to target tile, ignoring collision (teleport-style)
3. Update Grid spatial index
4. Emit `ENTITY_MOVED` event

Implementation reuses `movementSystem.processMove()` but needs a variant that ignores blocking entities. Or: directly update `Position` component and `grid.moveEntity()` without collision checks.

**`ranged_attack` (Neural_Spike.exe):**
1. Validate target within `range` and has line-of-sight
2. Check for entity at target tile
3. If entity present, deal `damageAmount` damage (reuse combat system's damage pipeline or emit `DAMAGE_DEALT` directly)
4. Emit targeting feedback event

**`toggle_vision` (Extended_Sight.sys):**
1. Toggle `abilityDef.isActive` on the Firmware entity
2. When active: pay `heatPerTurn` Heat at the start of each turn (piggybacked on dissipation system)
3. Expand player FOV radius (modify FOV calculation input)
4. When deactivated: restore normal FOV radius

### 5.2 JSON Entity Templates

Following the `goblin.json` / `player.json` pattern:

```json
// src/game/entities/templates/phase-shift.json
{
  "name": "phase_shift",
  "components": {
    "abilityDef": {
      "name": "Phase_Shift.sh",
      "heatCost": 25,
      "range": 0,
      "effectType": "dash",
      "dashDistance": 5,
      "damageAmount": 0
    }
  }
}
```

```json
// src/game/entities/templates/neural-spike.json
{
  "name": "neural_spike",
  "components": {
    "abilityDef": {
      "name": "Neural_Spike.exe",
      "heatCost": 40,
      "range": 6,
      "effectType": "ranged_attack",
      "damageAmount": 15,
      "dashDistance": 0
    }
  }
}
```

```json
// src/game/entities/templates/extended-sight.json
{
  "name": "extended_sight",
  "components": {
    "abilityDef": {
      "name": "Extended_Sight.sys",
      "heatCost": 10,
      "range": 0,
      "effectType": "toggle_vision",
      "heatPerTurn": 10,
      "isToggle": true,
      "visionRadius": 12
    }
  }
}
```

These must be registered in `src/game/entities/index.ts` (or wherever `registerGameTemplates()` loads templates).

### 5.3 Firmware Drops (FIRM-08, FIRM-09)

Firmware drops from Tier 2/3 enemies as "Locked Files." In Phase 8, this is a **stub** — full compilation happens in Phase 13 (Blueprint System).

**Implementation:**
- Add Firmware template names to enemy `lootTable.drops` in JSON templates
- When a Firmware entity is created from loot, it gets an `AbilityDef` plus a new `LockedFile` component (boolean flag) preventing equip until compiled
- FIRM-09 compilation is stubbed: add a TODO comment and skip the lock check in Phase 8 for testing

### 5.4 Legacy Code (FIRM-11)

Firmware installed on a Shell persists through weekly reset but becomes "Legacy Code" with doubled Heat cost. This is **Phase 13 territory** (weekly reset logic). Phase 8 just needs:
- An `isLegacy: z.boolean().default(false)` field on `AbilityDef`
- When `isLegacy` is true, the FirmwareSystem doubles the `heatCost` at activation time
- The actual flag-setting is deferred to Phase 13's reset system

---

## 6. Event Design

Per AGENTS.md Event Tier Assignment rules:

### GameplayEvents (shared — server processes these)

```typescript
HEAT_CHANGED: { entityId: EntityId; oldHeat: number; newHeat: number; maxSafe: number };
FIRMWARE_ACTIVATED: { entityId: EntityId; firmwareEntityId: EntityId; abilityName: string; heatCost: number; targetX: number; targetY: number };
KERNEL_PANIC_TRIGGERED: { entityId: EntityId; tier: number; effectName: string; severity: string };
VENT_COMPLETED: { entityId: EntityId; oldHeat: number; newHeat: number };
FIRMWARE_TOGGLED: { entityId: EntityId; firmwareEntityId: EntityId; abilityName: string; active: boolean };
```

### GameEvents (client-only — UI/rendering)

```typescript
TARGETING_STARTED: { firmwareSlotIndex: number; range: number; effectType: string };
TARGETING_CANCELLED: {};
TARGETING_CONFIRMED: { targetX: number; targetY: number };
```

---

## 7. System Ordering & Wiring

### New Systems

| System | Created in | Pattern |
|--------|-----------|---------|
| `createHeatSystem` | `src/game/systems/heat.ts` | Factory function, subscribes to `TURN_START` |
| `createFirmwareSystem` | `src/game/systems/firmware.ts` | Factory function, called from action handler |
| `createKernelPanicSystem` | `src/game/systems/kernel-panic.ts` | Factory function, subscribes to `FIRMWARE_ACTIVATED` |
| `createStatusEffectSystem` | `src/game/systems/status-effects.ts` | Factory function, subscribes to `TURN_START` for tick-down |

### Execution Order

1. **TURN_START** → HeatSystem.dissipate() (D-01: dissipation before action)
2. **TURN_START** → StatusEffectSystem.tickDown() (decrement durations, clear `isVenting`)
3. **Player Action** → FirmwareSystem.activateAbility() (resolve effect, add Heat)
4. **FIRMWARE_ACTIVATED** → KernelPanicSystem.checkOverclock() (D-10: after ability resolves)

### Integration Points in setup.ts / engine-factory.ts

```typescript
// New system creation
const heatSystem = createHeatSystem(world, eventBus);
const firmwareSystem = createFirmwareSystem(world, grid, eventBus, movementSystem);
const kernelPanicSystem = createKernelPanicSystem(world, eventBus);
const statusEffectSystem = createStatusEffectSystem(world, eventBus);

// Init all
heatSystem.init();
firmwareSystem.init();
kernelPanicSystem.init();
statusEffectSystem.init();

// Extend player action handler
turnManager.setPlayerActionHandler((action, entityId) => {
  if (action.startsWith('USE_FIRMWARE_')) {
    firmwareSystem.activateAbility(entityId, slotIndex, targetX, targetY);
  } else if (action === 'VENT') {
    heatSystem.vent(entityId);
  } else if (DIRECTIONS[action]) {
    movementSystem.processMove(entityId, dx, dy);
  }
  eventBus.emit('PLAYER_ACTION', { action, entityId });
});
```

---

## 8. Risk Assessment & Dependencies

### Hard Dependencies (Phase 7)

| Dependency | Status | Notes |
|------------|--------|-------|
| ShellComponent with `stability` | ✅ Available | Used for dissipation/KP formulas |
| FirmwareSlots.equipped[] | ✅ Available | Indexed by hotkey per D-05 |
| PortConfig.maxFirmware | ✅ Available | Validates slot limits |
| Entity templates pipeline | ✅ Available | For Firmware ability JSON files |
| GameAction enum | ✅ Available | Extend with new actions |
| TurnManager.submitAction() | ✅ Available | Needs minor context extension |

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Targeting mode breaks existing input flow | Medium | Isolated TargetingState; existing bindings unaffected when not targeting |
| Target coordinates through action pipeline | Low | Pass context object alongside action string in TurnManager |
| Extended_Sight toggle sustaining Heat per turn | Medium | Piggyback on dissipation hook; track active toggles on player entity |
| StatusEffects stub breaking Phase 9 migration | Low | Schema uses extensible array of objects; Phase 9 adds fields via `.extend()` |
| Server validation of Firmware actions | Medium | Follow existing route.ts pattern; validate equipped state and range server-side |

---

## 9. Validation Architecture

### Testable Assertions (Per Plan)

**08-01 (Heat System):**
- HeatComponent defaults to 0 current, 100 maxSafe, 5 baseDissipation
- Dissipation reduces Heat by `baseDissipation + stability * modifier` each turn
- Venting removes 50% of current Heat and sets isVenting=true
- isVenting clears at start of next turn
- Heat persists across turn cycles (does not auto-reset)

**08-02 (Firmware System):**
- Firmware activation adds `heatCost` to player's Heat
- `USE_FIRMWARE_N` action consumes full turn (energy deducted)
- Invalid slot index (no firmware equipped) is rejected
- Target validation: out-of-range targets rejected
- Phase_Shift moves player ignoring collision
- Neural_Spike deals damage to entity at target

**08-03 (Kernel Panic System):**
- No roll when Heat ≤ maxSafe
- Correct tier selected based on Heat percentage
- Stability reduces effective chance
- StatusEffect added with correct name and duration
- CRITICAL_REBOOT forces Heat to 0 and applies stun

**08-04 (Starter Firmware + Templates):**
- All 3 JSON templates parse via AbilityDef schema
- Phase_Shift.sh has heatCost=25, effectType=dash, dashDistance=5
- Neural_Spike.exe has heatCost=40, effectType=ranged_attack, range=6, damageAmount=15
- Extended_Sight.sys has heatCost=10, effectType=toggle_vision, isToggle=true, heatPerTurn=10

### Integration Test Scenarios

1. **Full Firmware Cycle:** Equip Firmware → Activate → Heat increases → Dissipation reduces over turns → Vent resets
2. **Kernel Panic Chain:** Push Heat above 160% → Activate Firmware → CRITICAL_REBOOT fires → Player stunned for 2 turns → Heat vented to 0
3. **Server Round-Trip:** Client sends `USE_FIRMWARE` intent → Server validates → Delta returned → Client reconciles

---

## RESEARCH COMPLETE

All 11 requirements (FIRM-01 through FIRM-11) have concrete implementation paths. The codebase has clean extension points for all needed changes. Key decisions (targeting via cursor, StatusEffects stub design, event tier placement) are documented with alternatives and rationale.
