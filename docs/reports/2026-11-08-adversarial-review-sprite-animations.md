# Adversarial Architectural & Implementation Review: Sprite Animation System (`ANIM-01` – `ANIM-04`)

**Date:** 2026-11-08  
**Branch Reviewed:** `feature/sprite-animations` (`main..HEAD`, 9 commits, 124 files changed)  
**Target Specs:**
- [`docs/design/SPRITE-ANIMATIONS.md`](../design/SPRITE-ANIMATIONS.md)
- [`AGENTS.md`](../../AGENTS.md), [`src/rendering/AGENTS.md`](../../src/rendering/AGENTS.md), [`src/shared/AGENTS.md`](../../src/shared/AGENTS.md), [`src/dev-tool/AGENTS.md`](../../src/dev-tool/AGENTS.md)

---

## 1. Executive Summary

An adversarial audit was conducted across the 9 commits on `feature/sprite-animations` implementing Milestones `ANIM-01` through `ANIM-04` (Schema & Shared Types, Atlas Packing & Frame Assets, Runtime `SpriteAnimator` & `RenderSystem`, and Gamedata Studio Animation Tooling), as well as the 2 bundled AI/Dijkstra commits (`1a507186`, `54871197`).

### What Went Right
- **Zero-Allocation Sparse Texture Swapping**: [`SpriteAnimator`](../../src/rendering/sprite-animator.ts) mutates `sprite.texture` in-place via [`getSpriteTexture()`](../../src/rendering/sprite-map.ts) only when `targetFrameKey !== record.lastRenderedFrameKey`, avoiding per-frame `PIXI.AnimatedSprite` or `PIXI.Sprite` allocations.
- **Server Reconciliation Protection**: [`reconcileClientWithServer()`](../../src/shared/reconciliation.ts) strips client-side transient `animationState` and `paused` fields from incoming server `SpriteComponent` payloads so authoritative delta broadcasts do not interrupt mid-swing client animations.
- **Expanded 512×512 Power-of-Two Atlas Budget**: [`scripts/add-animation-frames.cjs`](../../scripts/add-animation-frames.cjs) and [`scripts/generate-themed-tilesets.cjs`](../../scripts/generate-themed-tilesets.cjs) expand the base and themed tileset atlases to 512×512 RGBA8 while preserving existing base coordinates (`y = 0..224`) and appending animation frames at `y >= 256`.

### Adversarial Findings Scorecard

| ID | Severity | Layer | Finding Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`CRIT-01`** | **P0 (Critical)** | `@rendering` | **`loadThemedAssets()` Unload Logic Is 100% Unreachable Dead Code (VRAM Leak — Spec §3.4.2)**: `loadThemedAssets()` calls `await loadAssets()` before inspecting `activeThemeId`, which unconditionally resets `activeThemeId = 'default'`. `if (activeThemeId !== 'default')` is always `false`, so `Assets.unload()` never executes. Furthermore, `THEME_MANIFEST_MAP` aliases `'cyberacme'`, `'nucaloric'`, and `'system'` to `'assets/tileset.json'` (the base bundle URL), risking base texture eviction on unload. | **RESOLVED** |
| **`CRIT-02`** | **P0 (Critical)** | `@rendering` | **Anti-Cheat Fog-of-War State Leak (`U1` Violation) & Stale Transient Clip Replay (Spec §1.1.4, §5.1.3, §5.4.1)**: `RenderSystem.update()` computes `ambientState` (`'searched' \| 'locked' \| 'corrupted' \| 'idle'`) from live ECS components even when `!inFov` (explored Fog-of-War) instead of `rememberedProps`. Event handlers trigger transient animations (`'move'`, `'attack'`, `'interact'`) outside `currentFovSet` that freeze and replay many turns later when entering FOV. `SpriteAnimator.tick()` also bypasses FOV freezing when `fovSet.size === 0` and omits `sprite.visible` checks. | **RESOLVED** |
| **`CRIT-03`** | **P0 (Critical)** | `@dev-tool` | **Gamedata Studio Theme Selector, `TilesetAtlasCache`, and `validateThemeFile` Theme ID Mismatches Cause HTTP 404s & Validation Failures**: `ComponentSchemaViewer.tsx` uses `['default', 'traxus', 'cyberacme', 'sekiguchi', 'nucaloric']` while manifests on disk are `tileset_traxus_foundry.json`, `tileset_sekiguchi_biolabs.json`, and `tileset_dark_subnet.json`. Clicking any non-default theme 404s in `TilesetAtlasCache` and fails `validateThemeFile` (`ENOENT`). | **OPEN** |
| **`HIGH-01`** | **P1 (High)** | `@rendering` | **`SpriteComponent.desyncPhase` & `SpriteComponent.paused` Ignored / Misimplemented in `SpriteAnimator` (Spec §4.2, §5.2)**: `registerEntity()` accepts `desyncPhase` in its config signature but never stores or passes it to `stepAnimationClip()`. `paused: true` continues on the last rendered mid-cycle frame instead of locking to Frame 0 of the current state. `registerEntity()` sets `lastRenderedFrameKey = initialFrame` before updating `sprite.texture`, skipping initial frame overrides. | **RESOLVED** |
| **`HIGH-02`** | **P1 (High)** | `scripts/` / `assets/` | **Enemy `idle` Animations Flash Explosive `*_atk_1` Combat Frames & Lack `move` Clips (Spec §5.2, §6)**: All 6 enemies include `enemy_*_atk_1` (full-tile combat explosions/lasers) as Frame 2 of their `idle` loop, causing idle enemies to explode every 800ms and making `'attack'` / `'hit'` indistinguishable from `'idle'`. None of the 6 enemies define a `'move'` clip in `tileset.json#animations`. | **OPEN** |
| **`HIGH-03`** | **P1 (High)** | `scripts/` / `@game` | **Missing Prop States (`interact`, `locked`), Unmapped Template Keys, and Directional Prop Orientation Clobbering**: Zero props in `tileset.json#animations` define `'interact'`; lockers and biocabinets lack `'locked'` clips (Spec §6); base template keys (`prop_workstation_active`, `prop_locker_closed`, `prop_biocabinet_full`, `prop_vault_door*`) are absent from `animations`; and `prop-interaction.ts` overwrites directional keys (`_n/_e/_s/_w`) with non-directional base keys on unlock/search, snapping 3/4 perspective props back to North/base and cancelling `'interact'`. | **OPEN** |
| **`HIGH-04`** | **P1 (High)** | `@dev-tool` | **`SpritePicker.tsx` Filmstrip Active Frame Indicator (`#0 ●`) Frozen During Playback & Pause Loop Spins at 60 FPS (Spec §7.2)**: `activeFrameIndex` is a `useMemo` that does not depend on the `requestAnimationFrame` elapsed ref, leaving `#0 ●` permanently stuck on Frame 0 during live playback. Clicking `[⏸ PAUSE]` leaves the 60 FPS `requestAnimationFrame` loop running continuously. Custom `frameDurationsMs` are not shown in timing readouts. | **OPEN** |
| **`HIGH-05`** | **P1 (High)** | `@dev-tool` | **`EntityTemplateEditor.tsx` Renders Duplicate `SpritePicker` Instances & Destructively Mutates `overrides.sprite` on Load**: `normalizeTemplate()` deletes `overrides.sprite` and moves it to `components.sprite` even when `sprite` is inherited from `mixins: ["physical"]`, breaking `isOverride` tracking and the `RESET OVERRIDE` button. `EntityTemplateEditor` also mounts two simultaneous `SpritePicker` instances for the same entity. | **OPEN** |
| **`MED-01`** | **P2 (Medium)** | `@rendering` | **Event Listener Leaks & Missing Enemy VFX on Re-init in `RenderSystem`**: `RenderSystem.init()` subscribes to `ITEM_PICKED_UP`, `DUNGEON_GENERATED`, and `STATE_RECONCILED` without unsubscribing in `destroy()`. `AIState` entities populated via `init()`, `onDungeonGenerated()`, and `reconcileSprites()` miss `applyPersistentGlitch` and `attachNeonEmitter`. | **OPEN** |
| **`MED-02`** | **P2 (Medium)** | `scripts/` / `assets/` | **Missing `meta.themeId` & `meta.themeName` in Generated Themed Manifests**: `scripts/generate-themed-tilesets.cjs` clones `tileset.json` without setting `meta.themeId` or `meta.themeName`, causing `validateThemeFile('traxus_foundry')` to report `themeId: 'default'`. | **OPEN** |
| **`MED-03`** | **P2 (Medium)** | `@dev-tool` | **Unawaited `loadAtlas` Race Conditions, Unconditional 60 FPS Loop on Static Sprites in `ResolvedPreviewPanel`, and Missing Strategy B Rotation in `PrefabEditor`**: `InspectorSpritePreview` runs a 60 FPS rAF loop even when `isAnim === false` (violating Spec §7.2.1), never calls `loadAtlas('default')`, and fails to reset `activeState` on entity switch. `ComponentSchemaViewer` and `PrefabEditor` do not trigger a redraw when `loadAtlas` resolves, and `PrefabEditor` omits `angleDegrees` for Strategy B rotational props. | **OPEN** |
| **`MED-04`** | **P2 (Medium)** | `@game` / `@engine` | **Off-Screen AI Simulation Gating Freezes Cooldowns & Suppresses Ambient Patrol / Scavenge Behaviors (`1a507186`, `54871197`)**: Early return `if (!isAware && !isVisibleToPlayer) return;` in `AISystem.processEntity()` executes before cooldown decrements and prevents unaware off-screen `System-Admin` (`patrol_anchors`) and `Seed-Eater` (`scavenge_nearest_loot`) entities from executing ambient floor-wide behaviors. `DijkstraMap` SPFA queue lacks a `len === 0` guard. | **OPEN** |
| **`LOW-01`** | **P3 (Low)** | `@dev-tool` / `@shared` | **Server API Route Pulls `pixi.js` via `@rendering/sprite-map` Import**: `src/app/api/dev/gamedata/tileset-validator.ts` imports `resolveFallbackSpriteKey` from `@rendering/sprite-map` (which top-level imports `pixi.js`). | **OPEN** |

---

## 2. Deep-Dive Root Cause Analysis

### `CRIT-01` (P0 Critical): `loadThemedAssets()` Unload Logic Is 100% Unreachable Dead Code (VRAM Leak — Spec §3.4.2)

- **Location**: [`src/rendering/assets.ts:29-70`](../../src/rendering/assets.ts#L29-L70)
- **Spec Requirement**: [`docs/design/SPRITE-ANIMATIONS.md` §3.4.2](../design/SPRITE-ANIMATIONS.md#L166-L183) mandates that when switching themes in [`loadThemedAssets(themeId)`](../../src/rendering/assets.ts#L47-L70), the previously active non-default theme bundle (`tileset_${activeThemeId}`) must be unloaded via `Assets.unload(...)` to bound GPU VRAM to at most 2 active 512×512 RGBA8 textures (~2.0 MB).
- **Root Cause**:
  1. [`loadThemedAssets()`](../../src/rendering/assets.ts#L48) calls `await loadAssets()` on line 48 **before** inspecting `activeThemeId`.
  2. Inside [`loadAssets()`](../../src/rendering/assets.ts#L40), line 40 unconditionally executes `activeThemeId = 'default'`.
  3. Consequently, `if (activeThemeId !== 'default')` on [line 51](../../src/rendering/assets.ts#L51) and [line 63](../../src/rendering/assets.ts#L63) is **always `false`**. `Assets.unload()` is never called under any sequence of sector transitions.
  4. Additionally, [`THEME_MANIFEST_MAP`](../../src/rendering/assets.ts#L8-L16) maps `'cyberacme'`, `'nucaloric'`, and `'system'` to `'assets/tileset.json'` (the exact same URL as the base `'tileset'` asset). Registering a separate alias `'tileset_cyberacme'` pointing to `'assets/tileset.json'` and later calling `Assets.unload('tileset_cyberacme')` will unload the shared base `'assets/tileset.json'` texture resource in PixiJS `Assets` cache.

---

### `CRIT-02` (P0 Critical): Anti-Cheat Fog-of-War State Leak (`U1` Invariant Violation) & Stale Transient Clip Replay (Spec §1.1.4, §5.1.3, §5.4.1)

- **Locations**:
  - [`src/rendering/render-system.ts:597-677`](../../src/rendering/render-system.ts#L597-L677)
  - [`src/rendering/render-system.ts:868-901`](../../src/rendering/render-system.ts#L868-L901)
  - [`src/rendering/sprite-animator.ts:326-343`](../../src/rendering/sprite-animator.ts#L326-L343)
- **Spec Requirement**:
  - [`docs/design/SPRITE-ANIMATIONS.md` §1.1.4](../design/SPRITE-ANIMATIONS.md#L28-L32) & [§5.4.1](../design/SPRITE-ANIMATIONS.md#L384-L395): Explored-but-out-of-sight (`!currentFovSet.has(tileKey)`) props must freeze on Frame 0 of their **client-remembered state** (`rememberedProps`), never leaking unseen live server state changes through Fog-of-War.
  - [`docs/design/SPRITE-ANIMATIONS.md` §5.1.3](../design/SPRITE-ANIMATIONS.md#L334-L336): `SpriteAnimator.tick()` must skip advancing accumulators and texture swaps for off-screen / out-of-FOV entities (`!sprite.visible || !currentFovSet.has(posKey)`).
- **Root Cause**:
  1. **Live ECS State Leak in Fog-of-War**: In [`RenderSystem.update()`](../../src/rendering/render-system.ts#L885-L900), `ambientState` (`'searched' | 'locked' | 'corrupted' | 'idle'`) is computed directly from live ECS components (`world.getComponent(entityId, Prop)`, `SecurityLock`, `CorruptedNode`) on every frame regardless of whether `inFov` is true or false, and then calls `this.spriteAnimator.setState(entityId, ambientState)`. When `setState()` changes `record.currentState`, [`SpriteAnimator.setState()`](../../src/rendering/sprite-animator.ts#L287-L300) immediately calls `applySparseTexture()` with Frame 0 of the new state—even when the prop is in explored Fog-of-War!
  2. **Stale Transient Clip Replay**: In [`RenderSystem`](../../src/rendering/render-system.ts#L597-L677), event handlers (`handleEntityMoved`, `handleDamageDealt`, `handleEnemyTeleported`, `handlePropUpdated`) call `spriteAnimator.triggerState(...)` without checking whether the entity is currently in `currentFovSet`. And in [`SpriteAnimator.tick()`](../../src/rendering/sprite-animator.ts#L328-L340), when an entity is outside `fovSet`, `tick()` `continue`s without clearing `record.transientState`. When the player walks into FOV of that entity 50 turns later, the stale `'attack'`, `'move'`, or `'interact'` animation suddenly plays out.
  3. **Empty `fovSet` Bypass & Missing `sprite.visible` Check**: [`SpriteAnimator.tick()`](../../src/rendering/sprite-animator.ts#L328) checks `if (fovSet && fovSet.size > 0 && getPositionFn)`. If `fovSet` is empty (`fovSet.size === 0`, e.g., before the first FOV pass or during total blindness), the check evaluates to `false` and **all** entities on the floor are animated! Furthermore, `tick()` never checks `if (!record.sprite.visible) continue;`.

---

### `CRIT-03` (P0 Critical): `ComponentSchemaViewer`, `TilesetAtlasCache`, and `validateThemeFile` Theme ID Mismatch Causes 404s & Validation Failures

- **Locations**:
  - [`src/dev-tool/studio/editors/ComponentSchemaViewer.tsx:30`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx#L30)
  - [`src/dev-tool/studio/shared/tileset-atlas-cache.ts:60-65`](../../src/dev-tool/studio/shared/tileset-atlas-cache.ts#L60-L65)
  - [`src/app/api/dev/gamedata/tileset-validator.ts:194-202`](../../src/app/api/dev/gamedata/tileset-validator.ts#L194-L202)
- **Root Cause**:
  1. [`ComponentSchemaViewer.tsx`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx#L30) defines `const THEMES = ['default', 'traxus', 'cyberacme', 'sekiguchi', 'nucaloric'] as const;` (missing `dark_subnet` and using short corporate prefixes instead of the manifest filenames).
  2. [`TilesetAtlasCache.loadAtlas(themeId)`](../../src/dev-tool/studio/shared/tileset-atlas-cache.ts#L63-L64) fetches `/assets/tileset_${themeId}.json` for any `themeId !== 'default'`.
  3. [`validateThemeFile(themeId)`](../../src/app/api/dev/gamedata/tileset-validator.ts#L196-L200) checks `public/assets/tileset_${themeId}.json` (and fallback `public/assets/themes/${themeId}.json`, which does not exist).
  4. On disk in `public/assets/`, the actual themed manifests are `tileset_traxus_foundry.json`, `tileset_sekiguchi_biolabs.json`, and `tileset_dark_subnet.json` (while `cyberacme` and `nucaloric` use `tileset.json`).
  5. Clicking **any** non-default theme button (`traxus`, `cyberacme`, `sekiguchi`, `nucaloric`) in `ComponentSchemaViewer` causes `TilesetAtlasCache.loadAtlas` to fail with `HTTP 404` and `validateThemeFile` to return `valid: false` (`ENOENT`).

---

### `HIGH-01` (P1 High): `SpriteComponent.desyncPhase` & `SpriteComponent.paused` Ignored / Misimplemented in `SpriteAnimator` (Spec §4.2, §5.2)

- **Locations**:
  - [`src/rendering/sprite-animator.ts:16-35`](../../src/rendering/sprite-animator.ts#L16-L35)
  - [`src/rendering/sprite-animator.ts:216-265`](../../src/rendering/sprite-animator.ts#L216-L265)
  - [`src/rendering/sprite-animator.ts:320-390`](../../src/rendering/sprite-animator.ts#L320-L390)
- **Spec Requirement**:
  - [`docs/design/SPRITE-ANIMATIONS.md` §4.2](../design/SPRITE-ANIMATIONS.md#L279-L290): `SpriteComponent.desyncPhase` (`boolean`, default `true`) controls whether deterministic entity-ID phase offset (`(entityId * 2654435761) >>> 0`) is applied; `SpriteComponent.paused` (`boolean`, default `false`) *"locks the sprite to Frame 0 of its current state"*.
- **Root Cause**:
  1. [`SpriteAnimator.registerEntity()`](../../src/rendering/sprite-animator.ts#L219-L225) accepts `desyncPhase?: boolean` in `config`, **never reads or stores it** on `EntityAnimRuntimeState`, and [`tick()`](../../src/rendering/sprite-animator.ts#L384) passes `activeClip.desyncPhase ?? true` to `stepAnimationClip()`, completely ignoring `SpriteComponent.desyncPhase === false`.
  2. `EntityAnimRuntimeState.phaseOffsetMs` ([line 24](../../src/rendering/sprite-animator.ts#L24), [line 260](../../src/rendering/sprite-animator.ts#L260)) is initialized to `0` and never read anywhere.
  3. When `record.paused` is `true` (or set via `setPaused(entityId, true)`), [`tick()`](../../src/rendering/sprite-animator.ts#L324) simply `continue`s on whatever mid-cycle frame happened to be rendered last, instead of locking the sprite to Frame 0 of `record.currentState` (`activeClip?.frames[0] ?? record.baseSpriteKey`).
  4. In [`registerEntity()`](../../src/rendering/sprite-animator.ts#L248-L259), `lastRenderedFrameKey` is initialized to `initialFrame` (`clip?.frames[0] ?? baseSpriteKey`) **without** applying `initialFrame`'s texture to `sprite`. If `initialFrame !== baseSpriteKey` (e.g., when `animationSet` or `initialState` overrides the base key), `applySparseTexture` thinks `initialFrame` is already rendered and skips updating `sprite.texture`.

---

### `HIGH-02` (P1 High): Enemy `idle` Animations Flash Explosive `*_atk_1` Combat Frames & Lack `move` Clips (Spec §5.2, §6)

- **Locations**:
  - [`scripts/add-animation-frames.cjs:23-37`](../../scripts/add-animation-frames.cjs#L23-L37)
  - [`scripts/add-animation-frames.cjs:188-289`](../../scripts/add-animation-frames.cjs#L188-L289)
  - [`scripts/build-animation-frames.cjs:150-240`](../../scripts/build-animation-frames.cjs#L150-L240)
- **Spec Requirement**:
  - [`docs/design/SPRITE-ANIMATIONS.md` §6](../design/SPRITE-ANIMATIONS.md#L401-L413): Enemy `idle` loops should be subtle ambient telegraphs (chassis bob, visor scan, aura pulse, hover oscillation), while `attack` and `hit` are transient high-contrast combat bursts.
  - [`docs/design/SPRITE-ANIMATIONS.md` §5.2](../design/SPRITE-ANIMATIONS.md#L340-L353): `ENTITY_MOVED` and `ENEMY_TELEPORTED` trigger the `'move'` animation clip.
- **Root Cause**:
  1. In [`build-animation-frames.cjs`](../../scripts/build-animation-frames.cjs#L150-L240), `enemy_*_atk_1.png` was drawn as a full-tile explosive attack burst (e.g., 16×16 white/red blast for `enemy_buffer_overflow_atk_1`, 20×6 shrapnel hammer for `enemy_fragmenter_atk_1`, 4px laser beam for `enemy_null_pointer_atk_1`).
  2. However, [`add-animation-frames.cjs`](../../scripts/add-animation-frames.cjs#L188-L289) placed `enemy_*_atk_1` as Frame 2 of every enemy's `idle` loop (`frames: ['enemy_*', 'enemy_*_idle_1', 'enemy_*_atk_1']`). As a result, all enemies on screen continuously explode/fire weapons every 800ms while standing completely idle, making actual `'attack'` and `'hit'` events visually indistinguishable from `'idle'`.
  3. Furthermore, [`add-animation-frames.cjs`](../../scripts/add-animation-frames.cjs#L25-L37) registered `enemy_*_idle_2` frame aliases in `tileset.json#frames` that are never used in `animations`, and omitted `'move'` clips for all 6 enemies (so `triggerState(entityId, 'move')` is a no-op for every enemy).

---

### `HIGH-03` (P1 High): Missing Prop States (`interact`, `locked`), Unmapped Template Keys, and Directional Prop Orientation Clobbering

- **Locations**:
  - [`scripts/add-animation-frames.cjs:66-186`](../../scripts/add-animation-frames.cjs#L66-L186)
  - [`src/game/systems/prop-interaction.ts:174-250`](../../src/game/systems/prop-interaction.ts#L174-L250)
  - [`src/game/systems/prop-interaction.ts:770-785`](../../src/game/systems/prop-interaction.ts#L770-L785)
  - `src/game/templates/props/*.json`
- **Spec Requirement**:
  - [`docs/design/SPRITE-ANIMATIONS.md` §5.2](../design/SPRITE-ANIMATIONS.md#L340-L353): `PROP_INTERACTED` and `LOCK_UNLOCKED` trigger `'interact'` (1-shot transition clip), followed by `'searched'` or `'idle'`.
  - [`docs/design/SPRITE-ANIMATIONS.md` §6](../design/SPRITE-ANIMATIONS.md#L415-L433): `prop_safe_locked`, `prop_locker_n/e/s/w`, and `prop_biocabinet_n/e/s/w` must define `locked, idle, searched`.
- **Root Cause**:
  1. **Zero `'interact'` clips in `tileset.json#animations`**: Not a single prop in [`add-animation-frames.cjs`](../../scripts/add-animation-frames.cjs#L66-L186) defines an `'interact'` state clip, so `spriteAnimator.triggerState(entityId, 'interact')` on `PROP_INTERACTED` and `LOCK_UNLOCKED` is a 100% no-op across the entire game.
  2. **Missing `'locked'` clips on Lockers & Bio-Cabinets**: `prop_locker_n/e/s/w` and `prop_biocabinet_n/e/s/w` only define `idle` and `searched`, omitting `locked`.
  3. **Unmapped Base/Template Sprite Keys**:
     - Entity templates use `prop_workstation_active` ([`prop-workstation.json`](../../src/game/templates/props/prop-workstation.json#L25)), `prop_locker_closed` ([`prop-locker.json`](../../src/game/templates/props/prop-locker.json#L13)), `prop_biocabinet_full` ([`prop-biocabinet.json`](../../src/game/templates/props/prop-biocabinet.json#L13)), and `prop_vault_door_locked` / `vault_door_locked_n/e/s/w` ([`prop-vault-door.json`](../../src/game/templates/props/prop-vault-door.json#L19)).
     - None of `prop_workstation_active`, `prop_locker_closed`, `prop_locker`, `prop_biocabinet_full`, `prop_biocabinet`, `prop_safe`, `prop_vault_door_locked`, `prop_vault_door_n/e/s/w`, or `vault_door_locked_n/e/s/w` exist in `tileset.json#animations`.
     - As a result, opening `prop-workstation.json`, `prop-locker.json`, `prop-biocabinet.json`, or `prop-vault-door*.json` in Gamedata Studio shows `[Static Frame]` instead of `[⚡ ANIM]` unless `animationSet` is manually typed, and non-directional lockers/biocabinets/vault doors do not animate in-game. Even [`PrefabEditor.tsx`](../../src/dev-tool/studio/editors/PrefabEditor.tsx#L447) calls `resolveAnimatedFrameAtTime('prop_vault_door_n', 'idle', ...)`, which falls back to static because `prop_vault_door_n` has no entry in `animations`.
  4. **Directional Prop Orientation Clobbering on Unlock / Search**:
     - In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts#L772-L782) (unlocking a `SecurityLock` on lines 174–188 / 236–250 and searching a prop on lines 772–782), the system overwrites `SpriteComponent.key` with a hardcoded non-directional key (`'prop_workstation'`, `'prop_locker'`, `'prop_biocabinet'`, `'prop_vault_door'`).
     - If the prop was an East-, South-, or West-facing directional prop (`prop_workstation_e`, `prop_locker_s`, `prop_biocabinet_w`, `vault_door_locked_e`), overwriting `SpriteComponent.key` with the non-directional base key **destroys its 3/4 perspective directional orientation** (snapping it to North/base) AND triggers [`SpriteAnimator.updateBaseKey()`](../../src/rendering/sprite-animator.ts#L276-L285) which sets `record.transientState = null` (cancelling the `'interact'` animation just triggered).

---

### `HIGH-04` (P1 High): `SpritePicker.tsx` Filmstrip Active Frame Indicator (`#0 ●`) Never Updates During Playback & Pause Loop Runs at 60 FPS (Spec §7.2)

- **Locations**:
  - [`src/dev-tool/studio/shared/SpritePicker.tsx:96-180`](../../src/dev-tool/studio/shared/SpritePicker.tsx#L96-L180)
  - [`src/dev-tool/studio/shared/SpritePicker.tsx:475-479`](../../src/dev-tool/studio/shared/SpritePicker.tsx#L475-L479)
- **Spec Requirement**:
  - [`docs/design/SPRITE-ANIMATIONS.md` §7.2](../design/SPRITE-ANIMATIONS.md#L463-L505): The filmstrip scrubber must highlight the currently active frame (`#0 ●`) during live playback and allow scrubbing individual frames when paused, without burning 60 FPS `requestAnimationFrame` cycles when paused or static ([§7.2.1](../design/SPRITE-ANIMATIONS.md#L507-L511)).
- **Root Cause**:
  1. In [`SpritePicker.tsx`](../../src/dev-tool/studio/shared/SpritePicker.tsx#L166-L176), `activeFrameIndex` is computed inside a `useMemo` with dependency array `[activeClip, manualFrameIndex, value, currentState]`. During live playback, the `requestAnimationFrame` callback ([lines 111–137](../../src/dev-tool/studio/shared/SpritePicker.tsx#L111-L137)) only mutates `elapsedOffsetRef.current` (a React ref). Consequently, `activeFrameIndex` **never re-evaluates** during playback and the filmstrip indicator stays permanently frozen on `#0 ●`.
  2. When the user clicks `[⏸ PAUSE]` (`setIsPlaying(false)` while `manualFrameIndex === null`), the `useEffect` guard on [line 99](../../src/dev-tool/studio/shared/SpritePicker.tsx#L99) (`if (!isAnim || !activeClip || manualFrameIndex !== null)`) does **not** check `!isPlaying`. Instead, the `requestAnimationFrame` loop continues running at 60 FPS while paused.
  3. For clips using custom `frameDurationsMs` (e.g. `[550, 250]`), [`SpritePicker.tsx`](../../src/dev-tool/studio/shared/SpritePicker.tsx#L477) and [`ComponentSchemaViewer.tsx`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx#L164) display the fallback `fps` (`6 FPS (167ms/f)`) instead of the actual `frameDurationsMs` timing.

---

### `HIGH-05` (P1 High): `EntityTemplateEditor.tsx` Renders Duplicate `SpritePicker` Instances & Destructively Mutates `overrides.sprite` on Load

- **Locations**:
  - [`src/dev-tool/studio/editors/EntityTemplateEditor.tsx:88-106`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L88-L106)
  - [`src/dev-tool/studio/editors/EntityTemplateEditor.tsx:239`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L239)
  - [`src/dev-tool/studio/editors/EntityTemplateEditor.tsx:495-513`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L495-L513)
- **Root Cause**:
  1. [`normalizeTemplate()`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L88-L106) runs whenever a template is loaded into `EntityTemplateEditor`. Even when an entity inherits `sprite` from `mixins: ["physical"]` (as every enemy, item, and prop template does), `normalizeTemplate()` deletes `overrides.sprite` and moves it into `components.sprite`. This corrupts the mixin inheritance model, causes `isOverride` (`key in (template.overrides ?? {})`) to become `false` for `sprite`, hides the `MIXIN OVERRIDE` badge and `RESET OVERRIDE` button, and rewrites template JSON structure on save.
  2. [`EntityTemplateEditor.tsx`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L495-L513) renders a dedicated `SpritePicker` inside the 220px-wide top metadata grid while `ComponentFieldGroup` -> `FormField` ([line 239](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L239)) simultaneously renders a **second** `SpritePicker` inside the `sprite` component card below.

---

### `MED-01` (P2 Medium): Event Listener Leaks & Missing Enemy VFX on Re-init in `RenderSystem`

- **Locations**:
  - [`src/rendering/render-system.ts:678-699`](../../src/rendering/render-system.ts#L678-L699)
  - [`src/rendering/render-system.ts:1162-1178`](../../src/rendering/render-system.ts#L1162-L1178)
- **Root Cause**:
  1. [`RenderSystem.init()`](../../src/rendering/render-system.ts#L678-L699) subscribes to `ITEM_PICKED_UP` (`this.handleItemPickedUp`), `DUNGEON_GENERATED` (inline arrow function), and `STATE_RECONCILED` (inline arrow function), but [`RenderSystem.destroy()`](../../src/rendering/render-system.ts#L1162-L1178) never calls `eventBus.off(...)` for any of those three events, leaking closures and stale `RenderSystem` references across run restarts.
  2. When entities are created via `handleEntityCreated`, `AIState` entities receive `applyPersistentGlitch(entityId, sprite)` and `attachNeonEmitter(entityId, pos.x, pos.y, 0xff0055)`. However, when entities are populated during `init()`, `onDungeonGenerated()`, or `reconcileSprites()`, neither `applyPersistentGlitch` nor `attachNeonEmitter` is called.

---

### `MED-02` (P2 Medium): Missing `meta.themeId` & `meta.themeName` in Generated Themed Manifests

- **Location**: [`scripts/generate-themed-tilesets.cjs:866-869`](../../scripts/generate-themed-tilesets.cjs#L866-L869)
- **Spec Requirement**: [`docs/design/SPRITE-ANIMATIONS.md` §3.1](../design/SPRITE-ANIMATIONS.md#L73-L81) defines `meta.themeId` and `meta.themeName` in `TilesetMetaSchema`.
- **Root Cause**: [`generate-themed-tilesets.cjs`](../../scripts/generate-themed-tilesets.cjs#L866-L869) clones `public/assets/tileset.json` and updates `themedJson.meta.image = theme.filename`, but never sets `themedJson.meta.themeId = theme.id` or `themedJson.meta.themeName = theme.title`. Consequently, `validateThemeFile('traxus_foundry')` reports `themeId: 'default'` instead of `'traxus_foundry'`.

---

### `MED-03` (P2 Medium): Unawaited `loadAtlas` Race Conditions, Unconditional 60 FPS Loop on Static Sprites in `ResolvedPreviewPanel`, and Missing Strategy B Rotation in `PrefabEditor`

- **Locations**:
  - [`src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx:25-85`](../../src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx#L25-L85)
  - [`src/dev-tool/studio/editors/ComponentSchemaViewer.tsx:82-148`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx#L82-L148)
  - [`src/dev-tool/studio/editors/PrefabEditor.tsx:118-120`](../../src/dev-tool/studio/editors/PrefabEditor.tsx#L118-L120)
  - [`src/dev-tool/studio/editors/PrefabEditor.tsx:506-515`](../../src/dev-tool/studio/editors/PrefabEditor.tsx#L506-L515)
- **Root Cause**:
  1. In [`ResolvedPreviewPanel.tsx`](../../src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx#L39-L62), `InspectorSpritePreview` runs a 60 FPS `requestAnimationFrame` loop unconditionally even when `isAnim === false` (violating [Spec §7.2.1](../design/SPRITE-ANIMATIONS.md#L507-L511)), never calls `tilesetAtlasCache.loadAtlas('default')` on mount, and does not reset `activeState` when switching between entities if the new entity lacks the previously selected state.
  2. In [`ComponentSchemaViewer.tsx`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx#L250) and [`PrefabEditor.tsx`](../../src/dev-tool/studio/editors/PrefabEditor.tsx#L119), `tilesetAtlasCache.loadAtlas(...)` is invoked without `.then(() => ...)` triggering a state update, so `FrameCanvasPreview`, `AnimatedSpriteCard`, and `PrefabEditor` (when `animPreviewPlaying === false`) draw while the atlas image is still loading and remain blank until a manual interaction forces a re-render.
  3. In [`PrefabEditor.tsx`](../../src/dev-tool/studio/editors/PrefabEditor.tsx#L512), `tilesetAtlasCache.drawAtlasFrame(ctx, frame, px, py, tileSize)` omits the 6th argument `angleDegrees` for Strategy B rotationally symmetric props (`prop_turret`, `prop_spike_trap`, `prop_FloorSwitch`, `prop_caltrops`).

---

### `MED-04` (P2 Medium): Off-Screen AI Simulation Gating Freezes Cooldowns & Suppresses Ambient Patrol / Scavenge Behaviors

- **Locations**:
  - [`src/game/systems/ai.ts:367-393`](../../src/game/systems/ai.ts#L367-L393)
  - [`src/engine/ai/dijkstra-map.ts:50-95`](../../src/engine/ai/dijkstra-map.ts#L50-L95)
- **Root Cause**:
  1. Commit `1a507186` added an early return in [`AISystem.processEntity()`](../../src/game/systems/ai.ts#L377-L380): `if (!isAware && !isVisibleToPlayer) return;`.
  2. Because this `return` occurs **before** cooldown decrements ([lines 383–393](../../src/game/systems/ai.ts#L383-L393)) and behavior tree evaluation, any unaware off-screen enemy:
     - Never ticks down `cooldowns` while unaware and out of sight.
     - Never executes ambient floor behaviors designed to happen across the map before the player encounters them—specifically `scavenge_nearest_loot` (Seed-Eater moving toward and eating floor loot) and `patrol_anchors` (System-Admin patrolling between Stability Anchors).
  3. In [`dijkstra-map.ts`](../../src/engine/ai/dijkstra-map.ts#L60-L62) (commit `54871197`), `computeFleeMap` uses an SPFA circular queue with `queueCapacity = len * 2`. While `inQueue` guarantees at most `len` elements are queued simultaneously, guarding `if (len === 0) return;` at the top of `computeFromGoals` and `computeFleeMap` prevents division-by-zero (`% 0`) on empty 0×0 grids.

---

### `LOW-01` (P3 Low): Server API Route Pulls `pixi.js` via `@rendering/sprite-map` Import

- **Location**: [`src/app/api/dev/gamedata/tileset-validator.ts:4`](../../src/app/api/dev/gamedata/tileset-validator.ts#L4)
- **Root Cause**: `tileset-validator.ts` (used by Next.js server route `/api/dev/gamedata`) imports `resolveFallbackSpriteKey` from `@rendering/sprite-map`, which has a top-level `import { Assets, Texture } from 'pixi.js'`. Moving the pure string helper `resolveFallbackSpriteKey` to `@shared/tileset-types` (and re-exporting it from `@rendering/sprite-map`) keeps server API routes free of WebGL client dependencies.

---

## 3. Confirmed Design Determinations

1. **AI Off-Screen Simulation & Cooldown Recovery (`MED-04`) — CONFIRMED**:
   - Move cooldown timer decrements **above** the off-screen simulation gate so active cooldowns (`val > 0`) recover every turn without patching state on idle entities that have no active cooldowns.
   - Allow unaware off-screen enemies whose behavior trees include ambient floor-wide actions (`patrol_anchors` for System-Admin, `scavenge_nearest_loot` for Seed-Eater) to execute their behavior tree while keeping stationary unaware enemies (`basic`, `null-pointer`, `fragmenter`, `logic-leaker`, `buffer-overflow`) gated off-screen.
2. **Directional Prop Sprite Key Preservation (`HIGH-03`) — CONFIRMED**:
   - Preserve directional sprite keys (`prop_workstation_n/e/s/w`, `prop_locker_n/e/s/w`, `prop_biocabinet_n/e/s/w`, `prop_vault_door_n/e/s/w` / `vault_door_locked_n/e/s/w`) during `SecurityLock` unlock and `Container` search in [`src/game/systems/prop-interaction.ts`](../../src/game/systems/prop-interaction.ts) so `SpriteAnimator` drives `'locked'` → `'interact'` → `'idle'` / `'searched'` per orientation without snapping 3/4-perspective props back to North/base or cancelling the `'interact'` animation.

---

## 4. Phased Remediation Plan

### Phase 1: Fix `@rendering` Asset Unloading, Anti-Cheat FOV Isolation, & `SpriteAnimator` Compliance (`CRIT-01`, `CRIT-02`, `HIGH-01`, `MED-01`, `LOW-01`)
1. **[x] Fix `loadThemedAssets()` VRAM Unloading (`CRIT-01` — [`src/rendering/assets.ts`](../../src/rendering/assets.ts))**:
   - Capture `const previousThemeId = activeThemeId;` **before** calling `await loadAssets()`.
   - Distinguish themes that share `'assets/tileset.json'` (`'default'`, `'cyberacme'`, `'nucaloric'`, `'system'`) from dedicated atlas themes (`'traxus_foundry'`, `'sekiguchi_biolabs'`, `'dark_subnet'`, plus aliases `'traxus'` -> `'traxus_foundry'` and `'sekiguchi'` -> `'sekiguchi_biolabs'`).
   - Only register/load/unload separate PixiJS `Assets` bundles when the manifest path differs from `'assets/tileset.json'`, ensuring `Assets.unload('tileset_${previousThemeId}')` is properly executed on sector change without ever unloading the base `'tileset'` bundle.
2. **[x] Fix Anti-Cheat Fog-of-War State Leak & Stale Transient Clips (`CRIT-02` — [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts), [`src/rendering/sprite-animator.ts`](../../src/rendering/sprite-animator.ts))**:
   - In [`RenderSystem.update()`](../../src/rendering/render-system.ts#L885-L900):
     - Only compute `ambientState` from live ECS components (`Prop`, `SecurityLock`, `CorruptedNode`) when `inFov` is `true` (and record `ambientState` in `rememberedProps`).
     - When `!inFov` and `wasExplored`, pass the client-remembered `ambientState` from `rememberedProps` (and lock to Frame 0), never reading unseen live server state in Fog-of-War.
   - In [`RenderSystem`](../../src/rendering/render-system.ts#L597-L677) event handlers (`handleEntityMoved`, `handleDamageDealt`, `handleEnemyTeleported`, `handlePropUpdated`):
     - Only call `this.spriteAnimator.triggerState(...)` if the entity's position is currently inside `this.currentFovSet` (or is the player entity).
   - In [`SpriteAnimator.tick()`](../../src/rendering/sprite-animator.ts#L322-L343):
     - Check `if (!record.sprite.visible) { record.transientState = null; continue; }`.
     - Fix the FOV check from `if (fovSet && fovSet.size > 0 && getPositionFn)` to `if (fovSet && getPositionFn)` so an empty `fovSet` properly freezes non-visible entities, and clear any stale `record.transientState = null` when an entity leaves FOV.
3. **[x] Fix `desyncPhase`, `paused` Frame-0 Lock, and Initial Frame Application (`HIGH-01` — [`src/rendering/sprite-animator.ts`](../../src/rendering/sprite-animator.ts))**:
   - Store `desyncPhase: boolean` on `EntityAnimRuntimeState` (default `true` from `SpriteComponent.desyncPhase`) and update it in `RenderSystem.update()`.
   - Combine entity and clip flags in `tick()`: `const useDesync = record.desyncPhase && (activeClip.desyncPhase ?? true);`.
   - When `record.paused === true`, lock the sprite to Frame 0 of its current state (`const frame0 = activeClip?.frames[0] ?? record.baseSpriteKey; this.applySparseTexture(record, frame0); continue;`).
   - In `registerEntity()`, immediately apply `initialFrame` if `initialFrame !== config.baseSpriteKey` (or initialize `lastRenderedFrameKey = config.baseSpriteKey` so the first `tick()` / `applySparseTexture()` applies `initialFrame`).
4. **[ ] Fix Event Listener Cleanup & Enemy VFX Parity (`MED-01` — [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts))**:
   - Store bound handler references for `ITEM_PICKED_UP`, `DUNGEON_GENERATED`, and `STATE_RECONCILED` and unregister all three in `RenderSystem.destroy()`.
   - Ensure `AIState` entities initialized in `init()`, `onDungeonGenerated()`, and `reconcileSprites()` receive `applyPersistentGlitch` and `attachNeonEmitter`.
5. **[ ] Move `resolveFallbackSpriteKey` to `@shared/tileset-types` (`LOW-01`)**:
   - Export `resolveFallbackSpriteKey` from [`src/shared/tileset-types.ts`](../../src/shared/tileset-types.ts), re-export it from [`src/rendering/sprite-map.ts`](../../src/rendering/sprite-map.ts), and import it from `@shared/tileset-types` in [`src/app/api/dev/gamedata/tileset-validator.ts`](../../src/app/api/dev/gamedata/tileset-validator.ts).

### Phase 2: Fix Atlas Generation Scripts, Animation Catalog & Prop Orientation Preservation (`HIGH-02`, `HIGH-03`, `MED-02`)
1. **[ ] Fix Enemy `idle`, `move`, `attack`, `hit` Animation Clips (`HIGH-02` — [`scripts/build-animation-frames.cjs`](../../scripts/build-animation-frames.cjs), [`scripts/add-animation-frames.cjs`](../../scripts/add-animation-frames.cjs))**:
   - Remove explosive `enemy_*_atk_1` frames from all 6 enemies' `idle` loops so `idle` uses subtle ambient frames (`['enemy_*', 'enemy_*_idle_1']`), keeping `enemy_*_atk_1` exclusively for `'attack'` and `'hit'` transient clips.
   - Add `'move'` clips (`loop: false`) for all 6 enemies in `add-animation-frames.cjs`.
2. **[ ] Complete Prop Animation Catalog & Template Key Alignment (`HIGH-03` — [`scripts/add-animation-frames.cjs`](../../scripts/add-animation-frames.cjs), `src/game/templates/props/*.json`)**:
   - Add `'interact'` (`loop: false`) clips to all interactive props (`prop_chest`, `prop_workstation*`, `prop_locker*`, `prop_biocabinet*`, `prop_safe_locked`, `prop_vault_door*`, `prop_stability_anchor`, `prop_extraction_hatch_open`, `prop_keycard_terminal`, `prop_server_rack`, `prop_Switch*`, `prop_FloorSwitch`).
   - Add `'locked'` (`loop: true`) clips to `prop_locker_n/e/s/w` and `prop_biocabinet_n/e/s/w` per Spec §6.
   - Register animation definitions for base/template prop keys (`prop_workstation_active`, `prop_locker_closed`, `prop_locker`, `prop_biocabinet_full`, `prop_biocabinet`, `prop_safe`, `prop_vault_door_locked`, `prop_vault_door`, `prop_vault_door_n/e/s/w`, `vault_door_locked_n/e/s/w`) so both directional and base templates resolve animations in-game and in Gamedata Studio.
3. **[ ] Preserve Directional Prop Orientation on Unlock / Search (`HIGH-03` — [`src/game/systems/prop-interaction.ts`](../../src/game/systems/prop-interaction.ts))**:
   - Do not overwrite `SpriteComponent.key` when the prop already uses an animated directional or state-driven key (`prop_workstation_n/e/s/w`, `prop_locker_n/e/s/w`, `prop_biocabinet_n/e/s/w`, `prop_vault_door_n/e/s/w`, `vault_door_locked_n/e/s/w`), letting `SpriteAnimator` drive `'locked'` → `'interact'` → `'idle'` / `'searched'` per cardinal orientation without clobbering `SpriteComponent.key` or resetting `transientState`.
4. **[ ] Embed `meta.themeId` & `meta.themeName` in Themed Manifests (`MED-02` — [`scripts/generate-themed-tilesets.cjs`](../../scripts/generate-themed-tilesets.cjs))**:
   - Set `themedJson.meta.themeId = theme.id` and `themedJson.meta.themeName = theme.title` in `generate-themed-tilesets.cjs`, and regenerate `public/assets/tileset*.png` and `public/assets/tileset*.json`.

### Phase 3: Fix Gamedata Studio (`@dev-tool`) & Theme Validator (`CRIT-03`, `HIGH-04`, `HIGH-05`, `MED-03`)
1. **[ ] Unify Theme IDs Across `ComponentSchemaViewer`, `TilesetAtlasCache`, and `tileset-validator` (`CRIT-03`)**:
   - Define a shared theme manifest resolver mapping both canonical theme IDs (`default`, `traxus_foundry`, `sekiguchi_biolabs`, `dark_subnet`) and corporate shorthand aliases (`traxus`, `sekiguchi`, `cyberacme`, `nucaloric`, `system`) to their actual manifest files in `public/assets/`.
   - Update `THEMES` in [`src/dev-tool/studio/editors/ComponentSchemaViewer.tsx`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx#L30) so all themes load cleanly with 0 HTTP 404s and pass `validateThemeFile`.
2. **[ ] Fix `SpritePicker` Filmstrip Indicator, Pause Loop, and Custom Duration Display (`HIGH-04` — [`src/dev-tool/studio/shared/SpritePicker.tsx`](../../src/dev-tool/studio/shared/SpritePicker.tsx))**:
   - Track the currently rendered frame index in state (updating only when the frame index actually changes, ~2–12 times/sec) so the filmstrip `#i ●` indicator advances live during playback.
   - Stop the `requestAnimationFrame` loop when `isPlaying === false` (rendering a single static draw pass instead of spinning at 60 FPS).
   - Display actual `frameDurationsMs` timing in `SpritePicker` and `AnimatedSpriteCard` when custom per-frame durations are configured.
3. **[ ] Fix `EntityTemplateEditor` Duplicate `SpritePicker` & Mixin Override Preservation (`HIGH-05` — [`src/dev-tool/studio/editors/EntityTemplateEditor.tsx`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx))**:
   - Fix `normalizeTemplate()` in [`EntityTemplateEditor.tsx`](../../src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L88-L106) so it does not strip `overrides.sprite` when `sprite` is inherited from a mixin, preserving `isOverride` and `RESET OVERRIDE` behavior.
   - Remove the duplicate cramped `SpritePicker` from the top metadata grid so `sprite` is edited cleanly in one place via the component inspector.
4. **[ ] Fix `ResolvedPreviewPanel`, `ComponentSchemaViewer`, and `PrefabEditor` Canvas Lifecycle & Rotation (`MED-03`)**:
   - In [`src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx`](../../src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx): load the atlas on mount, reset `activeState` when `spriteKey` changes if the old state is unavailable, and only run a `requestAnimationFrame` loop when `isAnim === true` (single draw pass for static sprites).
   - In [`src/dev-tool/studio/editors/ComponentSchemaViewer.tsx`](../../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx) and [`src/dev-tool/studio/editors/PrefabEditor.tsx`](../../src/dev-tool/studio/editors/PrefabEditor.tsx): trigger a redraw state tick once `tilesetAtlasCache.loadAtlas(theme).then(...)` resolves, and pass `angleDegrees` (`ORIENTATION_DEGREES[prop.orientation]`) to `drawAtlasFrame` for Strategy B rotational props in `PrefabEditor`.

### Phase 4: Address Bundled AI Simulation Gating Edge Cases (`MED-04`)
1. **[ ] Preserve Cooldown Recovery & Ambient Patrol/Scavenge Behaviors (`MED-04` — [`src/game/systems/ai.ts`](../../src/game/systems/ai.ts), [`src/engine/ai/dijkstra-map.ts`](../../src/engine/ai/dijkstra-map.ts))**:
   - Move cooldown decrements above the unaware/off-screen early exit (patching `AIState.cooldowns` only when `cooldownsChanged === true`).
   - Check whether the entity's behavior tree contains ambient floor-wide actions (`patrol_anchors` or `scavenge_nearest_loot`) and allow those entities to evaluate their behavior tree off-screen while keeping stationary unaware enemies gated (`if (!isAware && !isVisibleToPlayer && !hasAmbientOffscreenBehavior) return;`).
   - Add `if (len === 0) return;` guard at the start of `DijkstraMap.computeFromGoals()` and `DijkstraMap.computeFleeMap()`.

### Phase 5: Comprehensive Regression & Verification Suite
1. **[ ] Add/Update Automated Unit & Integration Tests**:
   - `loadThemedAssets()` unloading previous theme bundle when switching between themed sectors ([`tests/rendering/animation-tileset.test.ts`](../../tests/rendering/animation-tileset.test.ts)).
   - Fog-of-War anti-cheat state isolation (`!inFov` props using `rememberedProps` state, out-of-FOV `triggerState` rejection, empty `fovSet` handling, `desyncPhase: false`, and `paused: true` locking to Frame 0 in [`tests/rendering/sprite-animator.test.ts`](../../tests/rendering/sprite-animator.test.ts) and [`tests/rendering/ingame-animation-loop.test.ts`](../../tests/rendering/ingame-animation-loop.test.ts)).
   - Directional prop unlock/search preserving `_n/_e/_s/_w` orientation and playing `'interact'` clip ([`src/game/systems/__tests__/prop-interaction.test.ts`](../../src/game/systems/__tests__/prop-interaction.test.ts)).
   - Unaware off-screen cooldown recovery and `patrol_anchors` / `scavenge_nearest_loot` execution ([`src/game/systems/__tests__/ai-simulation-gating.test.ts`](../../src/game/systems/__tests__/ai-simulation-gating.test.ts)).
   - `SpritePicker` live filmstrip `#i ●` indicator progression and pause rAF termination ([`src/dev-tool/studio/__tests__/sprite-picker-anim.test.tsx`](../../src/dev-tool/studio/__tests__/sprite-picker-anim.test.tsx)).
   - Theme validation across all theme IDs (`default`, `traxus_foundry`, `sekiguchi_biolabs`, `dark_subnet`, and aliases).
2. **[ ] Full Project Verification**:
   - Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` to verify zero regressions.
