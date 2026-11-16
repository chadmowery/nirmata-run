import { Application, Ticker, Graphics, Sprite } from 'pixi.js';
import { World } from '../engine/ecs/world';
import { EventBus } from '../engine/events/event-bus';
import { GameEvents } from '../game/events/types';
import { Grid } from '../engine/grid/grid';
import { EntityId } from '../engine/ecs/types';
import { Position } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';
import { AnimationStateKey } from '@shared/tileset-types';
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
import { buildTilemap, clearTilemap, getTilemapTelemetry, TilemapTelemetry, resetAutotileSolveCount } from './tilemap';
import {
  createEntitySprite,
  destroyEntitySprite,
  getEntitySprite,
  getEntitySprites,
  clearAllSprites,
  refreshEntitySpriteTextures,
  purgeOrphanedSprites,
  getSpriteTelemetry,
  SpriteTelemetry,
} from './sprite-map';
import {
  tickAnimations,
  queueMoveTween,
  queueAttackAnimationWithDefender,
  queueDeathAnimation,
  clearAnimations,
  hasActiveAnimation,
  getActiveAnimationCount,
} from './animations';
import { spriteAnimator } from './sprite-animator';
import {
  applyPersistentGlitch,
  applyDamageDistortion,
  applyPropOutline,
  getFilterTelemetry,
  removePersistentGlitch,
  FilterTelemetry,
} from './filters/glitch-effects';
import { queueTypedDeathAnimation } from './filters/death-effects';
import { AIState } from '@shared/components/ai-state';
import { Stability } from '@shared/components/stability';
import { Heat } from '@shared/components/heat';
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
import { loadThemedAssets } from './assets';
import { LightSource, LightSourceData } from '@shared/components/light-source';
import {
  LightingSystem,
  LightingTelemetry,
  RenderLightDescriptor,
  lerpHexColor,
} from './lighting';
import { ParticleSystem, ParticleTelemetry } from './particles';
import {
  spawnDamageText,
  updateDamageTexts,
  disposeDamageTexts,
  getActiveDamageTextCount,
} from './filters/damage-text';
import { EventOriginContext } from '../engine/utils/event-context';
import { resolveTileInspection, RememberedPropState } from './tile-inspector';
import { Item } from '@shared/components/item';
import { CurrencyItem } from '@shared/components/currency-item';

export interface RenderStageTimings {
  fovMs: number;
  tilemapMs: number;
  spriteSyncMs: number;
  vfxMs: number;
  hoverMs: number;
  totalCpuMs: number;
}

export interface DevRenderBisectionFlags {
  measureTimings: boolean;
  disableSpriteFilters: boolean;
  disableWorldFilters: boolean;
  disableParticles: boolean;
  cacheStaticTilemap: boolean;
  cacheStaticFov: boolean;
  disableDeferredLighting?: boolean;
}

export interface RenderTelemetry {
  stageTimings: RenderStageTimings;
  tilemap: TilemapTelemetry;
  particles: { activeEmitters: number; totalParticles: number } & Partial<ParticleTelemetry>;
  filters: FilterTelemetry & { worldFiltersCount: number };
  sprites: SpriteTelemetry;
  activeAnimations: number;
  activeDamageTexts: number;
  fovTiles: number;
  exploredTiles: number;
  rememberedPropsCount: number;
  rememberedItemsCount: number;
  lighting?: LightingTelemetry;
}

export interface RenderSystem {
  init(): void;
  reconcileSprites(): void;
  renderSystem(): void;
  onDungeonGenerated(): void;
  destroy(): void;
  recenterCamera(): void;
  exposeMap(): void;
  getCameraZoom(): number;
  setCameraZoom(zoom: number): void;
  getCameraPanOffset(): { x: number; y: number };
  getStageTimings(): Readonly<RenderStageTimings>;
  getRenderTelemetry(): RenderTelemetry;
  setDevRenderFlags(flags: Partial<DevRenderBisectionFlags>): void;
  getEffectiveEntityLight(entityId: EntityId): LightSourceData | undefined;
}

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
  let lastFovKey: string | null = null;
  let lastFovResult: Set<string> | null = null;
  let lastTilemapKey: string | null = null;

  let devFlags: DevRenderBisectionFlags = {
    measureTimings: false,
    disableSpriteFilters: false,
    disableWorldFilters: false,
    disableParticles: false,
    cacheStaticTilemap: false,
    cacheStaticFov: false,
    disableDeferredLighting: false,
  };

  const lightingSystem = new LightingSystem(getGrid().width, getGrid().height);
  const particleSystem = new ParticleSystem();
  const dynamicLightOverrides = new Map<EntityId, LightSourceData>();
  let lastAppliedTheme = '';
  let lastLightingSyncMs = 0;
  let lightingDestroyed = false;
  let hasRenderedLightingFrame = false;
  let lastExtraPrimaryLights: RenderLightDescriptor[] = [];
  let onThemeLoadedRefresh: (() => void) | null = null;

  const resolveActiveFloorState = () => {
    const floorEntities = world.query(FloorState);
    if (floorEntities.length > 0) {
      return world.getComponent(floorEntities[0], FloorState);
    }
    const playerEntity = getPlayerEntity();
    return world.entityExists(playerEntity) ? world.getComponent(playerEntity, FloorState) : undefined;
  };

  const syncEnvironmentTheme = () => {
    const floor = resolveActiveFloorState();
    const theme = floor?.factionTheme ?? 'cyberacme';
    const condition = floor?.sectorCondition ?? 'NOMINAL';
    lightingSystem.setEnvironmentTheme(theme, condition);
    if (theme && theme !== lastAppliedTheme) {
      lastAppliedTheme = theme;
      Promise.resolve(loadThemedAssets(theme))
        .then(() => {
          if (!lightingDestroyed) {
            refreshEntitySpriteTextures();
            lastTilemapKey = '';
            if (hasRenderedLightingFrame && onThemeLoadedRefresh && world.entityExists(getPlayerEntity())) {
              onThemeLoadedRefresh();
            }
          }
        })
        .catch(() => {
          // Graceful fallback in mocked test / offline environments
        });
    }
  };

  const syncDynamicEntityLights = (
    playerEntity: EntityId,
    extendedSightVisionRadius: number | null,
    fovSet: Set<string>,
  ) => {
    const heat = world.getComponent(playerEntity, Heat);
    const stability = world.getComponent(playerEntity, Stability);
    const pLight = world.getComponent(playerEntity, LightSource);

    if (pLight) {
      const heatVal = heat?.current ?? 0;
      const stabVal = stability?.current ?? 100;

      let nextColor = pLight.color;
      let nextIntensity = pLight.intensity;
      let nextRadius = pLight.radius;
      let nextHeight = pLight.height;
      let nextAnim = pLight.animation
        ? { ...pLight.animation }
        : { type: 'STATIC' as const, speed: 2, amplitude: 0.2 };

      // Spec §5.3.A.3: Extended_Sight.sys expands radius to visionRadius * TILE_SIZE & boosts height to 28px
      if (extendedSightVisionRadius !== null && extendedSightVisionRadius > 0) {
        nextRadius = Math.min(512, Math.max(nextRadius, extendedSightVisionRadius * TILE_SIZE));
        nextHeight = Math.max(nextHeight, 28);
      }

      // Spec §5.3.A.1: Neural Heat Shift (0-60% Nominal, 61-99% smooth amber pulse, >=100% crimson/UV flicker)
      if (heatVal >= 100) {
        nextColor = '#ff0055';
        nextIntensity = Math.min(5, pLight.intensity * 1.25);
        nextAnim = { type: 'FLICKER', speed: 14.0, amplitude: 0.45, secondaryColor: '#a855f7' };
      } else if (heatVal >= 61) {
        const heatT = Math.max(0, Math.min(1, (heatVal - 60) / 40));
        nextColor = lerpHexColor(pLight.color, '#ff9500', heatT);
        nextIntensity = Math.min(5, pLight.intensity * (1 + 0.15 * heatT));
        nextAnim = { type: 'PULSE', speed: 3.0, amplitude: 0.15 };
      }

      // Spec §5.3.A.2: Reality Stability Drain (<50% contracts radius mix(0.75, 1.0, stability/50) + UV pulse)
      if (stabVal < 50) {
        const stabT = Math.max(0, Math.min(1, stabVal / 50));
        nextRadius = Math.max(32, Math.round(nextRadius * (0.75 + 0.25 * stabT)));
        if (heatVal < 61) {
          nextAnim = { type: 'PULSE', speed: 1.5, amplitude: 0.25, secondaryColor: '#a855f7' };
        } else if (heatVal < 100) {
          nextAnim = { ...nextAnim, secondaryColor: '#a855f7' };
        }
      }

      dynamicLightOverrides.set(playerEntity, {
        ...pLight,
        color: nextColor,
        intensity: nextIntensity,
        radius: nextRadius,
        height: nextHeight,
        animation: nextAnim,
      });
    } else {
      dynamicLightOverrides.delete(playerEntity);
    }

    // Sync prop lights with safe / locked / corrupted / searched state (strictly read-only on World,
    // using client-remembered memory when outside active FOV for U1 anti-cheat compliance)
    for (const propId of world.query(Prop, LightSource)) {
      const prop = world.getComponent(propId, Prop)!;
      const base = world.getComponent(propId, LightSource)!;
      const pos = world.getComponent(propId, Position);
      const inFov = isMapRevealed || (pos ? fovSet.has(`${pos.x},${pos.y}`) : false);

      let isSearched = false;
      let isLocked = false;
      let isCorruptedActive = false;

      if (inFov) {
        const secLock = world.getComponent(propId, SecurityLock);
        const corrupted = world.getComponent(propId, CorruptedNode);
        isSearched = Boolean(prop.isSearched);
        isLocked = Boolean(secLock?.isLocked);
        isCorruptedActive = Boolean(
          corrupted?.revealed && !corrupted.isDisarmed && !corrupted.triggered,
        );
      } else {
        const mem = rememberedProps.get(propId);
        if (!mem) {
          dynamicLightOverrides.delete(propId);
          continue;
        }
        isSearched = Boolean(mem.isSearched);
        isLocked = Boolean(mem.isLocked);
        isCorruptedActive = Boolean(
          mem.corruptedRevealed && !mem.corruptedDisarmed && !mem.corruptedTriggered,
        );
      }

      let targetColor = base.color;
      let targetIntensity = base.intensity;
      let targetCastsShadows = base.castsShadows;
      let targetAnim = base.animation
        ? { ...base.animation }
        : { type: 'STATIC' as const, speed: 2, amplitude: 0.2 };

      if (isSearched) {
        targetIntensity = Number((base.intensity * 0.15).toFixed(3));
        targetCastsShadows = false;
        targetAnim = { type: 'STATIC', speed: 1, amplitude: 0.1 };
      } else if (isCorruptedActive) {
        targetColor = '#ff0055';
        targetAnim = { type: 'FLICKER', speed: 12.0, amplitude: 0.4 };
      } else if (isLocked) {
        targetColor = '#ff9500';
        targetAnim = { type: 'PULSE', speed: 1.5, amplitude: 0.3 };
      }

      dynamicLightOverrides.set(propId, {
        ...base,
        color: targetColor,
        intensity: targetIntensity,
        castsShadows: targetCastsShadows,
        animation: targetAnim,
      });
    }
  };

  const latestStageTimings: RenderStageTimings = {
    fovMs: 0,
    tilemapMs: 0,
    spriteSyncMs: 0,
    vfxMs: 0,
    hoverMs: 0,
    totalCpuMs: 0,
  };

  const isEntityInFov = (entityId: EntityId): boolean => {
    if (entityId === getPlayerEntity()) return true;
    if (currentFovSet.size === 0 || isMapRevealed) return true;
    const pos = world.getComponent(entityId, Position);
    if (!pos) return false;
    return currentFovSet.has(`${pos.x},${pos.y}`);
  };

  const syncPropOutline = (entityId: EntityId, targetSprite?: Sprite) => {
    if (devFlags.disableSpriteFilters) return;
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
      if (elem.closest && elem.closest('[data-perf-monitor="true"]')) {
        gameStore.getState().setHoveredEntity(null);
        return;
      }

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

  const attachEntityParticles = (entityId: EntityId, sprite: Sprite, spriteKey?: string) => {
    if (devFlags.disableParticles) return;
    const aiState = world.getComponent(entityId, AIState);
    if (aiState) {
      particleSystem.attachBehaviorEmitter(sprite, aiState.behaviorType, layers.effectsLayer);
    }
    if (spriteKey) {
      particleSystem.attachPropEmitter(sprite, spriteKey, layers.effectsLayer);
    }
  };

  const handleEntityCreated = (payload: { entityId: EntityId }) => {
    const spriteComp = world.getComponent(payload.entityId, SpriteComponent);
    if (spriteComp) {
      const sprite = createEntitySprite(payload.entityId, spriteComp.key, layers.entityLayer);
      spriteAnimator.registerEntity(payload.entityId, spriteComp);

      // Apply persistent glitch for enemies
      const aiState = world.getComponent(payload.entityId, AIState);
      if (aiState) {
        if (!devFlags.disableSpriteFilters) {
          applyPersistentGlitch(sprite, aiState.behaviorType);
        }
      }
      attachEntityParticles(payload.entityId, sprite, spriteComp.key);

      // Apply client-visible prop outline for interactive props
      syncPropOutline(payload.entityId, sprite);
    }
  };

  const handlePropUpdated = (payload: { propId: number }) => {
    lastFovKey = '';
    lastTilemapKey = '';
    const entityId = payload.propId;
    if (entityId) {
      const spriteComp = world.getComponent(entityId, SpriteComponent);
      let sprite = getEntitySprite(entityId);
      if (spriteComp) {
        sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        spriteAnimator.registerEntity(entityId, spriteComp);
      }
      if (sprite) {
        attachEntityParticles(entityId, sprite, spriteComp?.key);
      }
      const inFov = isEntityInFov(entityId);
      if (inFov) {
        spriteAnimator.triggerState(entityId, 'interact');
      }
      syncPropOutline(entityId);
      const pos = world.getComponent(entityId, Position);
      if (pos && (isMapRevealed || currentFovSet.has(`${pos.x},${pos.y}`))) {
        recordPropMemory(entityId);
      }
      if (!devFlags.disableParticles && inFov && pos && spriteComp) {
        const wx = pos.x * TILE_SIZE + TILE_SIZE * 0.5;
        const wy = pos.y * TILE_SIZE + TILE_SIZE * 0.5;
        if (spriteComp.key.includes('cryo_vat')) {
          particleSystem.emitCryoSpillBurst(wx, wy, layers.effectsLayer);
          lightingSystem.spawnTransientLight({
            worldX: wx,
            worldY: wy,
            color: '#10b981',
            intensity: 1.9,
            radiusPx: 140,
            durationMs: 1400,
            castsShadows: false,
          });
        } else if (spriteComp.key.includes('capacitor')) {
          particleSystem.emitEmpArcBurst(wx, wy, layers.effectsLayer);
          lightingSystem.spawnTransientLight({
            worldX: wx,
            worldY: wy,
            color: '#00f0ff',
            intensity: 2.5,
            radiusPx: 160,
            durationMs: 280,
            castsShadows: false,
          });
        }
      }
    }
  };

  const handleEntityDestroyed = (payload: { entityId: EntityId }) => {
    dynamicLightOverrides.delete(payload.entityId);
    const sprite = getEntitySprite(payload.entityId);
    if (sprite) {
      spriteAnimator.triggerState(payload.entityId, 'death');
      particleSystem.cleanupEmitter(sprite);
      const aiState = world.getComponent(payload.entityId, AIState);
      if (aiState) {
        queueTypedDeathAnimation(payload.entityId, aiState.behaviorType, sprite, () => {
          destroyEntitySprite(payload.entityId);
          spriteAnimator.unregisterEntity(payload.entityId);
        });
      } else {
        queueDeathAnimation(payload.entityId, () => {
          destroyEntitySprite(payload.entityId);
          spriteAnimator.unregisterEntity(payload.entityId);
        });
      }
    } else {
      spriteAnimator.unregisterEntity(payload.entityId);
    }
  };

  const handleItemPickedUp = (payload: { entityId?: EntityId; itemId: EntityId }) => {
    lastFovKey = '';
    lastTilemapKey = '';
    destroyEntitySprite(payload.itemId);
    spriteAnimator.unregisterEntity(payload.itemId);
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

    if (payload.attackerId && isEntityInFov(payload.attackerId)) {
      spriteAnimator.triggerState(payload.attackerId, 'attack');
    }
    if (isEntityInFov(payload.defenderId)) {
      spriteAnimator.triggerState(payload.defenderId, 'hit');
    }

    const sprite = getEntitySprite(payload.defenderId);
    if (sprite) {
      applyDamageDistortion(sprite);

      // Spawn floating code leak for enemies
      const aiState = world.getComponent(payload.defenderId, AIState);
      if (aiState) {
        spawnDamageText(sprite.x + TILE_SIZE / 2, sprite.y + TILE_SIZE / 2, layers.effectsLayer);
      }
    }

    // Trigger melee bump animation if attacker is adjacent & directional impact spark burst
    const defenderPos = world.getComponent(payload.defenderId, Position);
    const attackerPos = payload.attackerId
      ? world.getComponent(payload.attackerId, Position)
      : undefined;
    if (!devFlags.disableParticles && defenderPos && (isEntityInFov(payload.defenderId) || payload.defenderId === getPlayerEntity())) {
      const wx = defenderPos.x * TILE_SIZE + TILE_SIZE * 0.5;
      const wy = defenderPos.y * TILE_SIZE + TILE_SIZE * 0.5;
      const impactAngle =
        attackerPos !== undefined
          ? Math.atan2(defenderPos.y - attackerPos.y, defenderPos.x - attackerPos.x)
          : -Math.PI * 0.5;
      particleSystem.emitDamageBurst(wx, wy, impactAngle, layers.effectsLayer);
      lightingSystem.spawnTransientLight({
        worldX: wx,
        worldY: wy,
        color: '#ffaa33',
        intensity: 2.2,
        radiusPx: 96,
        durationMs: 120,
        castsShadows: false,
      });
    }

    if (payload.attackerId && attackerPos && defenderPos) {
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
        // Record predicted player movement and queue visual tween + step animation
        spriteAnimator.triggerState(payload.entityId, 'move');
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
        // If this server event confirms our predicted move, skip duplicate tween and duplicate anim
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
        spriteAnimator.triggerState(payload.entityId, 'move');
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

    // For all other entities (enemies, NPCs): only trigger move animation clip if in FOV
    const inFov =
      currentFovSet.size === 0 ||
      isMapRevealed ||
      currentFovSet.has(`${payload.toX},${payload.toY}`) ||
      currentFovSet.has(`${payload.fromX},${payload.fromY}`);
    if (inFov) {
      spriteAnimator.triggerState(payload.entityId, 'move');
    }
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
    if (devFlags.disableWorldFilters) return;
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
    if (devFlags.disableWorldFilters) return;
    applyStabilityDesaturation(layers.worldContainer, payload.newValue);
  };

  const handleHeatChanged = (payload: { entityId: EntityId; newHeat: number; maxSafe: number }) => {
    if (payload.entityId === getPlayerEntity()) {
      const tier = getHeatTier(payload.newHeat);
      if (!devFlags.disableWorldFilters) {
        applyHeatTierFilters(layers.worldContainer, tier.tier);
      }

      const sprite = getEntitySprite(payload.entityId);
      if (sprite && !devFlags.disableSpriteFilters) {
        updateSpriteGhosting(sprite, tier.tier, layers.entityLayer);
      }
    }
  };

  const handleFirmwareActivated = (payload: {
    entityId?: EntityId;
    abilityName?: string;
    targetX?: number;
    targetY?: number;
  }) => {
    if (payload.entityId && isEntityInFov(payload.entityId)) {
      spriteAnimator.triggerState(payload.entityId, 'attack');
    }
    if (payload.entityId !== undefined) {
      const pos = world.getComponent(payload.entityId, Position);
      const targetValid =
        typeof payload.targetX === 'number' && typeof payload.targetY === 'number';
      const burstX = (targetValid ? payload.targetX! : (pos?.x ?? 0)) * TILE_SIZE + TILE_SIZE * 0.5;
      const burstY = (targetValid ? payload.targetY! : (pos?.y ?? 0)) * TILE_SIZE + TILE_SIZE * 0.5;
      if (!devFlags.disableParticles && (pos || targetValid)) {
        particleSystem.emitFirmwareBurst(burstX, burstY, payload.abilityName, layers.effectsLayer);
      }
      if (payload.abilityName === 'GHOST_PULSE.exe' && pos) {
        lightingSystem.spawnTransientLight({
          worldX: pos.x * TILE_SIZE + TILE_SIZE * 0.5,
          worldY: pos.y * TILE_SIZE + TILE_SIZE * 0.5,
          color: '#00f0ff',
          intensity: 2.8,
          startRadiusPx: 32,
          radiusPx: 320,
          durationMs: 650,
          castsShadows: false,
        });
      }
    }
  };

  const handleVentCompleted = (payload: { entityId: EntityId }) => {
    if (devFlags.disableParticles) return;
    if (!isEntityInFov(payload.entityId) && payload.entityId !== getPlayerEntity()) return;
    const pos = world.getComponent(payload.entityId, Position);
    if (!pos) return;
    const wx = pos.x * TILE_SIZE + TILE_SIZE * 0.5;
    const wy = pos.y * TILE_SIZE + TILE_SIZE * 0.5;
    particleSystem.emitVentBurst(wx, wy, layers.effectsLayer);
    lightingSystem.spawnTransientLight({
      worldX: wx,
      worldY: wy,
      color: '#ff6b2b',
      intensity: 2.1,
      radiusPx: 128,
      durationMs: 260,
      castsShadows: false,
    });
  };

  const handleEnemyTeleported = (payload: { entityId?: EntityId }) => {
    if (payload.entityId && isEntityInFov(payload.entityId)) {
      spriteAnimator.triggerState(payload.entityId, 'move');
    }
  };

  const updateCameraFrame = (ticker: Ticker) => {
    const deltaMs = ticker.deltaMS;
    const tVfx0 = devFlags.measureTimings ? performance.now() : 0;
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

    // Sprite Animator tick for real-time ambient and one-shot sprite frames
    spriteAnimator.tick(
      deltaMs,
      currentFovSet,
      (id) => world.getComponent(id, Position),
      getEntitySprite,
    );

    // Update visual systems
    if (!devFlags.disableParticles) {
      particleSystem.update(deltaMs);
    }
    updateDamageTexts(deltaMs);

    if (hasRenderedLightingFrame && !lightingDestroyed && !devFlags.disableDeferredLighting) {
      const gridForLight = getGrid();
      const particleInputs = devFlags.disableParticles
        ? { particles: [], microLights: [] }
        : particleSystem.getLightingInputs(layers.worldContainer.x, layers.worldContainer.y, cameraZoom);
      const existingFilters = Array.isArray(layers.worldContainer.filters)
        ? layers.worldContainer.filters.filter(
            (f) => f && !f.constructor?.name?.includes('DeferredLight') && !f.constructor?.name?.includes('SelectiveBloom'),
          )
        : [];
      lightingSystem.update({
        world,
        worldContainer: layers.worldContainer,
        terrainLayer: layers.terrainLayer,
        itemLayer: layers.itemLayer,
        entityLayer: layers.entityLayer,
        renderer: app.renderer,
        spriteMap: getEntitySprites(),
        fovSet: currentFovSet,
        exploredSet,
        gridWidth: gridForLight.width,
        gridHeight: gridForLight.height,
        deltaMs,
        enabled: true,
        particles: particleInputs.particles,
        microLights: particleInputs.microLights,
        extraPrimaryLights: lastExtraPrimaryLights,
        worldScreenFilters: devFlags.disableWorldFilters ? [] : existingFilters,
        playerEntityId: getPlayerEntity(),
        lightOverrides: dynamicLightOverrides,
      });
    }

    if (devFlags.measureTimings) {
      latestStageTimings.vfxMs = performance.now() - tVfx0;
    }
  };

  const handleDungeonGenerated = () => {
    lastFovKey = '';
    lastTilemapKey = '';
    system.onDungeonGenerated();
  };

  const handleStateReconciled = () => {
    lastFovKey = '';
    lastTilemapKey = '';
    system.reconcileSprites();
  };

  const system = {
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
      eventBus.on('FIRMWARE_ACTIVATED', handleFirmwareActivated);
      eventBus.on('VENT_COMPLETED', handleVentCompleted);
      eventBus.on('ENEMY_TELEPORTED', handleEnemyTeleported);
      eventBus.on('DEBUG_REVEAL_MAP', handleDebugRevealMap);
      eventBus.on('DEBUG_TOGGLE_AI', handleDebugToggleAI);
      eventBus.on('RECENTER_CAMERA', handleRecenterCamera);
      eventBus.on('DUNGEON_GENERATED', handleDungeonGenerated);
      eventBus.on('STATE_RECONCILED', handleStateReconciled);

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
        spriteAnimator.registerEntity(entityId, spriteComp);
        applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);

        const aiState = world.getComponent(entityId, AIState);
        if (aiState && !devFlags.disableSpriteFilters) {
          applyPersistentGlitch(sprite, aiState.behaviorType);
        }
        attachEntityParticles(entityId, sprite, spriteComp.key);

        syncPropOutline(entityId, sprite);
      }

      // Initial render pass to populate viewport, FOV, and textures
      onThemeLoadedRefresh = () => this.renderSystem();
      this.renderSystem();
    },

    reconcileSprites() {
      const activeEntities = new Set(world.query(SpriteComponent, Position));
      const purged = purgeOrphanedSprites(activeEntities);
      for (const id of purged) {
        spriteAnimator.unregisterEntity(id);
      }

      // Instantiate sprites for any active entity missing its sprite and refresh prop outlines
      for (const entityId of activeEntities) {
        let sprite = getEntitySprite(entityId);
        const spriteComp = world.getComponent(entityId, SpriteComponent);
        if (spriteComp) {
          spriteAnimator.registerEntity(entityId, spriteComp);
        }
        if (!sprite) {
          const pos = world.getComponent(entityId, Position);
          if (spriteComp) {
            sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
            if (pos) {
              const orientation = world.getComponent(entityId, TileOrientation);
              applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);
            }
            const aiState = world.getComponent(entityId, AIState);
            if (aiState && !devFlags.disableSpriteFilters) {
              applyPersistentGlitch(sprite, aiState.behaviorType);
            }
            attachEntityParticles(entityId, sprite, spriteComp.key);
          }
        } else if (spriteComp) {
          createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
          attachEntityParticles(entityId, sprite, spriteComp.key);
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
      const tFov0 = devFlags.measureTimings ? performance.now() : 0;
      let effectiveRadius = FOV_RADIUS;
      const floorState = resolveActiveFloorState();
      if (floorState?.sectorCondition === 'DARK_SUBNET') {
        effectiveRadius = Math.max(2, effectiveRadius - 2);
      }
      let extendedSightVisionRadius: number | null = null;
      const fSlots = world.getComponent(playerEntity, FirmwareSlots);
      if (fSlots) {
        for (const firmwareId of fSlots.equipped) {
          const abilityDef = world.getComponent(firmwareId, AbilityDef);
          if (abilityDef && abilityDef.effectType === 'toggle_vision' && abilityDef.isActive) {
            effectiveRadius = Math.max(effectiveRadius, abilityDef.visionRadius);
            extendedSightVisionRadius = Math.max(
              extendedSightVisionRadius ?? 0,
              abilityDef.visionRadius,
            );
          }
        }
      }

      let fovSet: Set<string>;
      const fovKey = `${playerPos.x},${playerPos.y},${effectiveRadius},${floorState?.sectorCondition ?? ''},${isMapRevealed}`;

      if (devFlags.cacheStaticFov && lastFovKey === fovKey && lastFovResult) {
        fovSet = lastFovResult;
      } else {
        fovSet = computeFov(
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

        lastFovKey = fovKey;
        lastFovResult = fovSet;
        const gridForFov = getGrid();
        lightingSystem.updateFovMask(gridForFov.width, gridForFov.height, fovSet, exploredSet);
        eventBus.emit('FOV_UPDATED', { visibleSet: fovSet });
      }

      if (devFlags.measureTimings) {
        latestStageTimings.fovMs = performance.now() - tFov0;
      }

      // 1.5. Targeting UI Rendering
      const storeState = gameStore.getState();
      targetingCursor.clear();
      if (storeState.targetingActive) {
        const tx = storeState.targetingX * TILE_SIZE;
        const ty = storeState.targetingY * TILE_SIZE;

        // Render range indicator (pulsing ring)
        if (storeState.targetingRange > 0) {
          targetingCursor
            .circle(
              playerPos.x * TILE_SIZE + TILE_SIZE / 2,
              playerPos.y * TILE_SIZE + TILE_SIZE / 2,
              storeState.targetingRange * TILE_SIZE,
            )
            .stroke({ width: 2, color: 0x00ffff, alpha: 0.3 });
        }

        // Render target tile highlight
        targetingCursor
          .rect(tx, ty, TILE_SIZE, TILE_SIZE)
          .fill({ color: 0x00ffff, alpha: 0.2 })
          .stroke({ width: 2, color: 0x00ffff, alpha: 0.8 });

        // Corner brackets for "hacking" aesthetic
        const margin = 4;
        const len = 8;

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

        targetingCursor.stroke({ width: 2, color: 0x00ffff, alpha: 1.0 });
      }

      // 2. Camera
      const baseTarget = computeCameraTarget(playerPos.x, playerPos.y, cameraZoom);
      cameraTarget = {
        x: baseTarget.x + cameraPanOffset.x,
        y: baseTarget.y + cameraPanOffset.y,
      };

      // 3. Tilemap
      const tTile0 = devFlags.measureTimings ? performance.now() : 0;
      const visibleRange = getVisibleTileRange(layers.worldContainer.x, layers.worldContainer.y, cameraZoom);
      const tilemapKey = `${visibleRange.startX},${visibleRange.startY},${visibleRange.endX},${visibleRange.endY},${cameraZoom},${playerPos.x},${playerPos.y},${fovSet.size}`;

      if (!devFlags.cacheStaticTilemap || lastTilemapKey !== tilemapKey) {
        buildTilemap(getGrid(), layers.terrainLayer, {
          visibleRange,
          fovSet,
          exploredSet,
          playerPos,
        });
        lastTilemapKey = tilemapKey;
      } else {
        resetAutotileSolveCount();
      }

      if (devFlags.measureTimings) {
        latestStageTimings.tilemapMs = performance.now() - tTile0;
      }

      // 4. Entity Sprites Sync & Visibility
      const tSprite0 = devFlags.measureTimings ? performance.now() : 0;

      // Refresh dynamic prop outlines if state has changed
      if (!devFlags.disableSpriteFilters) {
        const props = world.query(Prop);
        for (const propId of props) {
          const outlineState = resolvePropOutlineState(world, propId) ?? 'none';
          if (lastPropOutlineState.get(propId) !== outlineState) {
            lastPropOutlineState.set(propId, outlineState);
            syncPropOutline(propId);
          }
        }
      }

      // 4. Entity Sprites Sync & Visibility
      const renderables = world.query(SpriteComponent, Position);
      let playerSprite: Sprite | null = null;
      for (const entityId of renderables) {
        let sprite = getEntitySprite(entityId);

        // Lazy sprite creation or texture sync
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        spriteAnimator.registerEntity(entityId, spriteComp);

        const pos = world.getComponent(entityId, Position)!;
        const actor = world.getComponent(entityId, Actor);
        const orientation = world.getComponent(entityId, TileOrientation);

        // Visibility gating
        const entityType = getEntityVisibilityType(actor?.isPlayer, !!actor);
        let { visible, alpha } = isEntityVisible(pos, entityType, fovSet, exploredSet);

        // Resolve component-derived ambient state
        let ambientState: AnimationStateKey = 'idle';
        const propComp = world.getComponent(entityId, Prop);
        const inFov = entityType === 'player' || isMapRevealed || fovSet.has(`${pos.x},${pos.y}`);

        if (propComp) {
          if (inFov) {
            const secLock = world.getComponent(entityId, SecurityLock);
            const corrupted = world.getComponent(entityId, CorruptedNode);
            if (propComp.isSearched) {
              ambientState = 'searched';
            } else if (secLock?.isLocked) {
              ambientState = 'locked';
            } else if (corrupted?.revealed && !corrupted?.isDisarmed) {
              ambientState = 'corrupted';
            } else if (spriteComp.initialState) {
              ambientState = spriteComp.initialState;
            }
          } else {
            // Out of FOV (fog of war): strictly use remembered client memory
            const mem = rememberedProps.get(entityId);
            if (mem) {
              if (mem.isSearched) {
                ambientState = 'searched';
              } else if (mem.isLocked) {
                ambientState = 'locked';
              } else if (mem.corruptedRevealed && !mem.corruptedDisarmed) {
                ambientState = 'corrupted';
              } else if (spriteComp.initialState) {
                ambientState = spriteComp.initialState;
              }
            } else if (spriteComp.initialState) {
              ambientState = spriteComp.initialState;
            }
          }
        } else if (spriteComp.initialState) {
          ambientState = spriteComp.initialState;
        }

        spriteAnimator.setAmbientState(entityId, ambientState);

        // Update position if not animating
        if (!hasActiveAnimation(entityId)) {
          applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);
        }

        // FORCE PLAYER VISIBLE FOR DEBUGGING
        if (entityType === 'player') {
          visible = true;
          alpha = 1.0;
          playerSprite = sprite;
        }

        const isSearched = inFov ? Boolean(propComp?.isSearched) : Boolean(rememberedProps.get(entityId)?.isSearched);
        if (isSearched) {
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

      // 4.5. Deferred Lighting Pipeline Sync (LIGHT-04)
      syncEnvironmentTheme();
      syncDynamicEntityLights(playerEntity, extendedSightVisionRadius, fovSet);

      const gridForLight = getGrid();
      const extraPrimaryLights: RenderLightDescriptor[] = [];
      const activeFloor = resolveActiveFloorState();
      if (activeFloor?.sectorCondition === 'DARK_SUBNET') {
        const elapsedSec = performance.now() * 0.001;
        const cycle = elapsedSec % 3.0;
        if (cycle < 0.75) {
          const pulseAlpha = Math.sin((cycle / 0.75) * Math.PI);
          const camX = layers.worldContainer.x ?? 0;
          const camY = layers.worldContainer.y ?? 0;
          for (const propId of world.query(Prop, Position)) {
            const p = world.getComponent(propId, Prop);
            const pPos = world.getComponent(propId, Position);
            if (!p || p.isSearched || !pPos) continue;
            extraPrimaryLights.push({
              screenX: (pPos.x * TILE_SIZE + TILE_SIZE * 0.5) * cameraZoom + camX,
              screenY: (pPos.y * TILE_SIZE + TILE_SIZE * 0.5) * cameraZoom + camY,
              radiusPx: 48,
              intensity: 1.45 * pulseAlpha,
              colorRgb: [0.0, 0.94, 1.0],
              heightPx: 14,
              falloff: 1.5,
              castsShadows: false,
              isBeaconPing: true,
            });
          }
        }
      }

      const existingContainerFilters = Array.isArray(layers.worldContainer.filters)
        ? layers.worldContainer.filters.filter(
            (f) => f && !f.constructor?.name?.includes('DeferredLight') && !f.constructor?.name?.includes('SelectiveBloom'),
          )
        : [];

      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dtLightMs = lastLightingSyncMs > 0 ? Math.min(100, Math.max(1, nowMs - lastLightingSyncMs)) : 16.67;
      lastLightingSyncMs = nowMs;

      lastExtraPrimaryLights = extraPrimaryLights;
      hasRenderedLightingFrame = true;
      const particleInputs = devFlags.disableParticles
        ? { particles: [], microLights: [] }
        : particleSystem.getLightingInputs(layers.worldContainer.x, layers.worldContainer.y, cameraZoom);

      lightingSystem.update({
        world,
        worldContainer: layers.worldContainer,
        terrainLayer: layers.terrainLayer,
        itemLayer: layers.itemLayer,
        entityLayer: layers.entityLayer,
        renderer: app.renderer,
        spriteMap: getEntitySprites(),
        fovSet,
        exploredSet,
        gridWidth: gridForLight.width,
        gridHeight: gridForLight.height,
        deltaMs: dtLightMs,
        enabled: !devFlags.disableDeferredLighting,
        particles: particleInputs.particles,
        microLights: particleInputs.microLights,
        extraPrimaryLights,
        worldScreenFilters: devFlags.disableWorldFilters ? [] : existingContainerFilters,
        playerEntityId: playerEntity,
        lightOverrides: dynamicLightOverrides,
      });

      if (devFlags.measureTimings) {
        latestStageTimings.spriteSyncMs = performance.now() - tSprite0;
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
          const tHover0 = devFlags.measureTimings ? performance.now() : 0;
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
          if (devFlags.measureTimings) {
            latestStageTimings.hoverMs = performance.now() - tHover0;
          }
        } else if (devFlags.measureTimings) {
          latestStageTimings.hoverMs = 0;
        }
      } else if (devFlags.measureTimings) {
        latestStageTimings.hoverMs = 0;
      }

      if (devFlags.measureTimings) {
        latestStageTimings.totalCpuMs =
          latestStageTimings.fovMs +
          latestStageTimings.tilemapMs +
          latestStageTimings.spriteSyncMs +
          latestStageTimings.vfxMs +
          latestStageTimings.hoverMs;
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
      dynamicLightOverrides.clear();
      lastHoverCheckState = null;
      lightingSystem.clearTransientLights();
      syncEnvironmentTheme();
      lastFovKey = null;
      lastFovResult = null;
      lastTilemapKey = null;
      isMapRevealed = false;
      cachedDijkstraMap = null;
      lastDijkstraPlayerPos = null;
      clearExplored(exploredSet);
      rememberedProps.clear();
      rememberedTileItems.clear();
      clearTilemap(layers.terrainLayer);
      clearAnimations();
      spriteAnimator.clear();
      clearAllSprites();

      // Snap camera to player on new dungeon
      const playerEntity = getPlayerEntity();
      const playerPos = world.getComponent(playerEntity, Position);
      if (playerPos) {
        cameraTarget = computeCameraTarget(playerPos.x, playerPos.y, cameraZoom);
        layers.worldContainer.x = cameraTarget.x;
        layers.worldContainer.y = cameraTarget.y;
      }

      // Ensure emitters and glitch filters are attached to enemies & props on re-init
      hasRenderedLightingFrame = false;
      particleSystem.disposeAllEmitters();
      const entities = world.query(SpriteComponent, Position);
      for (const entityId of entities) {
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        const pos = world.getComponent(entityId, Position)!;
        const orientation = world.getComponent(entityId, TileOrientation);
        const sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        spriteAnimator.registerEntity(entityId, spriteComp);
        applySpriteTransform(sprite, pos.x, pos.y, orientation?.angleDegrees ?? 0);

        const aiState = world.getComponent(entityId, AIState);
        if (aiState && !devFlags.disableSpriteFilters) {
          applyPersistentGlitch(sprite, aiState.behaviorType);
        }
        attachEntityParticles(entityId, sprite, spriteComp.key);
        syncPropOutline(entityId, sprite);
      }

      this.renderSystem();
    },

    destroy() {
      eventBus.off('ENTITY_CREATED', handleEntityCreated);
      eventBus.off('ENTITY_DESTROYED', handleEntityDestroyed);
      eventBus.off('ITEM_PICKED_UP', handleItemPickedUp);
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('DAMAGE_DEALT', handleDamageDealt);
      eventBus.off('APPLY_WORLD_FILTER', handleApplyWorldFilter);
      eventBus.off('REMOVE_WORLD_FILTER', handleRemoveWorldFilter);
      eventBus.off('STABILITY_CHANGED', handleStabilityChanged);
      eventBus.off('HEAT_CHANGED', handleHeatChanged);
      eventBus.off('PROP_INTERACTED', handlePropUpdated);
      eventBus.off('LOCK_UNLOCKED', handlePropUpdated);
      eventBus.off('FIRMWARE_ACTIVATED', handleFirmwareActivated);
      eventBus.off('VENT_COMPLETED', handleVentCompleted);
      eventBus.off('ENEMY_TELEPORTED', handleEnemyTeleported);
      eventBus.off('DEBUG_REVEAL_MAP', handleDebugRevealMap);
      eventBus.off('DEBUG_TOGGLE_AI', handleDebugToggleAI);
      eventBus.off('RECENTER_CAMERA', handleRecenterCamera);
      eventBus.off('DUNGEON_GENERATED', handleDungeonGenerated);
      eventBus.off('STATE_RECONCILED', handleStateReconciled);

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
      dynamicLightOverrides.clear();
      lastHoverCheckState = null;
      lightingSystem.clearTransientLights();
      syncEnvironmentTheme();
      clearAllSprites();
      clearAnimations();
      spriteAnimator.clear();
      disposeScreenEffects();
      disposeHeatEffects();
      particleSystem.destroy();
      disposeDamageTexts();
      lightingDestroyed = true;
      hasRenderedLightingFrame = false;
      onThemeLoadedRefresh = null;
      lightingSystem.destroy();
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

    getStageTimings(): Readonly<RenderStageTimings> {
      return latestStageTimings;
    },

    getRenderTelemetry(): RenderTelemetry {
      const glitchTelemetry = getFilterTelemetry();
      const worldFilters = layers.worldContainer.filters;
      const worldFiltersCount = Array.isArray(worldFilters)
        ? worldFilters.length
        : worldFilters
          ? 1
          : 0;

      return {
        stageTimings: { ...latestStageTimings },
        tilemap: getTilemapTelemetry(),
        particles: particleSystem.getTelemetry(),
        filters: {
          ...glitchTelemetry,
          worldFiltersCount,
        },
        sprites: getSpriteTelemetry(),
        activeAnimations: getActiveAnimationCount(),
        activeDamageTexts: getActiveDamageTextCount(),
        fovTiles: currentFovSet.size,
        exploredTiles: exploredSet.size,
        rememberedPropsCount: rememberedProps.size,
        rememberedItemsCount: rememberedTileItems.size,
        lighting: lightingSystem.getTelemetry(),
      };
    },

    getEffectiveEntityLight(entityId: EntityId): LightSourceData | undefined {
      return dynamicLightOverrides.get(entityId) ?? world.getComponent(entityId, LightSource);
    },

    setDevRenderFlags(flags: Partial<DevRenderBisectionFlags>) {
      devFlags = { ...devFlags, ...flags };
      if (devFlags.disableSpriteFilters) {
        for (const entityId of world.query(SpriteComponent)) {
          const sprite = getEntitySprite(entityId);
          if (sprite) {
            removePersistentGlitch(sprite);
          }
        }
        lastPropOutlineState.clear();
        const playerSprite = getEntitySprite(getPlayerEntity());
        if (playerSprite) {
          updateSpriteGhosting(playerSprite, 0, layers.entityLayer);
        }
      } else if (flags.disableSpriteFilters === false) {
        for (const entityId of world.query(SpriteComponent)) {
          const sprite = getEntitySprite(entityId);
          if (sprite) {
            syncPropOutline(entityId, sprite);
            const ai = world.getComponent(entityId, AIState);
            if (ai) {
              applyPersistentGlitch(sprite, ai.behaviorType);
            }
          }
        }
        const playerSprite = getEntitySprite(getPlayerEntity());
        const heat = world.getComponent(getPlayerEntity(), Heat);
        if (playerSprite && heat) {
          const tier = getHeatTier(heat.current);
          updateSpriteGhosting(playerSprite, tier.tier, layers.entityLayer);
        }
      }

      if (devFlags.disableWorldFilters) {
        removeFiltersFromContainer(layers.worldContainer);
      } else if (flags.disableWorldFilters === false) {
        const playerId = getPlayerEntity();
        if (playerId) {
          const stability = world.getComponent(playerId, Stability);
          if (stability) {
            applyStabilityDesaturation(layers.worldContainer, stability.current);
          }
          const heat = world.getComponent(playerId, Heat);
          if (heat) {
            const tier = getHeatTier(heat.current);
            applyHeatTierFilters(layers.worldContainer, tier.tier);
          }
        }
      }

      if (flags.disableParticles !== undefined) {
        layers.effectsLayer.visible = !devFlags.disableParticles;
      }

      if (flags.cacheStaticTilemap === false) {
        lastTilemapKey = '';
      }

      if (flags.cacheStaticFov === false) {
        lastFovKey = '';
      }

      if (flags.disableDeferredLighting !== undefined) {
        if (devFlags.disableDeferredLighting) {
          lightingSystem.update({
            world,
            worldContainer: layers.worldContainer,
            terrainLayer: layers.terrainLayer,
            itemLayer: layers.itemLayer,
            entityLayer: layers.entityLayer,
            renderer: app.renderer,
            spriteMap: getEntitySprites(),
            gridWidth: getGrid().width,
            gridHeight: getGrid().height,
            deltaMs: 0,
            enabled: false,
            worldScreenFilters: devFlags.disableWorldFilters
              ? []
              : Array.isArray(layers.worldContainer.filters)
                ? layers.worldContainer.filters.filter(
                    (f) => f && !f.constructor?.name?.includes('DeferredLight') && !f.constructor?.name?.includes('SelectiveBloom'),
                  )
                : [],
          });
        }
      }
    },
  };

  return system;
}
