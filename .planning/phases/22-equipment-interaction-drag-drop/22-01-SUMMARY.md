---
phase: 22-equipment-interaction-drag-drop
plan: 01
subsystem: "UI"
tags: ["drag-and-drop", "equipment", "optimistic-updates", "react"]
provides: ["equipment-interaction"]
affects: ["inventory-ui", "game-store", "network-bridge"]
tech-stack:
  added: []
  patterns: ["optimistic-ui-masking", "native-html5-drag-and-drop"]
key-files:
  created: []
  modified:
    - "src/components/ui/inventory/BackpackGrid.tsx"
    - "src/components/ui/inventory/EquipmentPanel.tsx"
    - "src/components/ui/inventory/InRunItemTooltip.tsx"
    - "src/game/setup.ts"
    - "src/game/ui/store.ts"
    - "src/game/ui/store.test.ts"
key-decisions:
  - "Utilized native HTML5 Drag and Drop API to avoid external library dependencies (e.g. dnd-kit) and keep the UI lightweight."
  - "Implemented Zustand-based optimistic loadout masking that reverts/synchronizes automatically on server reconciliation."
patterns-established:
  - "Optimistic masking pattern for turn-based equipment/inventory actions."
duration: "35min"
completed: 2026-05-25
---

# Phase 22: equipment-interaction-drag-drop Summary

**Implemented full manual native drag-and-drop loadout management and double-click shortcuts with optimistic updates and server reconciliation.**

## Performance

- **Duration:** 35min
- **Tasks:** 3 completed
- **Files modified:** 6 files

## Accomplishments

- **Native HTML5 Drag and Drop Support:** Implemented standard drag-start, drag-over, and drop events to enable dragging items between the backpack and equipment panels.
- **Compatible Drag Over Highlights:** Added drag-enter and drag-leave event styling that highlights slot targets in bright cyan (`#00F0FF`) when compatible, or dark red (`#FF0055`) when incompatible.
- **Optimistic State Masking:** Wrote Zustand store selectors and actions (`optimisticEquipItem`, `optimisticUnequipItem`, and `clearOptimisticUpdates`) that immediately update the UI on slot assignment and revert to the server's authoritative state upon network roundtrip completion.
- **Shortcut Actions:** Provided double-click handlers on inventory and equipment items to auto-equip weapons/armor and install/burn software modules instantly.

## Files Created/Modified

- `src/game/ui/store.ts` - Added optimistic updates state and actions (`optimisticEquipItem`, `optimisticUnequipItem`, `clearOptimisticUpdates`).
- `src/components/ui/inventory/BackpackGrid.tsx` - Integrated drag source handlers, double-click actions, and tooltips.
- `src/components/ui/inventory/EquipmentPanel.tsx` - Implemented drop targets, drag-over compatibility styles, double-click shortcuts, and uninstall actions.
- `src/components/ui/inventory/InRunItemTooltip.tsx` - Appended custom tooltip drag/install call-to-action details.
- `src/game/setup.ts` - Set up listeners for `EQUIP_REQUESTED`, `UNEQUIP_REQUESTED`, and `BURN_SOFTWARE_REQUESTED` event bus triggers, forwarding them to the server API and clearing optimistic states on reconciliation.
- `src/game/ui/store.test.ts` - Added comprehensive unit tests for optimistic updates and store manipulation.

## Decisions & Deviations

None - followed plan as specified.

## Next Phase Readiness

All drag-and-drop equipment interaction behaviors are fully implemented, verified via unit tests, and integrated with the server action-processing pipeline.
