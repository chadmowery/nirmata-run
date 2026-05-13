---
status: diagnosed
phase: 12-multi-floor-generation-stability-extraction
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md
started: 2026-03-31T18:30:00Z
updated: 2026-03-31T19:15:00Z
---

## Current Test
[testing complete — 3 items blocked/unresolved]

## Tests

### 1. Floor Generation & Special Entities
...
result: issue
reported: "The floor layout seems consistent, however, as I go deeper in level the explored tiles are not being cleared so I can see more and more of the map the deeper I go without having to explore it first."
severity: major

### 2. Floor Transition (Staircase)
expected: |
  Interact with a staircase. Verify:
  1. Transition to a new floor occurs.
  2. The floor number indicator increments.
  3. The player is placed at a valid starting position on the new floor.
result: pass

### 3. Stability System & HUD
expected: |
  Observe the Stability bar in the HUD. Verify:
  1. Stability decreases as you take turns or move between floors.
  2. The decrease rate escalates at deeper floors.
  3. Visual feedback (jitter/glitch) occurs as Stability gets low.
result: pass
reported: "yes, note that I had to remove the turn stability bleed as it was too punishing."

### 4. Anchor Interaction (Pause & UI)
expected: |
  Reach floor 5 and interact with a Stability Anchor. Verify:
  1. The game turn loop pauses.
  2. The "System Handshake" UI (AnchorOverlay) appears.
  3. The overlay shows an extraction manifest and risk/reward info.
result: blocked
blocked_by: prior-phase
reported: "When reaching floor 5, I get errors and the floor counter stays on 4. All combat and enemies stop working properly. [ERROR] Failed to sync with server: TypeError: Cannot set properties of undefined (setting 'y') at applyStateDelta (src/shared/reconciliation.ts:27:38)"
severity: blocker

### 5. Extraction Decision
expected: |
  Choose "Extract" at the Stability Anchor. Verify:
  1. The run ends successfully.
  2. Secured items are transferred to the Stash.
  3. The Run Results screen displays accurate stats (depth, scrap, items).
result: blocked
blocked_by: prior-phase
reason: Blocked by Test 4 failure (cannot reach Anchor)

### 6. Run Failure (BSOD)
expected: |
  Let Stability reach zero or die in combat. Verify:
  1. Context-specific BSOD screen appears (e.g., "STABILITY CRITICAL" or "VITAL SIGNS LOST").
  2. The failure reason matches the cause of death.
result: pass

### 7. Run Results & Scrap
expected: |
  After completing or failing a run, verify:
  1. End-of-run stats are displayed correctly.
  2. Scrap currency earned during the run is added to the wallet.
  3. Transition back to the main menu/hub is smooth.
result: blocked
blocked_by: prior-phase
reason: Blocked by Test 4 failure (cannot complete run via extraction)

## Summary

total: 7
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "Exploration state (fog of war) is reset when a new floor is generated."
  status: failed
  reason: "User reported: The explored tiles are not being cleared so I can see more and more of the map the deeper I go without having to explore it first."
  severity: major
  test: 1
  root_cause: "RenderSystem.onDungeonGenerated clears sprites and tilemap but fails to call clearExplored(exploredSet)."
  artifacts:
    - path: "src/rendering/render-system.ts"
      issue: "Missing call to clearExplored in onDungeonGenerated method."
  missing:
    - "Call clearExplored(exploredSet) at the beginning of onDungeonGenerated."
  debug_session: ""

- truth: "Game remains stable and synchronized when reaching floor 5 (Anchor floor)."
  status: failed
  reason: "User reported: When reaching floor 5, I get errors and the floor counter stays on 4. All combat and enemies stop working properly. [ERROR] Failed to sync with server: TypeError: Cannot set properties of undefined (setting 'y') at applyStateDelta (src/shared/reconciliation.ts:27:38)"
  severity: blocker
  test: 4
  root_cause: "Incremental reconciliation clash during predicted transitions. The client predicts the Floor 5 transition locally, but then receives the server's Floor 4 -> Floor 5 delta. Applying this delta to the already-transitioned state causes json-diff-ts to crash due to path/entity ID mismatches. Additionally, grid/terrain updates are missing in reconciliation."
  artifacts:
    - path: "src/shared/reconciliation.ts"
      issue: "Does not handle delta.grid; applyChangeset fails on pre-transitioned state."
    - path: "src/game/systems/floor-manager.ts"
      issue: "Client-side prediction of floor transitions conflicts with authoritative server deltas."
  missing:
    - "Disable local prediction of floor transitions in FloorManagerSystem on the client (only enabled on server)."
    - "Update applyStateDelta to correctly patch the Grid terrain using delta.grid."
    - "Emit DUNGEON_GENERATED event from applyStateDelta when grid changes significantly."
  debug_session: ""
