<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The inventory will be presented as a Center Overlay (dims the game behind it, maintains 'Vibrant Decay' aesthetic).
- **D-02:** Inside the overlay, the layout is a Split View (Left: Shell equipment, Right: Backpack grid).
- **D-03:** Software slots will be presented as Nested Indicators (small visual indicators directly on the equipment icon).
- **D-04:** The system will support both manual Drag & Drop AND a click-based fallback (e.g., double-click/right-click) for accessibility.
- **D-05:** Swapping items costs 1 turn. This will happen via Immediate Action (standard roguelike flow: it just happens and time advances) without a confirmation prompt.
- **D-06:** Tooltips will use a Tiered approach (Hover shows basic stats; holding a key like 'Alt' expands it to show software/deep stats).
- **D-07:** The tooltip position will be Anchored to the Item being hovered, appearing predictably next to it.
- **D-08:** The backpack will use a Manual Grid where players can drag items to specific slots.
- **D-09:** When picking up new loot from the ground, it will automatically fill the first empty cell from the top-left in the manual grid.
- **D-10:** For drag-and-drop, invalid targets will Prevent Highlight (the slot simply won't highlight as a valid drop target).
- **D-11:** For click fallback actions, attempting an invalid action will show a Brief Toast/Tooltip (e.g., 'Invalid Target').

### the agent's Discretion
Empty states (visuals for empty slots and empty inventory) were discussed but left for Claude to implement fitting the 'Vibrant Decay' aesthetic.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | User can access a dedicated in-run inventory management screen to view all carried items. | Added `TOGGLE_INVENTORY` to `GameAction` and mapped to `InventoryOverlay.tsx`. |
| UI-03 | User can view detailed item stats, heat costs, and installed software modifiers via hover-tooltips. | `InRunItemTooltip.tsx` will query `GameContext.world` to extract component data for tooltips. |
</phase_requirements>

# Phase 21: Inventory & Item Tooltips - Research

**Researched:** 2026-05-16
**Domain:** React UI Overlays, Drag & Drop without libraries, Zustand Store Sync
**Confidence:** HIGH

## Summary

This phase implements the in-run inventory management screen. The primary challenge is building a custom drag-and-drop interface and tooltip system without external libraries, while integrating with the existing ECS back-end (`RunInventory`, `EquipmentSlots`, `EquipIntent`, `UnequipIntent`). The UI must align with the "Vibrant Decay" aesthetic already established in `HUDOverlay.tsx` and the Hub interface.

**Primary recommendation:** Use Zustand's `gameStore` to track `inventoryVisible` and UI drag state, but read detailed entity component data (for tooltips and nested slots) directly from `window.gameContext.world` to avoid replicating deep ECS hierarchies in Zustand. Dispatch equip/unequip actions through a newly added `GameAction` in the `InputManager`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | `19.2.4` | Component Rendering | Project constraint |
| Zustand | `5.0.11` | UI State Management | Existing standard (`src/game/ui/store.ts`) |
| CSS Modules | Built-in | Styling | Project constraint (`.module.css`) |
| Lucide React | `0.577.0` | Iconography | Existing standard for UI icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom D&D | `dnd-kit` | Blocked by explicit constraint (no external libraries for D&D or tooltips). |

## Architecture Patterns

### Recommended Project Structure
```
src/components/ui/
├── inventory/
│   ├── InventoryOverlay.tsx      # Main wrapper (dimmed background, split layout)
│   ├── EquipmentPanel.tsx        # Left side: Shell equipment
│   ├── BackpackGrid.tsx          # Right side: Manual grid
│   ├── InRunItemTooltip.tsx      # Custom tooltip component
│   └── InventoryOverlay.module.css # Styling for vibrant decay
```

### Pattern 1: Action Submission for 1-Turn Cost
**What:** Mapping UI actions to server-authoritative engine intents.
**When to use:** When the player equips or unequips an item via the inventory overlay.
**Example:**
```typescript
// Define new GameActions in src/game/input/actions.ts
export enum GameAction {
  // ... existing ...
  TOGGLE_INVENTORY = 'TOGGLE_INVENTORY',
  EQUIP_ITEM = 'EQUIP_ITEM', // Requires payload, usually passed out-of-band or via custom intent submission
}

// Submit via InputBridge (see src/game/setup.ts)
async function sendEquipToServer(slotType: string, itemEntityId: number) {
  inputManager.setRequestPending(true);
  turnManager.submitAction('EQUIP'); // Costs 1 turn locally
  await sendActionToServer({
    type: 'EQUIP_ITEM',
    slotType,
    itemEntityId
  });
  inputManager.setRequestPending(false);
}
```

### Pattern 2: Component Data Lookup for Tooltips
**What:** Reading entity data for the tooltip without storing the entire component hierarchy in Zustand.
**When to use:** In `InRunItemTooltip.tsx` when given an `entityId`.
**Example:**
```typescript
// Inside a React component
const context = (window as any).gameContext;
if (context && itemEntityId) {
  const eqDef = context.world.getComponent(itemEntityId, EquipmentDef);
  const rarity = context.world.getComponent(itemEntityId, RarityTier);
  // Render tooltip using eqDef.name, eqDef.baseDamage, rarity.tier
}
```

### Pattern 3: Custom Drag and Drop State
**What:** Using React events (`onMouseDown`, `onMouseEnter`, `onMouseUp`) and Zustand to handle drag state manually (similar to `LoadoutTab`).
**When to use:** In `BackpackGrid.tsx` and `EquipmentPanel.tsx`.

### Anti-Patterns to Avoid
- **Duplicating ECS Data in Zustand:** Do not copy deep nested software data into `gameStore.player`. The store should only hold the top-level references or basic UI state (like `scrap`). The ECS `world` is already fully synced via `reconciliation.ts`.
- **Using HTML5 Drag and Drop API:** HTML5 D&D styling is notoriously difficult to customize (ghost images) and doesn't easily support the "Vibrant Decay" CSS requirements. Stick to React-managed pointer events.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-game notifications | Custom Toast Component | `gameStore.addMessage` | D-11 requires toast for invalid actions. `MessageLog` is already built for this. |

**Key insight:** The inventory overlay is purely a visualizer and intent-generator. The actual equipment logic is already handled by `createEquipmentSystem` (`src/game/systems/equipment.ts`).

## Common Pitfalls

### Pitfall 1: Bypassing the Turn Manager
**What goes wrong:** Equipping an item updates the UI but enemies don't take their turn.
**Why it happens:** The UI directly modifies the ECS component without submitting an action to the `TurnManager`.
**How to avoid:** Always use the server submission pipeline (`sendActionToServer`) accompanied by `turnManager.submitAction()` so the local state machine advances time.

### Pitfall 2: Stale UI on Inventory Sync
**What goes wrong:** The inventory overlay doesn't show new items picked up.
**Why it happens:** The `HUDOverlay` does not trigger a re-render when the `RunInventory` component is patched by `applyStateDelta`.
**How to avoid:** Ensure `syncEngineToStore` catches `RUN_INVENTORY_SYNCED` and updates a basic `inventoryRevision` counter or specific references in `gameStore` so React knows to re-render the overlay.

## Code Examples

### Custom Drag Hook / Setup (Conceptual)
```typescript
// Store state
const setDraggedItem = useStore(gameStore, (s) => s.setDraggedItem);
const draggedItem = useStore(gameStore, (s) => s.draggedItem);

const handleMouseDown = (item: RunInventoryItem, e: React.MouseEvent) => {
  setDraggedItem(item);
};

const handleMouseUp = (targetSlot: 'weapon' | 'armor') => {
  if (draggedItem) {
    submitEquipIntent(targetSlot, draggedItem.entityId);
    setDraggedItem(null);
  }
};
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Toggle inventory overlay | manual-only | N/A | ❌ |
| UI-03 | Show item tooltips on hover | unit | `npx vitest run src/components/ui/inventory/__tests__/InRunItemTooltip.test.tsx` | ❌ |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/ui/inventory/__tests__/InRunItemTooltip.test.tsx` — covers UI-03
- [ ] Framework install: Not needed (Vitest already installed)

*(Note: The primary drag-and-drop and overlay integration logic relies heavily on DOM layout and manual pointer events, making unit testing brittle. E2E/manual validation is required for UI-01).*

## Sources

### Primary (HIGH confidence)
- `src/game/ui/store.ts` - Found `gameStore` structure and message logging setup.
- `src/components/ui/HUDOverlay.tsx` - Found base HUD integration.
- `src/game/systems/equipment.ts` - Found `EquipIntent` / `UnequipIntent` logic.
- `src/shared/components/run-inventory.ts` - Found `RunInventory` schema structure.
- `src/game/setup.ts` - Found action dispatch and input binding architecture.

### Secondary (MEDIUM confidence)
- `src/components/ui/hub/LoadoutTab.tsx` - Found reference pattern for manual React-based drag and drop implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Read directly from `package.json` and established project files.
- Architecture: HIGH - Matches established patterns in `src/game/setup.ts` and `src/game/ui/store.ts`.
- Pitfalls: HIGH - Based on TurnManager restrictions defined in the engine.

**Research date:** 2026-05-16
**Valid until:** 2026-06-16