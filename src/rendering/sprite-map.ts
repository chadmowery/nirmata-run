import { Sprite, Container, Assets } from 'pixi.js';
import { EntityId } from '../engine/ecs/types';
import { TILE_SIZE } from './constants';

const entitySprites = new Map<EntityId, Sprite>();

/**
 * Creates a sprite for an entity and adds it to the specified container.
 * If a sprite already exists for this entity, it returns the existing one.
 */
export function createEntitySprite(entityId: EntityId, spriteKey: string, container: Container): Sprite {
  const existing = entitySprites.get(entityId);
  if (existing) {
    return existing;
  }

  const texture = Assets.get(spriteKey);
  if (!texture) {
    console.warn(`Texture not found for key: ${spriteKey}`);
  }

  const sprite = new Sprite(texture);
  sprite.width = TILE_SIZE;
  sprite.height = TILE_SIZE;
  
  container.addChild(sprite);
  entitySprites.set(entityId, sprite);
  
  return sprite;
}

/**
 * Destroys the sprite associated with an entity and removes it from the tracking map.
 */
export function destroyEntitySprite(entityId: EntityId): void {
  const sprite = entitySprites.get(entityId);
  if (!sprite) return;

  sprite.removeFromParent();
  sprite.destroy({ children: true });
  entitySprites.delete(entityId);
}

/**
 * Gets the sprite associated with an entity.
 */
export function getEntitySprite(entityId: EntityId): Sprite | undefined {
  return entitySprites.get(entityId);
}

/**
 * Returns the number of tracked sprites.
 */
export function getSpriteCount(): number {
  return entitySprites.size;
}

/**
 * Returns a read-only view of the entity-to-sprite map.
 */
export function getEntitySprites(): ReadonlyMap<EntityId, Sprite> {
  return entitySprites;
}

/**
 * Clears all sprites from the map and destroys them.
 */
export function clearAllSprites(): void {
  for (const entityId of entitySprites.keys()) {
    destroyEntitySprite(entityId);
  }
}
