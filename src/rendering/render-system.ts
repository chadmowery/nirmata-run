import { Application, Ticker, Graphics } from 'pixi.js';
import { World } from '../engine/ecs/world';
import { EventBus } from '../engine/events/event-bus';
import { GameEvents } from '../game/events/types';
import { Grid } from '../engine/grid/grid';
import { EntityId } from '../engine/ecs/types';
import { Position } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';
import { Actor } from '@shared/components/actor';
import { AbilityDef } from '@shared/components/ability-def';
import { FirmwareSlots } from '@shared/components/firmware-slots';
import { gameStore } from '../game/ui/store';
import { WorldLayers } from './layers';
import { TILE_SIZE, FOV_RADIUS } from './constants';
import { computeFov, createExploredSet, isEntityVisible, getEntityVisibilityType, clearExplored } from './fov';
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
  const targetingCursor = new Graphics();
  layers.effectsLayer.addChild(targetingCursor);

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
    queueMoveTween(payload.entityId, payload.fromX, payload.fromY, payload.toX, payload.toY, getEntitySprite);
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

      // 1. Dynamic FOV (D-15 Extended Sight Logic)
      let effectiveRadius = FOV_RADIUS;
      const fSlots = world.getComponent(playerEntity, FirmwareSlots);
      if (fSlots) {
        for (const firmwareId of fSlots.equipped) {
          const abilityDef = world.getComponent(firmwareId, AbilityDef);
          if (abilityDef && abilityDef.effectType === 'toggle_vision' && abilityDef.isActive) {
            effectiveRadius = Math.max(effectiveRadius, abilityDef.visionRadius);
          }
        }
      }

      const fovSet = computeFov(playerPos.x, playerPos.y, effectiveRadius, lightPasses, exploredSet);
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
            playerPos.x * TILE_SIZE + TILE_SIZE/2, 
            playerPos.y * TILE_SIZE + TILE_SIZE/2, 
            storeState.targetingRange * TILE_SIZE
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
      clearExplored(exploredSet);
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
