import { Application, Ticker } from 'pixi.js';
import { World } from '../engine/ecs/world';
import { EventBus } from '../engine/events/event-bus';
import { GameEvents } from '../game/events/types';
import { Grid } from '../engine/grid/grid';
import { EntityId } from '../engine/ecs/types';
import { Position } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';
import { Actor } from '@shared/components/actor';
import { WorldLayers } from './layers';
import { TILE_SIZE, FOV_RADIUS } from './constants';
import { computeFov, createExploredSet, isEntityVisible, getEntityVisibilityType } from './fov';
import { computeCameraTarget, lerpCamera, getVisibleTileRange } from './camera';
import { buildTilemap, clearTilemap } from './tilemap';
import { createEntitySprite, destroyEntitySprite, getEntitySprite, clearAllSprites } from './sprite-map';
import { tickAnimations, queueMoveTween, queueAttackAnimationWithDefender, queueDeathAnimation, clearAnimations, hasActiveAnimation } from './animations';
import { applyPersistentGlitch, applyDamageDistortion } from './filters/glitch-effects';
import { queueTypedDeathAnimation } from './filters/death-effects';
import { AIState } from '@shared/components/ai-state';
import { 
  applyGrayscaleToContainer, 
  removeFiltersFromContainer, 
  applyStabilityDesaturation, 
  disposeScreenEffects 
} from './filters/screen-effects';

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
  let cameraTarget = { x: 0, y: 0 };

  const handleEntityCreated = (payload: { entityId: EntityId }) => {
    const spriteComp = world.getComponent(payload.entityId, SpriteComponent);
    if (spriteComp) {
      const sprite = createEntitySprite(payload.entityId, spriteComp.key, layers.entityLayer);
      
      // Apply persistent glitch for enemies
      const aiState = world.getComponent(payload.entityId, AIState);
      if (aiState) {
        applyPersistentGlitch(sprite, aiState.behaviorType);
      }
    }
  };

  const handleEntityDestroyed = (payload: { entityId: EntityId }) => {
    const sprite = getEntitySprite(payload.entityId);
    if (sprite) {
      const aiState = world.getComponent(payload.entityId, AIState);
      if (aiState) {
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

  const handleDamageDealt = (payload: { defenderId: EntityId }) => {
    const sprite = getEntitySprite(payload.defenderId);
    if (sprite) {
      applyDamageDistortion(sprite);
    }
  };

  const handleEntityMoved = (payload: { entityId: EntityId; fromX: number; fromY: number; toX: number; toY: number }) => {
    queueMoveTween(payload.entityId, payload.fromX, payload.fromY, payload.toX, payload.toY);
  };

  const handleBumpAttack = (payload: { attackerId: EntityId; defenderId: EntityId }) => {
    const attackerPos = world.getComponent(payload.attackerId, Position);
    const defenderPos = world.getComponent(payload.defenderId, Position);
    if (attackerPos && defenderPos) {
      queueAttackAnimationWithDefender(payload.attackerId, attackerPos, payload.defenderId, defenderPos, getEntitySprite);
    }
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

  const updateCameraFrame = (ticker: Ticker) => {
    const deltaMs = ticker.deltaMS;
    const newPos = lerpCamera(layers.worldContainer.x, layers.worldContainer.y, cameraTarget.x, cameraTarget.y, deltaMs);
    layers.worldContainer.x = newPos.x;
    layers.worldContainer.y = newPos.y;
    
    // Smooth animation tick
    tickAnimations(deltaMs, getEntitySprite);
  };

  return {
    init() {
      eventBus.on('ENTITY_CREATED', handleEntityCreated);
      eventBus.on('ENTITY_DESTROYED', handleEntityDestroyed);
      eventBus.on('ENTITY_MOVED', handleEntityMoved);
      eventBus.on('BUMP_ATTACK', handleBumpAttack);
      eventBus.on('DAMAGE_DEALT', handleDamageDealt);
      eventBus.on('APPLY_WORLD_FILTER', handleApplyWorldFilter);
      eventBus.on('REMOVE_WORLD_FILTER', handleRemoveWorldFilter);
      eventBus.on('STABILITY_CHANGED', handleStabilityChanged);
      eventBus.on('DUNGEON_GENERATED', () => this.onDungeonGenerated());
      
      app.ticker.add(updateCameraFrame);

      // Initial sprite sync for existing entities
      const entities = world.query(SpriteComponent, Position);
      for (const entityId of entities) {
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        const pos = world.getComponent(entityId, Position)!;
        const sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        sprite.x = pos.x * TILE_SIZE;
        sprite.y = pos.y * TILE_SIZE;
      }
    },

    renderSystem() {
      const playerEntity = getPlayerEntity();
      if (!world.entityExists(playerEntity)) return;

      const playerPos = world.getComponent(playerEntity, Position);
      if (!playerPos) return;

      // 1. FOV
      const fovSet = computeFov(playerPos.x, playerPos.y, FOV_RADIUS, lightPasses, exploredSet);
      eventBus.emit('FOV_UPDATED', { visibleSet: fovSet });

      // 2. Camera
      cameraTarget = computeCameraTarget(playerPos.x, playerPos.y);

      // 3. Tilemap
      const visibleRange = getVisibleTileRange(layers.worldContainer.x, layers.worldContainer.y);
      buildTilemap(getGrid(), layers.terrainLayer, {
        visibleRange,
        fovSet,
        exploredSet,
        playerPos,
      });

      // 4. Entity Sprites Sync & Visibility
      const renderables = world.query(SpriteComponent, Position);
      for (const entityId of renderables) {
        let sprite = getEntitySprite(entityId);
        
        // Lazy sprite creation for entities that missed their ENTITY_CREATED event (e.g. via factory)
        if (!sprite) {
          const spriteComp = world.getComponent(entityId, SpriteComponent)!;
          sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        }

        const pos = world.getComponent(entityId, Position)!;
        const actor = world.getComponent(entityId, Actor);
        
        // Update position if not animating
        if (!hasActiveAnimation(entityId)) {
          sprite.x = pos.x * TILE_SIZE;
          sprite.y = pos.y * TILE_SIZE;
        }

        // Visibility gating
        const entityType = getEntityVisibilityType(actor?.isPlayer, !!actor);
        let { visible, alpha } = isEntityVisible(pos, entityType, fovSet, exploredSet);
        
        // FORCE PLAYER VISIBLE FOR DEBUGGING
        if (entityType === 'player') {
          visible = true;
          alpha = 1.0;
        }

        sprite.visible = visible;
        sprite.alpha = alpha;
        
        // Ensure sprite is on top within its container
        if (visible && sprite.parent) {
          sprite.parent.addChild(sprite);
        }
      }
    },

    onDungeonGenerated() {
      clearTilemap(layers.terrainLayer);
      clearAnimations();
      clearAllSprites();
      
      // Snap camera to player on new dungeon
      const playerEntity = getPlayerEntity();
      const playerPos = world.getComponent(playerEntity, Position);
      if (playerPos) {
        cameraTarget = computeCameraTarget(playerPos.x, playerPos.y);
        layers.worldContainer.x = cameraTarget.x;
        layers.worldContainer.y = cameraTarget.y;
      }

      // Re-initialize sprites for all existing entities in the new dungeon
      const entities = world.query(SpriteComponent, Position);
      for (const entityId of entities) {
        const spriteComp = world.getComponent(entityId, SpriteComponent)!;
        const pos = world.getComponent(entityId, Position)!;
        const sprite = createEntitySprite(entityId, spriteComp.key, layers.entityLayer);
        sprite.x = pos.x * TILE_SIZE;
        sprite.y = pos.y * TILE_SIZE;
      }

      this.renderSystem();
    },

    destroy() {
      eventBus.off('ENTITY_CREATED', handleEntityCreated);
      eventBus.off('ENTITY_DESTROYED', handleEntityDestroyed);
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('BUMP_ATTACK', handleBumpAttack);
      eventBus.off('DAMAGE_DEALT', handleDamageDealt);
      eventBus.off('APPLY_WORLD_FILTER', handleApplyWorldFilter);
      eventBus.off('REMOVE_WORLD_FILTER', handleRemoveWorldFilter);
      eventBus.off('STABILITY_CHANGED', handleStabilityChanged);
      
      app.ticker.remove(updateCameraFrame);
      clearAllSprites();
      clearAnimations();
      disposeScreenEffects();
    }
  };
}
