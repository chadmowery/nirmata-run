import { Sprite, Container, Texture, Assets } from 'pixi.js';
import { EntityId } from '../engine/ecs/types';
import { TILE_SIZE } from './constants';

const entitySprites = new Map<EntityId, Sprite>();

import { logger } from '../engine/utils/logger';

/**
 * Resolves a PixiJS Texture for a given sprite key from the tileset atlas or global cache.
 */
export function getTextureForSpriteKey(spriteKey: string): Texture {
  const asset = Assets.get('tileset');
  if (asset && asset.textures && asset.textures[spriteKey]) {
    return asset.textures[spriteKey];
  }
  return Texture.from(spriteKey);
}

/**
 * Creates a sprite for an entity and adds it to the specified container.
 * If a sprite already exists for this entity, it updates its texture if needed and returns the existing one.
 */
export function createEntitySprite(
  entityId: EntityId,
  spriteKey: string,
  container: Container,
): Sprite {
  const texture = getTextureForSpriteKey(spriteKey);
  const existing = entitySprites.get(entityId);
  if (existing) {
    if (texture && texture !== Texture.EMPTY && existing.texture !== texture) {
      existing.texture = texture;
    }
    return existing;
  }

  if (!texture || texture.width === 1) {
    logger.warn(`Texture not found or empty for key: ${spriteKey} in 'tileset'`, 'RENDER');
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
 * Purges all sprites whose EntityId is no longer present in the active set.
 * Returns the list of purged entity IDs.
 */
export function purgeOrphanedSprites(activeEntityIds: Set<EntityId>): EntityId[] {
  const purged: EntityId[] = [];
  for (const entityId of Array.from(entitySprites.keys())) {
    if (!activeEntityIds.has(entityId)) {
      destroyEntitySprite(entityId);
      purged.push(entityId);
    }
  }
  return purged;
}

/**
 * Clears all sprites from the map and destroys them.
 */
export function clearAllSprites(): void {
  for (const entityId of entitySprites.keys()) {
    destroyEntitySprite(entityId);
  }
}
