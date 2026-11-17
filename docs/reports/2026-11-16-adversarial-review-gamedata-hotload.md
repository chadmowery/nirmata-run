# Adversarial Review Report: Gamedata Studio Real-Time Hotload & Live Sync System (`GAMEDATA-HOTLOAD-SPEC.md`)

- **Date**: 2026-11-16
- **Branch Reviewed**: `feature/gamedata-hotload` (`701b6774`) against `main` (`f6a14d52`)
- **Target Specification**: [`docs/design/GAMEDATA-HOTLOAD-SPEC.md`](../design/GAMEDATA-HOTLOAD-SPEC.md)
- **Architectural Rulebooks**: [`AGENTS.md`](../../AGENTS.md), [`src/engine/AGENTS.md`](../../src/engine/AGENTS.md), [`src/shared/AGENTS.md`](../../src/shared/AGENTS.md), [`src/rendering/AGENTS.md`](../../src/rendering/AGENTS.md), [`src/client/AGENTS.md`](../../src/client/AGENTS.md), [`src/server/AGENTS.md`](../../src/server/AGENTS.md), [`src/dev-tool/AGENTS.md`](../../src/dev-tool/AGENTS.md)
- **Overall Verdict**: **CHANGES REQUIRED (2 Critical Blockers, 5 High Architectural/Spec Violations, 6 Medium Spec Gaps, 1 Low Issue)**

---

## 1. Executive Summary

The `feature/gamedata-hotload` branch delivers a substantial portion of the **Gamedata Studio Real-Time Hotload & Live Sync System** (`HOTLOAD-01` through `HOTLOAD-06`), including the `BroadcastChannel` + SSE transport pipeline, `lighting.json` and `fov.json` system configs with dynamic WebGL shader uniform binding, Web Audio `ActiveVoice.updatePatch()` synth morphing, `HotloadWorldReconciler` server/client entity patching, and `DevTerminal` commands (`/shell`, `/theme`, `/condition`, `/spawn`, `/hotload`).

However, an adversarial audit against [`GAMEDATA-HOTLOAD-SPEC.md`](../design/GAMEDATA-HOTLOAD-SPEC.md) and the layer rulebooks uncovered **14 findings** that must be remediated before merging:
1. **Two Critical Blockers**:
   - `regenerateTemplateIndex()` in `src/app/api/dev/gamedata/utils.ts` emits an obsolete `registerBaseTemplates` signature and omits `registerGameTemplates`, `getDefaultEntityRegistry`, and `getTemplateSpriteKey`. Any entity/mixin/prefab creation or deletion overwrites `src/game/entities/index.ts` and breaks compilation across the codebase.
   - `hotReloadThemeAssets()` in `src/rendering/assets.ts` destroys the previous PixiJS `Spritesheet` and GPU texture sources *before* async companion texture loads complete and before sprites/tilemaps rebind their textures, exposing live WebGL frames to destroyed texture sources and failing to invalidate `SpriteAnimator` frame caches.
2. **Five High-Severity Architectural & Spec Violations**:
   - Direct ECS `World` mutations (`world.patchComponent` / `world.addComponent`) inside `RenderSystem.applyHotloadPreview()`, violating `src/rendering/AGENTS.md` §2.1 Simulation Decoupling, plus broken mixin preview matching and un-reverted `LightSource` additions.
   - Missing server in-memory registry refresh for `ai-trees/[treeId]` (which lacks a `PUT` route entirely), `spawn-tables`, `loot-distribution`, `depth-config`, and `prefabs` (`Spec §7.1`).
   - Shallow-merge retention of deleted optional fields via `world.patchComponent()`, missing Zod `.default(...)` parsing during hotload reconciliation, and loss of runtime `SecurityLock.faradayBounds` and `AbilityDef.isLegacy` / `AugmentData.isLegacy` flags.
   - Player Shell hotload (`applyShellTemplateToPlayer`) ignoring profile upgrades (`applyShellUpgradesToRecord`), omitting `Heat.baseDissipation` updates, and resetting player facing direction to `defaultDirection` instead of preserving current facing direction (`Spec §4.1.2`, `§7.3.1`).
   - Dual-transport (`BroadcastChannel` + SSE) `COMMIT` envelope ID mismatch (`studio-...` vs `srv-...`) and dropped `sessionPatches` on the client `BroadcastChannel` fast path.

---

## 2. Scope & Methodology

### 2.1 Commits Audited (`main...HEAD`)
| Commit | Summary |
| :--- | :--- |
| `701b6774` | `docs(hotload): update tracking/spec and move shared hotload types to @shared` |
| `baf20951` | `feat(hotload): implement HOTLOAD-06 live ECS/session reconciliation, shell switching, and DevTerminal commands` |
| `892f30a1` | `feat(hotload): implement HOTLOAD-05 live audio cue morphing, sample eviction, and AudioCueStudio live sync` |
| `4ebce56e` | `feat(hotload): implement HOTLOAD-04 lighting/fov configs, dynamic FOW shader uniforms, live light/sprite scrub, and env overrides` |
| `f4c741f2` | `feat(hotload): implement HOTLOAD-03 sprite/animation clip authoring and GPU atlas texture hot-reload` |
| `260e9582` | `feat(hotload): implement HOTLOAD-01 transport bus/SSE & HOTLOAD-02 HMR isolation and dev session auto-resume` |

### 2.2 Baseline Verification Results
- **Typecheck (`npm run typecheck`)**: Passed (`tsc --noEmit` exited 0)
- **Lint (`npm run lint`)**: Passed (`eslint src/` exited 0)
- **Test Suite (`npm test -- --run`)**: Passed (256 test files, 1,712 tests passed)
- **Working Tree State (`git status`)**: 1 unstaged modification (`next-env.d.ts`)

---

## 3. Detailed Findings by Severity

### Critical / Blocker

#### [CRIT-01] `regenerateTemplateIndex()` Emits Obsolete `registerBaseTemplates` and Wipes Out Required Exports in `src/game/entities/index.ts` — **[RESOLVED]**
- **Location**: [`src/app/api/dev/gamedata/utils.ts:81-122`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/dev/gamedata/utils.ts#L81-L122), [`src/game/entities/index.ts:98-245`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/entities/index.ts#L98-L245)
- **Vulnerability / Gap**:
  In `HOTLOAD-02`, `writeIfChanged()` was added to `regenerateTemplateIndex()` to prevent unnecessary barrel file writes. However, `regenerateTemplateIndex()` generates:
  ```ts
  export function registerBaseTemplates(registry: EntityRegistry): void {
  ```
  and completely omits `export function registerGameTemplates`, `export function getDefaultEntityRegistry`, and `export function getTemplateSpriteKey`—which are present in the committed [`src/game/entities/index.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/entities/index.ts#L98-L245) and imported by `server-engine-factory.ts`, `setup.ts`, `action-pipeline.ts`, and `PrefabEditor.tsx`.
- **Impact / Risk**:
  Because `existing !== nextContent`, the very first `POST` or `DELETE` request to `/api/dev/gamedata/entities`, `/api/dev/gamedata/mixins`, or `/api/dev/gamedata/prefabs` overwrites `src/game/entities/index.ts`, immediately breaking compilation and crashing `next dev`.
- **Required Fix**:
  Update `regenerateTemplateIndex()` in `src/app/api/dev/gamedata/utils.ts` so its generated TypeScript output matches the canonical exports of `src/game/entities/index.ts` (`registerGameTemplates`, `getDefaultEntityRegistry`, `getTemplateSpriteKey`, and all template/mixin registrations). Add a unit test verifying that `regenerateTemplateIndex()` produces content identical to `src/game/entities/index.ts` when no templates are added or removed.

#### [CRIT-02] `hotReloadThemeAssets()` Destroys Active `Spritesheet` Textures Before Rebinding Sprites and Across Async `await` Gaps — **[RESOLVED]**
- **Location**: [`src/rendering/assets.ts:248-323`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/rendering/assets.ts#L248-L323), [`src/rendering/sprite-animator.ts:191-226`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/rendering/sprite-animator.ts#L191-L226)
- **Vulnerability / Gap**:
  1. In `hotReloadThemeAssets()`, `prevAsset.destroy(true)` is called at line 290 *before* the asynchronous loop `for (const suffix of ['_n', '_m']) { await loadUnpremultipliedCompanionTexture(...) }` (lines 297–316) and *before* `refreshEntitySpriteTextures()` (line 319) or `invalidateTilemap()`. While those network/bitmap promises are pending, PixiJS ticker frames continue executing with live entity `Sprite`s and tilemap `spritePool` sprites pointing to destroyed GPU `TextureSource` instances.
  2. When `refreshEntitySpriteTextures()` runs, it sets each entity sprite to its base key texture, but `hotReloadThemeAssets()` never resets `lastRenderedFrameKey = ''` on `spriteAnimator` (or updates `spriteAnimator`'s manifest animations from the newly fetched `manifestJson`).
  3. In [`src/dev-tool/terminal/DevTerminal.tsx:498-502`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/terminal/DevTerminal.tsx#L498-L502), `/hotload reload-assets` only reloads `getActiveThemeId()`. When on a dedicated faction floor (e.g. `traxus_foundry`), base `default` (`tileset.png`)—which holds all player, enemy, and item sprites—is not reloaded.
- **Impact / Risk**:
  WebGL texture binding errors or black/missing sprites during and after atlas hot-reload.
- **Required Fix**:
  Fetch and build all new diffuse and companion textures *first*, then synchronously swap `Assets.cache`, clear companion caches, refresh entity sprite textures, invalidate `spriteAnimator` frame keys (`hotUpdateAnimations`), and **only then** call `.destroy(true)` on `prevAsset` and superseded `prevTex` instances. In `/hotload reload-assets`, reload `'default'` as well when `activeThemeId !== 'default'`.

---

### High / Architectural Violation

#### [HIGH-01] `RenderSystem.applyHotloadPreview()` Directly Mutates ECS `World` (`src/rendering/AGENTS.md` §2.1 Violation) & Fails on Mixin Previews and `LightSource` Revert — **[RESOLVED]**
- **Location**: [`src/rendering/render-system.ts:2021-2095`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/rendering/render-system.ts#L2021-L2095), [`src/dev-tool/hotload/client-hotload-bridge.ts:383-390`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/hotload/client-hotload-bridge.ts#L383-L390)
- **Vulnerability / Gap**:
  1. **Layer Rulebook Violation**: [`src/rendering/AGENTS.md`](../../src/rendering/AGENTS.md) §2.1 strictly mandates: *"The renderer is purely a visual subscriber. It reads components from `World` and `Grid` and listens to `EventBus` signals. Never mutate game state..."* Yet `RenderSystem.applyHotloadPreview()` directly calls `world.patchComponent()` and `world.addComponent()` on `Shell`, `SpriteComponent`, and `LightSource`.
  2. **Broken Mixin Preview Matching**: Lines 2076–2079 evaluate:
     ```ts
     const matches =
       domain === 'entity'
         ? tplId.id === targetId
         : tplId.id === targetId;
     ```
     Both branches of the ternary are identical (`tplId.id === targetId`). Because an entity's `TemplateId.id` is the entity template name (e.g. `'null-pointer'`) and never a mixin name (e.g. `'combatant'`), `domain === 'mixin'` previews never match any entity in the world.
  3. **Stuck `LightSource` on Revert**: If a developer attaches a `LightSource` in `ShellEditor` or `EntityTemplateEditor` with `LIVE_SYNC` enabled (`PREVIEW` adds `LightSource` to the entity) and then clicks `↺ REVERT` (where `baselinePayload` has `lightSource: undefined`), `applyHotloadPreview()` only checks `if (nextLight)` and never removes `LightSource` when `nextLight` is `undefined`.
- **Impact / Risk**:
  Violates rendering read-only architecture, breaks live mixin scrubbing, and leaves orphaned `LightSource` components on entities after `REVERT`.
- **Required Fix**:
  Move the `PREVIEW` / `REVERT` ECS component patching into `ClientHotloadBridge` (in `@dev-tool/hotload`), remove `LightSource` when `nextLight` is absent during `PREVIEW`/`REVERT`, support mixin-to-entity template resolution, and keep `RenderSystem` strictly read-only on `World`.

#### [HIGH-02] Missing Live Server In-Memory Registry Refresh for AI Behavior Trees, Spawn Tables, Loot Distribution, Depth Config, and Prefabs (Spec §7.1 Violation) — **[RESOLVED]**
- **Location**: [`src/app/api/dev/gamedata/ai-trees/[treeId]/route.ts:1-24`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/dev/gamedata/ai-trees/%5BtreeId%5D/route.ts#L1-L24), [`src/app/api/dev/gamedata/spawn-tables/[name]/route.ts:27-53`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/dev/gamedata/spawn-tables/%5Bname%5D/route.ts#L27-L53), [`src/app/api/dev/gamedata/prefabs/[name]/route.ts:28-62`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/dev/gamedata/prefabs/%5Bname%5D/route.ts#L28-L62), [`src/app/api/dev/gamedata/configs/[name]/route.ts:172-212`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/dev/gamedata/configs/%5Bname%5D/route.ts#L172-L212), [`src/game/generation/entity-placement.ts:8-10`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L8-L10), [`src/game/generation/dungeon-generator.ts:6`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L6), [`src/game/generation/prefabs/index.ts:10-15`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/prefabs/index.ts#L10-L15)
- **Vulnerability / Gap**:
  Spec §7.1.2 mandates:
  - *"Saving `spawn-tables`, `loot-distribution`, `depth-config`, or `prefabs` updates their in-memory server registries so the next floor descent (`/descend` or staircase/anchor) uses the new procgen tables without restarting `next dev`."*
  - *"Saving an AI Behavior Tree (`ai-trees/[treeId]`) updates `tree-registry.ts` in memory on the server so `AISystem` evaluates the new behavior tree on the very next enemy turn!"*
  Currently:
  1. `/api/dev/gamedata/ai-trees/[treeId]/route.ts` only implements `GET`. There is no `PUT` endpoint to save an AI Behavior Tree or update `AIBehaviorRegistry.registerTree()` in memory.
  2. `entity-placement.ts` (`depthDistribution`, `lootDistribution`), `dungeon-generator.ts` (`depthConfig`), and `prefabs/index.ts` (`ALL_PREFABS`) use static JSON imports with no runtime update functions; saving those files in Studio writes to disk and publishes a bus event, but the server's in-memory procgen tables remain stale.
  3. `POST /api/dev/gamedata/entities` and `POST /api/dev/gamedata/mixins` do not upsert newly created templates into active `session.entityRegistry` instances or `getDefaultEntityRegistry()` (`src/game/entities/index.ts`), so `/spawn <newTemplate>` fails for newly created templates.
- **Impact / Risk**:
  Edits to procgen tables, prefabs, newly created entity templates, and shared AI behavior trees do not take effect in active server sessions without a server restart.
- **Required Fix**:
  1. Add `PUT` handler to `/api/dev/gamedata/ai-trees/[treeId]/route.ts` validating `BehaviorTreeNodeSchema`, writing to `src/game/entities/templates/ai/*.json`, calling `AIBehaviorRegistry.registerTree(treeId, root)`, and publishing `aiTree` to `hotloadBus`.
  2. Expose runtime setters for `depthConfig`, `lootDistribution`, `depthDistribution` (`spawn-tables`), and `ALL_PREFABS` (`upsertPrefab` / `removePrefab`), and invoke them from the respective gamedata API routes.
  3. Upsert templates into `getDefaultEntityRegistry()` and all active session `entityRegistry` instances on both `POST` and `PUT` in `/api/dev/gamedata/entities` and `/api/dev/gamedata/mixins`.

#### [HIGH-03] `World.patchComponent()` Shallow Merge Retains Deleted Optional Fields, Skips Zod Defaults, and Drops `SecurityLock.faradayBounds` / `isLegacy` — **[RESOLVED]**
- **Location**: [`src/server/dev/hotload-reconciler.ts:150-216`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/server/dev/hotload-reconciler.ts#L150-L216), [`src/dev-tool/hotload/client-hotload-bridge.ts:399-410`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/hotload/client-hotload-bridge.ts#L399-L410)
- **Vulnerability / Gap**:
  1. Both `reconcileEntityInSession()` (server) and `ClientHotloadBridge.applySessionPatch()` (client) call `world.patchComponent(entityId, def, merged)`. Because `patchComponent` computes `{ ...existing, ...patch }`, any optional property removed in Gamedata Studio (such as clearing `shell.directionalSprites`—where `undefined` values are stripped by `JSON.stringify` over SSE/HTTP—or deleting `sprite.animationSet`, `sprite.initialState`, `audioProfile.attackCue`, `aiState.inlineTree`) is never cleared from the live entity.
  2. `reconcileEntityInSession()` does not run `def.schema.safeParse(merged)` before updating the component in `world`, so newly attached components lack Zod `.default(...)` values (`SpriteComponent.speedMultiplier = 1`, `LightSource.enabled = true`, etc.).
  3. Component removal in `reconcileEntityInSession()` (line 209) only checks `[...PRESENTATION_KEYS, 'blocksMovement']`. Removing `securityLock`, `corruptedNode`, `interactiveSurface`, `fovAwareness`, `packMember`, `defense`, or `heat` from a template does not remove the component from live entities.
  4. `reconcileEntityInSession()` only preserves `securityLock.isLocked` and overwrites `securityLock.faradayBounds` (attached at floor generation time to vault doors in `entity-placement.ts:451`), and overwrites runtime `isLegacy` on `abilityDef` and `augmentData`.
- **Impact / Risk**:
  Cleared optional fields remain stuck on live entities, missing Zod defaults can cause undefined runtime reads, and hotloading `prop-vault-door` breaks vault Faraday unshielding.
- **Required Fix**:
  Parse `merged` through `def.schema.safeParse(merged)` in `reconcileEntityInSession()`, use `world.addComponent(entityId, def, parsedData)` (full component replacement after merging preserved runtime fields) in both `reconcileEntityInSession()` and `ClientHotloadBridge.applySessionPatch()`, preserve `securityLock.faradayBounds` and `isLegacy`, and expand removable template components to include all non-identity/non-runtime-tag components.

#### [HIGH-04] Player Shell Reconciliation Ignores Profile Upgrades, `Heat.baseDissipation`, and Current Facing Direction (Spec §4.1.2 & §7.3.1 Violation) — **[RESOLVED]**
- **Location**: [`src/server/dev/hotload-reconciler.ts:305-410`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/server/dev/hotload-reconciler.ts#L305-L410)
- **Vulnerability / Gap**:
  1. Spec §7.3.1 specifies: *"Recomputes effective stats and port capacities (`applyShellUpgradesToRecord`). Patches the player entity's `Shell`, `Health` (preserving damage taken), `Defense`, `Energy`, `PortConfig`, `Heat`, `SpriteComponent` (resolved for current facing direction), and `LightSource`."*
  2. `applyShellTemplateToPlayer()` currently uses raw `shellTemplate.baseStats` and `shellTemplate.basePorts` without applying upgrades, and never updates `Heat` (`baseDissipation: 5 + currentStats.stability * 0.1`).
  3. Line 378 calls `resolveShellSpawnSprite(shellTemplate)`, which always resolves `defaultDirection` (`'south'`) instead of deriving the player's current facing direction from the player's active `SpriteComponent.key` / `Shell.directionalSprites`.
- **Impact / Risk**:
  Saving a Shell in Studio wipes out the player's active Shell upgrade bonuses, leaves `Heat.baseDissipation` desynchronized from `stability`, and snaps the player's directional sprite back to south-facing.
- **Required Fix**:
  Preserve the player's current cardinal facing direction (by matching existing `SpriteComponent.key` against the previous `Shell.directionalSprites` or suffix `-north`/`-east`/`-south`/`-west`), apply profile/record upgrades via `applyShellUpgradesToRecord` when available, and patch `Heat.baseDissipation`.

#### [HIGH-05] Dual-Transport (`BroadcastChannel` + SSE) `COMMIT` Envelopes Use Mismatched IDs and Omit `sessionPatches` on `BroadcastChannel` — **[RESOLVED]**
- **Location**: [`src/dev-tool/hotload/studio-sync.ts:89-100`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/hotload/studio-sync.ts#L89-L100), [`src/dev-tool/studio/editors/EntityTemplateEditor.tsx:248-270`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L248-L270), [`src/dev-tool/studio/editors/ShellEditor.tsx:134-150`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/ShellEditor.tsx#L134-L150), [`src/dev-tool/hotload/client-hotload-bridge.ts:178-198`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/hotload/client-hotload-bridge.ts#L178-L198)
- **Vulnerability / Gap**:
  1. On `Cmd+S` save, server routes call `hotloadBus.publishCommit(...)` (generating `id: "srv-<ts>-<seq>"` with `sessionPatches`) and return `{ success: true, sessionPatches }`. However, `EntityTemplateEditor.tsx` and `ShellEditor.tsx` discard the HTTP response body and call `postHotloadCommit(domain, name, payload)` without `sessionPatches`, generating a second envelope with `id: "studio-<ts>-<seq>"`.
  2. Because the IDs differ (`studio-...` vs `srv-...`), `ClientHotloadBridge.markSeen()` does not deduplicate them: every `COMMIT` runs twice, and the `BroadcastChannel` fast-path message carries no `sessionPatches` (doing nothing for `entity`/`mixin`/`shell` commits while still firing a toast).
  3. In `ClientHotloadBridge.handleSwitchShellRequest()` (lines 188–194), `this.applySessionPatch(ctx, data.patch)` is called on the HTTP response *and* called a second time when the SSE `COMMIT` event arrives from `/api/dev/hotload/switch-shell`.
- **Impact / Risk**:
  Duplicate hotload execution, duplicate telemetry timeline entries, and broken `BroadcastChannel` commit fast path for ECS entities and shells when SSE is slow or disconnected.
- **Required Fix**:
  Return the published `envelope` (or `{ success: true, sessionPatches, envelope }`) from the API routes and forward `sessionPatches` (and server `envelope.id` if present) into `postHotloadCommit()` so `BroadcastChannel` and SSE share the exact same envelope ID and `sessionPatches`.

---

### Medium / Spec Gap

#### [MED-01] `MixinEditor` Lacks `LIVE_SYNC` Preview, `Cmd+S` Save Shortcut, and `REVERT` Support (Spec §2.2, §4.1, §5.1 Violation) — **[RESOLVED]**
- **Location**: [`src/dev-tool/studio/editors/MixinEditor.tsx:1-240`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/MixinEditor.tsx#L1-L240)
- **Vulnerability / Gap**:
  `MixinEditor.tsx` was not updated with hotload hooks: it has no `gamedata-save` (`Cmd+S`) event listener, no `gamedata-revert` (`[ ↺ REVERT ]`) listener, no `baselineRef`, no `setActiveEffectiveData` inspector sync, and does not call `postHotloadPreview`, `postHotloadCommit`, or `postHotloadRevert`.
- **Required Fix**:
  Add `baselineRef`, `gamedata-save`, `gamedata-revert`, `setActiveEffectiveData`, and `postHotloadPreview` / `postHotloadCommit` / `postHotloadRevert` to `MixinEditor.tsx`.

#### [MED-02] Unsaved Item Switch While `LIVE_SYNC` is Active Does Not Broadcast `REVERT` (Spec §2.2.4 Violation) — **[RESOLVED]**
- **Location**: [`src/dev-tool/studio/editors/EntityTemplateEditor.tsx:210-221`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/EntityTemplateEditor.tsx#L210-L221), [`src/dev-tool/studio/editors/ShellEditor.tsx:65-75`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/ShellEditor.tsx#L65-L75), [`src/dev-tool/studio/editors/AudioCueStudio.tsx:136-147`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/AudioCueStudio.tsx#L136-L147), [`src/dev-tool/studio/editors/ConfigEditor.tsx:124-137`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/ConfigEditor.tsx#L124-L137)
- **Vulnerability / Gap**:
  Spec §2.2.4 requires that navigating away from a dirty item while `LIVE_SYNC` was active broadcasts `mode: 'REVERT'` with `baselinePayload` to restore the running game to its committed disk state. Currently, unmounting a dirty editor (by selecting another item in the sidebar) does not emit `postHotloadRevert()`, leaving uncommitted preview changes active in the game and leaving the `● LIVE SYNC ACTIVE` toast pill stuck on screen.
- **Required Fix**:
  Track whether a live preview was sent for the current item, and on editor unmount (if still dirty/uncommitted), automatically dispatch `postHotloadRevert()` with `baselineRef.current`.

#### [MED-03] `AudioEngine.hotUpdateCue()` Ignores `cue.baseVolume` on Active Ambiance & `playAmbianceCue()` Ignores Volume Updates on Same `cueId` (Spec §6.1 & §6.2 Violation)
- **Location**: [`src/engine/audio/audio-engine.ts:595-658`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/audio/audio-engine.ts#L595-L658), [`src/engine/audio/audio-engine.ts:918-930`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/audio/audio-engine.ts#L918-L930)
- **Vulnerability / Gap**:
  1. In `AudioEngine.hotUpdateCue()` (line 600), `const targetVol = this.ambianceState.baseVolume ?? cue.baseVolume ?? 0.6;` always evaluates to `this.ambianceState.baseVolume` when a floor drone is playing, ignoring `cue.baseVolume` changes made in `AudioCueStudio`.
  2. In `AudioEngine.playAmbianceCue()` (lines 924–929), if `this.currentAmbianceCueId === cue.id`, the method returns early without updating the playing voice's volume when `options?.volumeMultiplier` (from `ambiance.json` `depthBands[i].baseVolume`) is modified in `ConfigEditor`.
  3. In `hotUpdateCue()` (lines 631–656), if a voice in `activeCueVoices` changes `bus` or switches from `synth` to `sample`, `updatePatch` either ignores the bus change or stops the synth voice while leaving the dead `ActiveVoice` reference in `activeCueVoices` and `activeVoiceMap`.
- **Required Fix**:
  In `hotUpdateCue()`, apply `cue.baseVolume` when morphing the active cue; in `playAmbianceCue()`, update the active ambiance voice/sample gain when `options?.volumeMultiplier` changes even if `currentAmbianceCueId === cue.id`; and clean up `activeCueVoices` / `activeVoiceMap` when a voice is stopped and not replaced by a synth loop.

#### [MED-04] Environment Override Desyncs in Audio Ambiance, `DevTerminal`, Studio Header, and `DARK_SUBNET` Beacon Interval (Spec §5.2, §5.4 Violation)
- **Location**: [`src/dev-tool/hotload/client-hotload-bridge.ts:331-346`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/hotload/client-hotload-bridge.ts#L331-L346), [`src/game/audio/game-audio-system.ts:595-626`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/audio/game-audio-system.ts#L595-L626), [`src/dev-tool/terminal/DevTerminal.tsx:390-470`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/terminal/DevTerminal.tsx#L390-L470), [`src/dev-tool/studio/GamedataTool.tsx:267-404`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/GamedataTool.tsx#L267-L404), [`src/rendering/render-system.ts:1517-1520`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/rendering/render-system.ts#L1517-L1520), [`src/app/page.tsx:284`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/page.tsx#L284)
- **Vulnerability / Gap**:
  1. When `EnvironmentOverrideBar` emits `env:override` with `sectorCondition`, `ClientHotloadBridge` calls `audioSys.updateAmbianceForFloor(floorNum)`, which queries `FloorState.sectorCondition` from `world` (still `'NOMINAL'`) rather than using the override condition.
  2. In `DevTerminal.tsx`, `/theme <x>` and `/condition <x>` mutate `FloorState` on the server session, so running `/theme reset` or `/condition reset` afterwards clears the client override only to fall back to the mutated `FloorState`. Additionally, `DevTerminal.tsx:459` and `src/app/page.tsx:284` hardcode `updateAmbianceForFloor(1)` instead of reading `FloorState.currentFloor`.
  3. Spec §5.4.1 requires `EnvironmentOverrideBar` to be accessible in the Studio header as well as inside `lighting`/`fov`/`ambiance` configs, and its state is currently local `useState` inside `EnvironmentOverrideBar.tsx` (resetting whenever switching editors).
  4. `RenderSystem.renderSystem()` (line 1519) hardcodes `elapsedSec % 3.0` for `DARK_SUBNET` prop beacons instead of reading `propBeaconIntervalSec` from `lighting.json`.
- **Required Fix**:
  Support a sectorCondition override in `GameAudioSystem.updateAmbianceForFloor()`, read actual `FloorState.currentFloor` in `page.tsx` and `DevTerminal.tsx`, store `EnvironmentOverrideBar` state in `useGamedataStore` and render a toggle/bar in `GamedataTool.tsx`, and read `propBeaconIntervalSec` from `resolveSectorConditionProfile('DARK_SUBNET')`.

#### [MED-05] `/spawn` Debug Command Uses `grid.addEntity()` for Ground Items and Ignores `BlocksMovement` Walkability
- **Location**: [`src/server/debug/server-debug-handler.ts:229-254`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/server/debug/server-debug-handler.ts#L229-L254)
- **Vulnerability / Gap**:
  `handleServerDebugCommand('SPAWN_ENTITY')` unconditionally calls `session.grid.addEntity(spawnedId, tx, ty)`. If an item or currency template is spawned (e.g. `/spawn health-potion` or `/spawn rifle-v1`), it is never added to `grid.addItem(spawnedId, tx, ty)` (`tile.items`), making it impossible to pick up. If an entity with `BlocksMovement` is spawned, tile walkability is not updated.
- **Required Fix**:
  Check `world.hasComponent(spawnedId, Item) || world.hasComponent(spawnedId, CurrencyItem)` to call `session.grid.addItem(spawnedId, tx, ty)` vs `session.grid.addEntity(spawnedId, tx, ty)`, and update tile walkability when `BlocksMovement` is present.

#### [MED-06] `SpritePicker` Hardcodes `'default'` Theme in Canvas Preview & Filmstrip and Lacks Clip State Deletion
- **Location**: [`src/dev-tool/studio/shared/SpritePicker.tsx:253-355`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/shared/SpritePicker.tsx#L253-L355), [`src/rendering/sprite-animator.ts:191-226`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/rendering/sprite-animator.ts#L191-L226)
- **Vulnerability / Gap**:
  1. `SpritePicker.tsx` provides a `clipThemeId` selector in the Animation Clip Authoring Drawer, but `drawFrame()`, the `requestAnimationFrame` preview loop, and the filmstrip thumbnail renderer all hardcode `'default'` instead of passing `clipThemeId`.
  2. Spec §4.2.2 requires adding/removing state clips (`idle`, `move`, `attack`, `hit`, etc.), but `SpritePicker.tsx` has no button to remove an individual state clip or delete the animation set.
  3. When `clipThemeId === 'default'` and `propagateToThemes` is enabled, live-scrubbing (`PREVIEW`) in `SpritePicker` only updates `'default'` in `SpriteAnimator.hotUpdateAnimations()`, which has no effect when the running game is on a dedicated theme floor (`traxus_foundry`, `sekiguchi_biolabs`, `dark_subnet`).
- **Required Fix**:
  Pass `clipThemeId` to `drawAtlasFrame` and `resolveAnimatedFrameAtTime`, add a button to remove the selected state clip in `SpritePicker.tsx`, and update the active theme manifest in `SpriteAnimator.hotUpdateAnimations()` when `propagateToThemes` is true.

---

### Low / Code Quality & Minor

#### [LOW-01] Async Perf Probe Refs Not Synced to `__NIRMATA_DEV_RUNTIME__`, Missing `Cmd+S`/`Revert` Listeners in `SpawnTableEditor` & `PrefabEditor`, and Dirty `next-env.d.ts`
- **Location**: [`src/app/page.tsx:206-304`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/page.tsx#L206-L304), [`src/dev-tool/studio/editors/SpawnTableEditor.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/SpawnTableEditor.tsx), [`src/dev-tool/studio/editors/PrefabEditor.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/dev-tool/studio/editors/PrefabEditor.tsx), [`next-env.d.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/next-env.d.ts)
- **Vulnerability / Gap**:
  1. In `src/app/page.tsx`, `globalForDevRuntime.__NIRMATA_DEV_RUNTIME__` is assigned synchronously before `Promise.all([import('@dev-tool/perf/...')])` resolves, leaving `webglProbe`, `perfCollector`, `perfTickerCallback`, and `unsubscribePerfMode` as `null` on `__NIRMATA_DEV_RUNTIME__` after a Fast Refresh re-attach.
  2. `SpawnTableEditor.tsx` lacks `gamedata-save` (`Cmd+S`) and `gamedata-revert` listeners; `PrefabEditor.tsx` lacks a `gamedata-revert` listener.
  3. `next-env.d.ts` has an uncommitted modification in the working tree.
- **Required Fix**:
  Sync the resolved perf probe/collector/ticker refs onto `globalForDevRuntime.__NIRMATA_DEV_RUNTIME__` inside the `.then()` callback in `src/app/page.tsx`, add `gamedata-save` / `gamedata-revert` handlers to `SpawnTableEditor.tsx` and `PrefabEditor.tsx`, and revert `next-env.d.ts`.

---

## 4. Actionable Remediation Plan

- [x] **1. Fix `regenerateTemplateIndex()` (`CRIT-01`)**:
  - Update `src/app/api/dev/gamedata/utils.ts` to emit `registerGameTemplates`, `getDefaultEntityRegistry`, and `getTemplateSpriteKey` matching `src/game/entities/index.ts`, and add a regression test.
- [x] **2. Fix `hotReloadThemeAssets()` Texture Disposal Order & Animator Sync (`CRIT-02`)**:
  - In `src/rendering/assets.ts`, defer `prevAsset.destroy(true)` until after all new diffuse/companion textures are cached and `refreshEntitySpriteTextures()` + `spriteAnimator` frame invalidation have run. Reload base `'default'` alongside dedicated themes on `/hotload reload-assets`.
- [x] **3. Decouple `RenderSystem.applyHotloadPreview()` from `World` Mutations (`HIGH-01`)**:
  - Move ECS component preview/revert patching into `ClientHotloadBridge`, remove `LightSource` when `nextLight` is `undefined` on revert, and resolve mixin-inheriting entities during mixin preview/revert.
- [x] **4. Implement Live Server Registry Refresh for AI Trees, Spawn Tables, Configs & Prefabs (`HIGH-02`)**:
  - Add `PUT /api/dev/gamedata/ai-trees/[treeId]` updating `AIBehaviorRegistry`; add runtime setters for `depthConfig`, `lootDistribution`, `depthDistribution`, and `ALL_PREFABS`; and upsert newly `POST`ed entities/mixins into active session registries and `getDefaultEntityRegistry()`.
- [x] **5. Replace Shallow `patchComponent` with Schema-Validated Component Replacement in Hotload Reconciliation (`HIGH-03`)**:
  - Parse merged components with `def.schema.safeParse(merged)`, replace components via `world.addComponent()` on server and client so deleted optional fields are cleared, and preserve `SecurityLock.faradayBounds` and `isLegacy`.
- [x] **6. Preserve Player Shell Upgrades, `Heat.baseDissipation`, and Current Facing Direction (`HIGH-04`)**:
  - Update `applyShellTemplateToPlayer()` in `src/server/dev/hotload-reconciler.ts` to preserve current cardinal facing direction, apply shell upgrades, and patch `Heat.baseDissipation`.
- [x] **7. Unify `COMMIT` Envelope IDs and Forward `sessionPatches` on `BroadcastChannel` (`HIGH-05`)**:
  - Pass `sessionPatches` and canonical envelope IDs from API responses into `postHotloadCommit()` and avoid double-applying shell switch patches.
- [x] **8. Wire `MixinEditor` Hotload Hooks & Auto-Revert on Unsaved Item Switch (`MED-01`, `MED-02`)**:
  - Add `Cmd+S`, `REVERT`, and `LIVE_SYNC` preview/commit hooks to `MixinEditor.tsx`, and emit `postHotloadRevert()` when unmounting a dirty editor with uncommitted previews.
- [ ] **9. Fix Audio Hotload Volume & Voice Cleanup (`MED-03`)**:
  - Respect `cue.baseVolume` in `AudioEngine.hotUpdateCue()`, update active ambiance volume in `playAmbianceCue()` when `volumeMultiplier` changes on the same `cueId`, and clean up stopped voices in `activeCueVoices` / `activeVoiceMap`.
- [ ] **10. Fix Environment Overrides, `/spawn` Item Placement, `SpritePicker` Theme Preview, and Minor Cleanup (`MED-04`, `MED-05`, `MED-06`, `LOW-01`)**:
  - Pass `sectorCondition` overrides to `GameAudioSystem`, read actual `FloorState.currentFloor` in `page.tsx` and `DevTerminal.tsx`, lift `EnvironmentOverrideBar` state to `useGamedataStore` and render in `GamedataTool.tsx`, read `propBeaconIntervalSec` from `lighting.json`, use `grid.addItem()` for spawned items in `SPAWN_ENTITY`, pass `clipThemeId` and add clip state removal in `SpritePicker.tsx`, update `__NIRMATA_DEV_RUNTIME__` perf refs in `page.tsx`, and clean up `next-env.d.ts`.
