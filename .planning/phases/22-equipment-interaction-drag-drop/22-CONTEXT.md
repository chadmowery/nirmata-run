# Phase 22: Equipment Interaction (Drag & Drop) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Allowing the user to move items between the BackpackGrid and EquipmentPanel via drag-and-drop, handling valid/invalid targets, and executing the action via the Turn Manager. This involves implementing the interactive layer for the equipment UI created in Phase 21.

</domain>

<decisions>
## Implementation Decisions

### Drag & Drop Technology
- **D-01:** **HTML5 Drag & Drop API** — We will use the native HTML5 Drag and Drop API for implementation, as it handles ghost images automatically and avoids external library dependencies.

### Software Installation UX
- **D-02:** **Drop Target Flexibility** — Users can either drop software onto the parent equipment slot (which auto-assigns to the first available child slot) OR onto a specific nested software indicator.
- **D-03:** **Uninstallation UX** — Users can uninstall software by either dragging the indicator back to the backpack grid OR by right-clicking/double-clicking the indicator for a faster action.

### UI State and Feedback
- **D-04:** **Optimistic UI** — The inventory UI will update instantly when an item is dropped. If the server rejects the action, the state will roll back. This matches the optimistic logic used for movement.
- **D-05:** **Click Fallback Auto-Equip** — Double-clicking an item in the backpack will only auto-equip it if there is exactly one unambiguous valid target slot. If multiple slots are valid, the action does nothing (user must drag instead).

### Claude's Discretion
- Exact visual feedback for the HTML5 drag ghost image.
- Specific implementation of the optimistic rollback state handling within the Zustand store.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UI-02 (Drag and drop interaction), SW-01 (Software installation), SW-02 (Software uninstallation).

### Prior Phase Context
- `.planning/phases/21-inventory-item-tooltips/21-CONTEXT.md` — Defines the inventory layout, "Prevent Highlight" invalid target rule, and click fallback toast rule.
- `.planning/phases/19-combat-stat-pipeline-turn-costs/19-CONTEXT.md` — Defines the `EquipIntent` and `UninstallIntent` turn cost mechanism.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BackpackGrid.tsx` and `EquipmentPanel.tsx` (`src/components/ui/inventory/`) — Existing UI components to attach drag-and-drop handlers to.
- `TurnManager.submitAction` (`src/engine/turn/turn-manager.ts`) — Used to submit the resulting `EquipIntent` or `UninstallIntent`.

### Established Patterns
- Native DOM APIs over external libraries for interaction.
- Optimistic UI updates with server reconciliation (`src/shared/reconciliation.ts`).

### Integration Points
- Add `draggable` and `onDrag*` event handlers to the inventory components in `src/components/ui/inventory/`.
- Dispatch actions to the Zustand store (`src/game/ui/store.ts`) for optimistic updates.
- Submit intent to `TurnManager` when a drop successfully modifies equipment.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond adhering to the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-equipment-interaction-drag-drop*
*Context gathered: 2026-05-17*