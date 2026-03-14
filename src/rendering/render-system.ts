import { Application, Ticker } from 'pixi.js';
import { World } from '../engine/ecs/world';
import { EventBus } from '../engine/events/event-bus';
import { GameEvents } from '../game/events/types';
import { Grid } from '../engine/grid/grid';
import { EntityId } from '../engine/ecs/types';
import { Position, SpriteComponent, Actor } from '../game/components';
import { WorldLayers } from './layers';
import { TILE_SIZE, FOV_RADIUS } from './constants';
import { computeFov, createExploredSet, clearExplored, isEntityVisible } from './fov';
import { computeCameraTarget, lerpCamera, getVisibleTileRange } from './camera';
import { buildTilemap } from './tilemap';
import { createEntitySprite, destroyEntitySprite, getEntitySprite, clearAllSprites } from './sprite-map';
import { tickAnimations, queueMoveTween, queueAttackAnimationWithDefender, queueDeathAnimation, clearAnimations, hasActiveAnimation } from './animations';

export interface RenderSystemConfig {
  app: Application;
  layers: WorldLayers;
  world: World;
  eventBus: EventBus<GameEvents>;
  getGrid: () => Grid;
  getPlayerEntity: () => EntityId;
  lightPasses: (x: number, y: number) => boolean;
}

export function createRenderSystem(config: RenderSystemConfig) {
  const { app, layers, world, eventBus, getGrid, getPlayerEntity, lightPasses } = config;
  let exploredSet = createExploredSet();
  let cameraTarget = { x: 0, y: 0 };

  const handleEntityCreated = (payload: { entityId: EntityId }) => {
    const spriteComp = world.getComponent(payload.entityId, SpriteComponent);
    if (spriteComp) {
      createEntitySprite(payload.entityId, spriteComp.key, layers.entityLayer);
    }
  };

  const handleEntityDestroyed = (payload: { entityId: EntityId }) => {
    // Check if it has a sprite before queuing death animation
    if (getEntitySprite(payload.entityId)) {
      queueDeathAnimation(payload.entityId, () => {
        destroyEntitySprite(payload.entityId);
      });
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
        const sprite = getEntitySprite(entityId);
        if (!sprite) continue;

        const pos = world.getComponent(entityId, Position)!;
        const actor = world.getComponent(entityId, Actor);
        
        // Update position if not animating
        if (!hasActiveAnimation(entityId)) {
          sprite.x = pos.x * TILE_SIZE;
          sprite.y = pos.y * TILE_SIZE;
        }

        // Visibility gating
        const entityType = actor?.isPlayer ? 'player' : (actor ? 'enemy' : 'item');
        const { visible, alpha } = isEntityVisible(pos, entityType as any, fovSet, exploredSet);
        
        sprite.visible = visible;
        sprite.alpha = alpha;
      }
    },

    onDungeonGenerated() {
      clearExplored(exploredSet);
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

      this.renderSystem();
    },

    destroy() {
      eventBus.off('ENTITY_CREATED', handleEntityCreated);
      eventBus.off('ENTITY_DESTROYED', handleEntityDestroyed);
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('BUMP_ATTACK', handleBumpAttack);
      
      app.ticker.remove(updateCameraFrame);
      clearAllSprites();
      clearAnimations();
    }
  };
}
