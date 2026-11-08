import { Application, Ticker, Graphics, Sprite } from 'pixi.js';
import { World } from '../engine/ecs/world';
import { EventBus } from '../engine/events/event-bus';
import { GameEvents } from '../game/events/types';
import { Grid } from '../engine/grid/grid';
import { EntityId } from '../engine/ecs/types';
import { Position } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';
import { Actor } from '@shared/components/actor';
import { FloorState } from '@shared/components/floor-state';
import { AbilityDef } from '@shared/components/ability-def';
import { FirmwareSlots } from '@shared/components/firmware-slots';
import { Prop, SecurityLock, CorruptedNode, TileOrientation, InteractiveSurface } from '@shared/components/environment';
import {
  DijkstraMap,
  DIJKSTRA_IMPASSABLE,
  DIJKSTRA_UNSET,
  DijkstraSeed,
  DijkstraPassabilityFn,
} from '../engine/ai/dijkstra-map';
import { gameStore } from '../game/ui/store';
import { WorldLayers } from './layers';
import { TILE_SIZE, FOV_RADIUS } from './constants';
import {
  computeFov,
  createExploredSet,
  isEntityVisible,
  getEntityVisibilityType,
  clearExplored,
} from './fov';
import { computeCameraTarget, lerpCamera, getVisibleTileRange } from './camera';
import { buildTilemap, clearTilemap } from './tilemap';
import {
  createEntitySprite,
  destroyEntitySprite,
  getEntitySprite,
  clearAllSprites,
  purgeOrphanedSprites,
} from './sprite-map';
import {
  tickAnimations,
  queueMoveTween,
  queueAttackAnimationWithDefender,
  queueDeathAnimation,
  clearAnimations,
  hasActiveAnimation,
} from './animations';
import {
  applyPersistentGlitch,
  applyDamageDistortion,
  applyPropOutline,
} from './filters/glitch-effects';
import { queueTypedDeathAnimation } from './filters/death-effects';
import { AIState } from '@shared/components/ai-state';
import {
  applyGrayscaleToContainer,
  removeFiltersFromContainer,
  applyStabilityDesaturation,
  disposeScreenEffects,
} from './filters/screen-effects';
import {
  applyHeatTierFilters,
  updateSpriteGhosting,
  disposeHeatEffects,
} from './filters/heat-visual-effects';
import { getHeatTier } from '../game/config/heat-tiers';
import {
  attachNeonEmitter,
  updateAllEmitters,
  cleanupEmitter,
  disposeAllEmitters,
} from './filters/particle-emitters';
import { spawnDamageText, updateDamageTexts, disposeDamageTexts } from './filters/damage-text';
import { EventOriginContext } from '../engine/utils/event-context';
import { resolveTileInspection, RememberedPropState } from './tile-inspector';
import { Item } from '@shared/components/item';
import { CurrencyItem } from '@shared/components/currency-item';

/**
 * Positions and rotates a sprite taking into account cardinal tile orientation.
 */
function applySpriteTransform(
  sprite: Sprite,
  x: number,
  y: number,
  angleDegrees: number = 0,
): void {
  if (angleDegrees !== 0) {
    if (sprite.pivot?.set) {
      sprite.pivot.set(TILE_SIZE / 2, TILE_SIZE / 2);
    }
    sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
    sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
    sprite.rotation = (angleDegrees * Math.PI) / 180;
  } else {
    if (sprite.pivot?.set) {
      sprite.pivot.set(0, 0);
    }
    sprite.x = x * TILE_SIZE;
    sprite.y = y * TILE_SIZE;
    sprite.rotation = 0;
  }
}

/**
 * Resolves the client-visible prop outline state.
 * Only flags a prop as 'corrupted' when the CorruptedNode has been revealed
 * (or triggered) and is not yet disarmed.
 */
export function resolvePropOutlineState(
  world: World<GameEvents>,
  entityId: EntityId,
): 'searched' | 'corrupted' | 'locked' | 'safe' | null {
  const propComp = world.getComponent(entityId, Prop);
  if (!propComp) return null;

  const corrupted = world.getComponent(entityId, CorruptedNode);
  const lock = world.getComponent(entityId, SecurityLock);

  if (propComp.isSearched) {
    return 'searched';
  }
  if (corrupted && !corrupted.isDisarmed && !corrupted.triggered && corrupted.revealed) {
    return 'corrupted';
  }
  if (lock && lock.isLocked) {
    return 'locked';
  }
  return 'safe';
}

export interface RenderSystemConfig {
  app: Application;
  layers: WorldLayers;
  world: World<GameEvents>;
  eventBus: EventBus<GameEvents>;
  getGrid: () => Grid;
  getPlayerEntity: () => EntityId;
  lightPasses: (x: number, y: number) => boolean;
}

export function createRenderSystem(config: RenderSystemConfig) {
  const { app, layers, world, eventBus, getGrid, getPlayerEntity, lightPasses } = config;
  const exploredSet = createExploredSet();
  const rememberedProps = new Map<EntityId, RememberedPropState>();
  const rememberedTileItems = new Map<string, Set<EntityId>>();
  let cameraTarget = { x: 0, y: 0 };
  let cameraPanOffset = { x: 0, y: 0 };
  let cameraZoom = 1.0;
  let isMapRevealed = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPanX = 0;
  let initialPanY = 0;
  const lastPropOutlineState = new Map<EntityId, string>();

  const targetingCursor = new Graphics();
  layers.effectsLayer.addChild(targetingCursor);

  const aiDebugGraphics = new Graphics();
  layers.effectsLayer.addChild(aiDebugGraphics);
  let aiDebugOverlayEnabled = false;
  let aiDebugMapType = 'approach_target';
  let cachedDijkstraMap: DijkstraMap | null = null;
  let lastDijkstraPlayerPos: { x: number; y: number } | null = null;
  let lastDijkstraMapType: string | null = null;
  let lastDijkstraTurnNumber: number = -1;

  let lastPointerEvent: { clientX: number; clientY: number } | null = null;
  let lastHoverCheckState: {
    clientX: number;
    clientY: number;
    camX: number;
    camY: number;
    zoom: number;
    playerX: number;
    playerY: number;
    isMapRevealed: boolean;
  } | null = null;
  let currentFovSet: Set<string> = new Set();

  const syncPropOutline = (entityId: EntityId, targetSprite?: Sprite) => {
    const outlineState = resolvePropOutlineState(world, entityId);
    if (!outlineState) return;
    const sprite = targetSprite ?? getEntitySprite(entityId);
    if (sprite) {
      applyPropOutline(sprite, outlineState);
    }
  };

  const recordPropMemory = (entityId: EntityId) => {
    const propComp = world.getComponent(entityId, Prop);
    if (!propComp) return;
    const lock = world.getComponent(entityId, SecurityLock);
    const corrupted = world.getComponent(entityId, CorruptedNode);
    rememberedProps.set(entityId, {
      isSearched: Boolean(propComp.isSearched),
      isLocked: Boolean(lock?.isLocked),
      corruptedRevealed: Boolean(corrupted?.revealed || corrupted?.triggered),
      corruptedDisarmed: Boolean(corrupted?.isDisarmed),
      corruptedTriggered: Boolean(corrupted?.triggered),
      corruptionLevel: corrupted?.corruptionLevel,
    });
  };

  const snapshotVisibleMemory = (visibleSet: Set<string>) => {
    const props = world.query(Prop, Position);
    for (const propId of props) {
      const pos = world.getComponent(propId, Position);
      if (pos && visibleSet.has(`${pos.x},${pos.y}`)) {
        recordPropMemory(propId);
      }
    }

    for (const key of visibleSet) {
      rememberedTileItems.set(key, new Set());
    }
    const posEntities = world.query(Position);
    for (const id of posEntities) {
      if (!world.hasComponent(id, Item) && !world.hasComponent(id, CurrencyItem)) continue;
      const pos = world.getComponent(id, Position);
      if (!pos) continue;
      const key = `${pos.x},${pos.y}`;
      if (visibleSet.has(key)) {
        let set = rememberedTileItems.get(key);
        if (!set) {
          set = new Set();
          rememberedTileItems.set(key, set);
        }
        set.add(id);
      }
    }
  };

  const updateHoverInspection = (e: { clientX: number; clientY: number }) => {
    if (isDragging) {
      gameStore.getState().setHoveredEntity(null);
      return;
    }

    const canvas = app.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      gameStore.getState().setHoveredEntity(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      gameStore.getState().setHoveredEntity(null);
      return;
    }

    const elem =
      typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(e.clientX, e.clientY)
        : null;

    if (elem && elem !== canvas) {
      const isCanvasWrapper =
        elem.id === 'canvas-container' || (canvas && canvas.parentElement === elem);
      if (!isCanvasWrapper && elem.closest && elem.closest('#ui-root')) {
        // Suppress tile inspect only if cursor is over actual UI controls, panels, or dialogues,
        // rather than transparent layout bays framing the canvas.
        const isInteractiveOrPanel = elem.closest(
          'button, [role="dialog"], [role="alertdialog"], [role="tooltip"], input, select, textarea, aside, header, footer, nav, section, .panel-card, [data-hud-panel], [class*="hudRibbon"], [class*="hudColLeft"], [class*="hudColRight"], [class*="hudBottomBar"]',
        );
        const isTransparentBay =
          !isInteractiveOrPanel &&
          Boolean(
            elem.closest(
              '[class*="tacticalViewportBay"], [class*="hudConstruct"], [class*="hudMainGrid"]',
            ),
          );

        if (!isTransparentBay) {
          gameStore.getState().setHoveredEntity(null);
          return;
        }
      }
    }

    const storeState = gameStore.getState();
    if (
      storeState.inventoryVisible ||
      storeState.groundTransferVisible ||
      storeState.deadDropModalVisible ||
      storeState.hotkeysModalVisible ||
      storeState.abortDialogVisible ||
      storeState.bsodVisible ||
      storeState.runResultsVisible
    ) {
      storeState.setHoveredEntity(null);
      return;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const worldX = (canvasX - layers.worldContainer.x) / cameraZoom;
    const worldY = (canvasY - layers.worldContainer.y) / cameraZoom;
    const gx = Math.floor(worldX / TILE_SIZE);
    const gy = Math.floor(worldY / TILE_SIZE);

    const info = resolveTileInspection({
      world,
      grid: getGrid(),
      gx,
      gy,
      screenX: e.clientX,
      screenY: e.clientY,
      isVisibleInFov: currentFovSet.has(`${gx},${gy}`),
      isExplored: exploredSet.has(`${gx},${gy}`) || isMapRevealed,
      playerEntity: getPlayerEntity(),
      detailedFlavorTextEnabled: storeState.detailedFlavorTextEnabled,
      rememberedProps,
      rememberedTileItems,
    });

    storeState.setHoveredEntity(info);
  };

  const handlePointerDown = (e: PointerEvent) => {
    // Only middle click (button 1) or right click (button 2) triggers free-pan dragging
    if (e.button === 1 || e.button === 2) {
      isDragging = true;
      gameStore.getState().setHoveredEntity(null);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialPanX = cameraPanOffset.x;
      initialPanY = cameraPanOffset.y;
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    lastPointerEvent = { clientX: e.clientX, clientY: e.clientY };
    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      cameraPanOffset = {
        x: initialPanX + dx,
        y: initialPanY + dy,
      };
      gameStore.getState().setHoveredEntity(null);
      return;
    }
    updateHoverInspection(e);
  };

  const handlePointerLeave = () => {
    lastPointerEvent = null;
    lastHoverCheckState = null;
    gameStore.getState().setHoveredEntity(null);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.button === 1 || e.button === 2 || isDragging) {
      isDragging = false;
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
    cameraZoom = Math.min(1.5, Math.max(0.75, Math.round((cameraZoom + zoomDelta) * 100) / 100));
    layers.worldContainer.scale.set(cameraZoom);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const handleDebugRevealMap = () => {
    isMapRevealed = true;
    const grid = getGrid();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        exploredSet.add(`${x},${y}`);
      }
    }
  };

  const handleDebugToggleAI = (payload: { mapType?: string; enabled?: boolean }) => {
    if (payload.enabled !== undefined) {
      aiDebugOverlayEnabled = payload.enabled;
    } else {
      aiDebugOverlayEnabled = !aiDebugOverlayEnabled;
    }
    if (payload.mapType && payload.mapType !== aiDebugMapType) {
      aiDebugMapType = payload.mapType;
      cachedDijkstraMap = null;
    }
    if (!aiDebugOverlayEnabled) {
      cachedDijkstraMap = null;
      aiDebugGraphics.clear();
    }
  };

  const handleRecenterCamera = () => {
    cameraPanOffset = { x: 0, y: 0 };
    cameraZoom = 1.0;
    layers.worldContainer.scale.set(1.0);
  };

  const handleEntityCreated = (payload: { entityId: EntityId }) => {
    const spriteComp = world.getComponent(payload.entityId, SpriteComponent);
    if (spriteComp) {
      const sprite = createEntitySprite(payload.entityId, spriteComp.key, layers.entityLayer);

      // Apply persistent glitch for enemies
      const aiState = world.getComponent(payload.entityId, AIState);
      if (aiState) {
        applyPersistentGlitch(sprite, aiState.behaviorType);
        attachNeonEmitter(sprite, aiState.behaviorType, layers.effectsLayer);
      }

      // Apply client-visible prop outline for interactive props
      syncPropOutline(payload.entityId, sprite);
    }
  };

  const handlePropUpdated = (payload: { propId: number }) => {
    const entityId = payload.propId;
    if (entityId) {
      const spriteComp = world.getComponent(entityId, SpriteComponent);
      if (spriteComp) {
        createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
      }
      syncPropOutline(entityId);
      const pos = world.getComponent(entityId, Position);
      if (pos && currentFovSet.has(`${pos.x},${pos.y}`)) {
        recordPropMemory(entityId);
      }
    }
  };

  const handleEntityDestroyed = (payload: { entityId: EntityId }) => {
    const sprite = getEntitySprite(payload.entityId);
    if (sprite) {
      const aiState = world.getComponent(payload.entityId, AIState);
      if (aiState) {
        cleanupEmitter(sprite);
        queueTypedDeathAnimation(payload.entityId, aiState.behaviorType, sprite, () => {
          destroyEntitySprite(payload.entityId);
        });
      } else {
        queueDeathAnimation(payload.entityId, () => {
          destroyEntitySprite(payload.entityId);
        });
      }
    }
  };

  const handleItemPickedUp = (payload: { entityId?: EntityId; itemId: EntityId }) => {
    destroyEntitySprite(payload.itemId);
  };

  // Track last predicted player move to avoid duplicate tweens when server reconciles
  let lastPredictedPlayerMove: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null = null;

  // Deduplicate rapid damage visual pulses on the same defender in the same tick
  let lastDamageProcessed: { defenderId: EntityId; timestamp: number } | null = null;

  const handleDamageDealt = (payload: { attackerId?: EntityId; defenderId: EntityId }) => {
    const now = Date.now();
    if (
      lastDamageProcessed &&
      lastDamageProcessed.defenderId === payload.defenderId &&
      now - lastDamageProcessed.timestamp < 16
    ) {
      return;
    }
    lastDamageProcessed = { defenderId: payload.defenderId, timestamp: now };

    const sprite = getEntitySprite(payload.defenderId);
    if (sprite) {
      applyDamageDistortion(sprite);

      // Spawn floating code leak for enemies
      const aiState = world.getComponent(payload.defenderId, AIState);
      if (aiState) {
        spawnDamageText(sprite.x + TILE_SIZE / 2, sprite.y + TILE_SIZE / 2, layers.effectsLayer);
      }
    }

    // Trigger melee bump animation if attacker is adjacent
    if (payload.attackerId) {
      const attackerPos = world.getComponent(payload.attackerId, Position);
      const defenderPos = world.getComponent(payload.defenderId, Position);
      if (attackerPos && defenderPos) {
        const dx = Math.abs(attackerPos.x - defenderPos.x);
        const dy = Math.abs(attackerPos.y - defenderPos.y);
        const distance = dx + dy; // Manhattan distance
        if (distance === 1) {
          queueAttackAnimationWithDefender(
            payload.attackerId,
            attackerPos,
            payload.defenderId,
            defenderPos,
            getEntitySprite,
          );
        }
      }
    }
  };

  const handleEntityMoved = (payload: {
    entityId: EntityId;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }) => {
    const isPlayer = payload.entityId === getPlayerEntity();
    const origin = EventOriginContext.current;

    if (isPlayer) {
      cameraPanOffset = { x: 0, y: 0 };
      if (origin === 'client') {
        // Record predicted player movement and queue visual tween
        lastPredictedPlayerMove = {
          fromX: payload.fromX,
          fromY: payload.fromY,
          toX: payload.toX,
          toY: payload.toY,
        };
        queueMoveTween(
          payload.entityId,
          payload.fromX,
          payload.fromY,
          payload.toX,
          payload.toY,
          getEntitySprite,
        );
        return;
      }

      if (origin === 'server') {
        // If this server event confirms our predicted move, skip duplicate tween
        if (
          lastPredictedPlayerMove &&
          lastPredictedPlayerMove.fromX === payload.fromX &&
          lastPredictedPlayerMove.fromY === payload.fromY &&
          lastPredictedPlayerMove.toX === payload.toX &&
          lastPredictedPlayerMove.toY === payload.toY
        ) {
          lastPredictedPlayerMove = null;
          return;
        }

        // Misprediction correction or forced move from server
        lastPredictedPlayerMove = null;
        queueMoveTween(
          payload.entityId,
          payload.fromX,
          payload.fromY,
          payload.toX,
          payload.toY,
          getEntitySprite,
        );
        return;
      }
    }

    // For all other entities (enemies, NPCs), always queue visual move tween
    queueMoveTween(
      payload.entityId,
      payload.fromX,
      payload.fromY,
      payload.toX,
      payload.toY,
      getEntitySprite,
    );
  };

  const handleApplyWorldFilter = (payload: { filterType: string }) => {
    if (payload.filterType === 'grayscale') {
      applyGrayscaleToContainer(layers.worldContainer);
    }
  };

  const handleRemoveWorldFilter = (payload: { filterType: string }) => {
    if (payload.filterType === 'grayscale') {
      removeFiltersFromContainer(layers.worldContainer);
    }
  };

  const handleStabilityChanged = (payload: { newValue: number }) => {
    applyStabilityDesaturation(layers.worldContainer, payload.newValue);
  };

  const handleHeatChanged = (payload: { entityId: EntityId; newHeat: number; maxSafe: number }) => {
    if (payload.entityId === getPlayerEntity()) {
      const tier = getHeatTier(payload.newHeat);
      applyHeatTierFilters(layers.worldContainer, tier.tier);

      const sprite = getEntitySprite(payload.entityId);
      if (sprite) {
        updateSpriteGhosting(sprite, tier.tier, layers.entityLayer);
      }
    }
  };

  const updateCameraFrame = (ticker: Ticker) => {
    const deltaMs = ticker.deltaMS;
    const newPos = lerpCamera(
      layers.worldContainer.x,
      layers.worldContainer.y,
      cameraTarget.x,
      cameraTarget.y,
      deltaMs,
    );
    layers.worldContainer.x = newPos.x;
    layers.worldContainer.y = newPos.y;

    // Smooth animation tick
    tickAnimations(deltaMs, getEntitySprite);

    // Update visual systems
    updateAllEmitters(deltaMs);
    updateDamageTexts(deltaMs);
  };

  return {
    init() {
      eventBus.on('ENTITY_CREATED', handleEntityCreated);
      eventBus.on('ENTITY_DESTROYED', handleEntityDestroyed);
      eventBus.on('ITEM_PICKED_UP', handleItemPickedUp);
      eventBus.on('ENTITY_MOVED', handleEntityMoved);
      eventBus.on('DAMAGE_DEALT', handleDamageDealt);
      eventBus.on('APPLY_WORLD_FILTER', handleApplyWorldFilter);
      eventBus.on('REMOVE_WORLD_FILTER', handleRemoveWorldFilter);
      eventBus.on('STABILITY_CHANGED', handleStabilityChanged);
      eventBus.on('HEAT_CHANGED', handleHeatChanged);
      eventBus.on('PROP_INTERACTED', handlePropUpdated);
      eventBus.on('LOCK_UNLOCKED', handlePropUpdated);
      eventBus.on('DEBUG_REVEAL_MAP', handleDebugRevealMap);
      eventBus.on('DEBUG_TOGGLE_AI', handleDebugToggleAI);
      eventBus.on('RECENTER_CAMERA', handleRecenterCamera);
      eventBus.on('DUNGEON_GENERATED', () => this.onDungeonGenerated());
      eventBus.on('STATE_RECONCILED', () => this.reconcileSprites());

      const canvas = app.canvas;
      if (canvas && typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointerleave', handlePointerLeave);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('contextmenu', handleContextMenu);
      }

      app.ticker.add(updateCameraFrame);

      // Initial sprite sync for existing entities
      const entities = world.query(SpriteComponent, Position);
      for (const entityId of entities) {
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        const pos = world.getComponent(entityId, Position)!;
        const orientation = world.getComponent(entityId, TileOrientation);
        const sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);
        syncPropOutline(entityId, sprite);
      }
    },

    reconcileSprites() {
      const activeEntities = new Set(world.query(SpriteComponent, Position));
      purgeOrphanedSprites(activeEntities);

      // Instantiate sprites for any active entity missing its sprite and refresh prop outlines
      for (const entityId of activeEntities) {
        let sprite = getEntitySprite(entityId);
        const spriteComp = world.getComponent(entityId, SpriteComponent);
        if (!sprite) {
          const pos = world.getComponent(entityId, Position);
          if (spriteComp) {
            sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
            if (pos) {
              const orientation = world.getComponent(entityId, TileOrientation);
              applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);
            }
          }
        } else if (spriteComp) {
          createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        }
        if (sprite) {
          syncPropOutline(entityId, sprite);
        }
      }
    },

    renderSystem() {
      const playerEntity = getPlayerEntity();
      if (!world.entityExists(playerEntity)) return;

      const playerPos = world.getComponent(playerEntity, Position);
      if (!playerPos) return;

      // 1. Dynamic FOV (D-15 Extended Sight Logic)
      let effectiveRadius = FOV_RADIUS;
      const floorState = world.getComponent(playerEntity, FloorState);
      if (floorState?.sectorCondition === 'DARK_SUBNET') {
        effectiveRadius = Math.max(2, effectiveRadius - 2);
      }
      const fSlots = world.getComponent(playerEntity, FirmwareSlots);
      if (fSlots) {
        for (const firmwareId of fSlots.equipped) {
          const abilityDef = world.getComponent(firmwareId, AbilityDef);
          if (abilityDef && abilityDef.effectType === 'toggle_vision' && abilityDef.isActive) {
            effectiveRadius = Math.max(effectiveRadius, abilityDef.visionRadius);
          }
        }
      }

      const fovSet = computeFov(
        playerPos.x,
        playerPos.y,
        effectiveRadius,
        lightPasses,
        exploredSet,
      );

      // Snapshot remembered state for tiles currently visible in player's real FOV
      snapshotVisibleMemory(fovSet);
      currentFovSet = new Set(fovSet);

      if (isMapRevealed) {
        for (const key of exploredSet) {
          fovSet.add(key);
        }
      }

      eventBus.emit('FOV_UPDATED', { visibleSet: fovSet });

      // 1.5. Targeting UI Rendering
      const storeState = gameStore.getState();
      targetingCursor.clear();
      if (storeState.targetingActive) {
        const tx = storeState.targetingX * TILE_SIZE;
        const ty = storeState.targetingY * TILE_SIZE;

        // Render range indicator (pulsing ring)
        if (storeState.targetingRange > 0) {
          targetingCursor.lineStyle(2, 0x00ffff, 0.3);
          targetingCursor.drawCircle(
            playerPos.x * TILE_SIZE + TILE_SIZE / 2,
            playerPos.y * TILE_SIZE + TILE_SIZE / 2,
            storeState.targetingRange * TILE_SIZE,
          );
        }

        // Render target tile highlight
        targetingCursor.lineStyle(2, 0x00ffff, 0.8);
        targetingCursor.beginFill(0x00ffff, 0.2);
        targetingCursor.drawRect(tx, ty, TILE_SIZE, TILE_SIZE);
        targetingCursor.endFill();

        // Corner brackets for "hacking" aesthetic
        const margin = 4;
        const len = 8;
        targetingCursor.lineStyle(2, 0x00ffff, 1.0);

        // Top Left
        targetingCursor.moveTo(tx + margin, ty + margin + len);
        targetingCursor.lineTo(tx + margin, ty + margin);
        targetingCursor.lineTo(tx + margin + len, ty + margin);

        // Top Right
        targetingCursor.moveTo(tx + TILE_SIZE - margin - len, ty + margin);
        targetingCursor.lineTo(tx + TILE_SIZE - margin, ty + margin);
        targetingCursor.lineTo(tx + TILE_SIZE - margin, ty + margin + len);

        // Bottom Right
        targetingCursor.moveTo(tx + TILE_SIZE - margin, ty + TILE_SIZE - margin - len);
        targetingCursor.lineTo(tx + TILE_SIZE - margin, ty + TILE_SIZE - margin);
        targetingCursor.lineTo(tx + TILE_SIZE - margin - len, ty + TILE_SIZE - margin);

        // Bottom Left
        targetingCursor.moveTo(tx + margin + len, ty + TILE_SIZE - margin);
        targetingCursor.lineTo(tx + margin, ty + TILE_SIZE - margin);
        targetingCursor.lineTo(tx + margin, ty + TILE_SIZE - margin - len);
      }

      // Refresh dynamic prop outlines if state has changed
      const props = world.query(Prop);
      for (const propId of props) {
        const outlineState = resolvePropOutlineState(world, propId) ?? 'none';
        if (lastPropOutlineState.get(propId) !== outlineState) {
          lastPropOutlineState.set(propId, outlineState);
          syncPropOutline(propId);
        }
      }

      // 2. Camera
      const baseTarget = computeCameraTarget(playerPos.x, playerPos.y, cameraZoom);
      cameraTarget = {
        x: baseTarget.x + cameraPanOffset.x,
        y: baseTarget.y + cameraPanOffset.y,
      };

      // 3. Tilemap
      const visibleRange = getVisibleTileRange(layers.worldContainer.x, layers.worldContainer.y, cameraZoom);
      buildTilemap(getGrid(), layers.terrainLayer, {
        visibleRange,
        fovSet,
        exploredSet,
        playerPos,
      });

      // 4. Entity Sprites Sync & Visibility
      const renderables = world.query(SpriteComponent, Position);
      let playerSprite: Sprite | null = null;
      for (const entityId of renderables) {
        let sprite = getEntitySprite(entityId);

        // Lazy sprite creation or texture sync
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);

        const pos = world.getComponent(entityId, Position)!;
        const actor = world.getComponent(entityId, Actor);
        const orientation = world.getComponent(entityId, TileOrientation);

        // Update position if not animating
        if (!hasActiveAnimation(entityId)) {
          applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);
        }

        // Visibility gating
        const entityType = getEntityVisibilityType(actor?.isPlayer, !!actor);
        let { visible, alpha } = isEntityVisible(pos, entityType, fovSet, exploredSet);

        // FORCE PLAYER VISIBLE FOR DEBUGGING
        if (entityType === 'player') {
          visible = true;
          alpha = 1.0;
          playerSprite = sprite;
        }

        const propComp = world.getComponent(entityId, Prop);
        if (propComp?.isSearched) {
          alpha = alpha * 0.6;
        }

        sprite.visible = visible;
        sprite.alpha = alpha;

        // Layer visible entities; player will be placed on the absolute top
        if (entityType !== 'player' && visible && sprite.parent) {
          sprite.parent.addChild(sprite);
        }
      }

      // Ensure player sprite is ALWAYS on the topmost z-layer of entityLayer
      if (playerSprite && playerSprite.parent) {
        playerSprite.parent.addChild(playerSprite);
      }

      if (lastPointerEvent) {
        const needsHoverUpdate =
          !lastHoverCheckState ||
          lastHoverCheckState.clientX !== lastPointerEvent.clientX ||
          lastHoverCheckState.clientY !== lastPointerEvent.clientY ||
          lastHoverCheckState.camX !== layers.worldContainer.x ||
          lastHoverCheckState.camY !== layers.worldContainer.y ||
          lastHoverCheckState.zoom !== cameraZoom ||
          lastHoverCheckState.playerX !== playerPos.x ||
          lastHoverCheckState.playerY !== playerPos.y ||
          lastHoverCheckState.isMapRevealed !== isMapRevealed;

        if (needsHoverUpdate) {
          lastHoverCheckState = {
            clientX: lastPointerEvent.clientX,
            clientY: lastPointerEvent.clientY,
            camX: layers.worldContainer.x,
            camY: layers.worldContainer.y,
            zoom: cameraZoom,
            playerX: playerPos.x,
            playerY: playerPos.y,
            isMapRevealed,
          };
          updateHoverInspection(lastPointerEvent);
        }
      }

      if (aiDebugOverlayEnabled) {
        const grid = getGrid();
        const floorStates = world.query(FloorState);
        const floor = floorStates.length > 0 ? world.getComponent(floorStates[0], FloorState) : null;
        const turnNumber = floor?.turnNumber ?? 0;

        const needsRecompute =
          !cachedDijkstraMap ||
          !lastDijkstraPlayerPos ||
          lastDijkstraPlayerPos.x !== playerPos.x ||
          lastDijkstraPlayerPos.y !== playerPos.y ||
          lastDijkstraMapType !== aiDebugMapType ||
          lastDijkstraTurnNumber !== turnNumber;

        if (needsRecompute) {
          lastDijkstraPlayerPos = { x: playerPos.x, y: playerPos.y };
          lastDijkstraMapType = aiDebugMapType;
          lastDijkstraTurnNumber = turnNumber;

          const stepCostFn: DijkstraPassabilityFn = (x, y) => {
            if (!grid.inBounds(x, y) || !grid.isWalkable(x, y)) {
              return DIJKSTRA_IMPASSABLE;
            }
            return 1.0;
          };

          const map = new DijkstraMap(grid.width, grid.height);

          switch (aiDebugMapType) {
            case 'flee_from_target': {
              const approach = new DijkstraMap(grid.width, grid.height);
              approach.compute([{ x: playerPos.x, y: playerPos.y, value: 0 }], stepCostFn);
              cachedDijkstraMap = approach.createFleeMap(stepCostFn, -1.2);
              break;
            }

            case 'pack_surround_cardinal': {
              const cardinalDirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ];
              const seeds: DijkstraSeed[] = [];
              for (const [dx, dy] of cardinalDirs) {
                const nx = playerPos.x + dx;
                const ny = playerPos.y + dy;
                if (grid.inBounds(nx, ny) && grid.isWalkable(nx, ny)) {
                  seeds.push({ x: nx, y: ny, value: 0 });
                }
              }
              if (seeds.length === 0) {
                seeds.push({ x: playerPos.x, y: playerPos.y, value: 0 });
              }
              map.compute(seeds, stepCostFn);
              cachedDijkstraMap = map;
              break;
            }

            case 'kite_to_cover': {
              const coverTiles = new Set<string>();
              const surfaces = world.query(InteractiveSurface, Position);
              for (const id of surfaces) {
                const surface = world.getComponent(id, InteractiveSurface);
                const pos = world.getComponent(id, Position);
                if (surface && pos && surface.providesCover !== false) {
                  coverTiles.add(`${pos.x},${pos.y}`);
                }
              }

              const seeds: DijkstraSeed[] = [];
              for (let dx = -5; dx <= 5; dx++) {
                for (let dy = -5; dy <= 5; dy++) {
                  const dist = Math.abs(dx) + Math.abs(dy);
                  if (dist < 3 || dist > 5) continue;

                  const tx = playerPos.x + dx;
                  const ty = playerPos.y + dy;
                  if (!grid.inBounds(tx, ty) || !grid.isWalkable(tx, ty)) continue;

                  let hasCover = false;
                  for (const [cdx, cdy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                  ]) {
                    const nx = tx + cdx;
                    const ny = ty + cdy;
                    const nDist = Math.abs(nx - playerPos.x) + Math.abs(ny - playerPos.y);
                    if (nDist < dist && coverTiles.has(`${nx},${ny}`)) {
                      hasCover = true;
                      break;
                    }
                  }

                  seeds.push({ x: tx, y: ty, value: hasCover ? 0 : 3.0 });
                }
              }

              if (seeds.length === 0) {
                seeds.push({ x: playerPos.x, y: playerPos.y, value: 0 });
              }
              map.compute(seeds, stepCostFn);
              cachedDijkstraMap = map;
              break;
            }

            case 'approach_target':
            default: {
              map.compute([{ x: playerPos.x, y: playerPos.y, value: 0 }], stepCostFn);
              cachedDijkstraMap = map;
              break;
            }
          }
        }

        aiDebugGraphics.clear();
        if (cachedDijkstraMap) {
          const isFlee = aiDebugMapType === 'flee_from_target';
          const isKite = aiDebugMapType === 'kite_to_cover';
          const isPack = aiDebugMapType === 'pack_surround_cardinal';
          const color = isFlee ? 0xff2a4b : isKite ? 0xa855f7 : isPack ? 0xeab308 : 0x00f0ff;

          for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
              if (!grid.isWalkable(x, y)) continue;
              const val = cachedDijkstraMap.get(x, y);
              if (!Number.isFinite(val) || val >= DIJKSTRA_UNSET) continue;

              let alpha: number;
              if (isFlee) {
                const norm = Math.min(1, Math.abs(val) / 20);
                alpha = Math.max(0.06, 0.1 + norm * 0.3);
              } else {
                if (val > 16) continue;
                const norm = Math.min(1, val / 16);
                alpha = Math.max(0.06, 0.4 - norm * 0.32);
              }

              aiDebugGraphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
              aiDebugGraphics.fill({ color, alpha });
            }
          }
        }
      }
    },

    onDungeonGenerated() {
      cameraPanOffset = { x: 0, y: 0 };
      cameraZoom = 1.0;
      layers.worldContainer.scale.set(1.0);
      lastPropOutlineState.clear();
      lastHoverCheckState = null;
      isMapRevealed = false;
      cachedDijkstraMap = null;
      lastDijkstraPlayerPos = null;
      clearExplored(exploredSet);
      rememberedProps.clear();
      rememberedTileItems.clear();
      clearTilemap(layers.terrainLayer);
      clearAnimations();
      clearAllSprites();

      // Snap camera to player on new dungeon
      const playerEntity = getPlayerEntity();
      const playerPos = world.getComponent(playerEntity, Position);
      if (playerPos) {
        cameraTarget = computeCameraTarget(playerPos.x, playerPos.y, cameraZoom);
        layers.worldContainer.x = cameraTarget.x;
        layers.worldContainer.y = cameraTarget.y;
      }

      // Re-initialize sprites for all existing entities in the new dungeon
      const entities = world.query(SpriteComponent, Position);
      for (const entityId of entities) {
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        const pos = world.getComponent(entityId, Position)!;
        const orientation = world.getComponent(entityId, TileOrientation);
        const sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);

        // Ensure emitters are attached to enemies on re-init
        const aiState = world.getComponent(entityId, AIState);
        if (aiState) {
          attachNeonEmitter(sprite, aiState.behaviorType, layers.effectsLayer);
        }
        syncPropOutline(entityId, sprite);
      }

      this.renderSystem();
    },

    destroy() {
      eventBus.off('ENTITY_CREATED', handleEntityCreated);
      eventBus.off('ENTITY_DESTROYED', handleEntityDestroyed);
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('DAMAGE_DEALT', handleDamageDealt);
      eventBus.off('APPLY_WORLD_FILTER', handleApplyWorldFilter);
      eventBus.off('REMOVE_WORLD_FILTER', handleRemoveWorldFilter);
      eventBus.off('STABILITY_CHANGED', handleStabilityChanged);
      eventBus.off('HEAT_CHANGED', handleHeatChanged);
      eventBus.off('PROP_INTERACTED', handlePropUpdated);
      eventBus.off('LOCK_UNLOCKED', handlePropUpdated);
      eventBus.off('DEBUG_REVEAL_MAP', handleDebugRevealMap);
      eventBus.off('DEBUG_TOGGLE_AI', handleDebugToggleAI);
      eventBus.off('RECENTER_CAMERA', handleRecenterCamera);

      const canvas = app.canvas;
      if (canvas && typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointerleave', handlePointerLeave);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('contextmenu', handleContextMenu);
      }

      app.ticker.remove(updateCameraFrame);
      clearTilemap(layers.terrainLayer);
      clearExplored(exploredSet);
      rememberedProps.clear();
      rememberedTileItems.clear();
      lastPropOutlineState.clear();
      lastHoverCheckState = null;
      clearAllSprites();
      clearAnimations();
      disposeScreenEffects();
      disposeHeatEffects();
      disposeAllEmitters();
      disposeDamageTexts();
      gameStore.getState().setHoveredEntity(null);
    },

    recenterCamera() {
      handleRecenterCamera();
    },

    exposeMap() {
      handleDebugRevealMap();
    },

    getCameraZoom(): number {
      return cameraZoom;
    },

    setCameraZoom(zoom: number) {
      cameraZoom = Math.min(1.5, Math.max(0.75, Math.round(zoom * 100) / 100));
      layers.worldContainer.scale.set(cameraZoom);
    },

    getCameraPanOffset(): { x: number; y: number } {
      return { ...cameraPanOffset };
    },
  };
}
