import { Sprite, Container, Texture, Assets } from 'pixi.js';
import { EntityId } from '../engine/ecs/types';
import { TILE_SIZE } from './constants';
import { getActiveThemeId } from './assets';
import { logger } from '../engine/utils/logger';

const entitySprites = new Map<EntityId, Sprite>();

/**
 * Resolves a canonical fallback frame key for a directional or variant sprite key.
 */
export function resolveFallbackSpriteKey(spriteKey: string): string | undefined {
  if (spriteKey.startsWith('prop_workstation_')) return 'prop_workstation';
  if (spriteKey.startsWith('prop_locker_')) return 'prop_locker';
  if (spriteKey.startsWith('prop_biocabinet_')) return 'prop_biocabinet';
  if (spriteKey.startsWith('prop_vault_door_locked_')) return 'prop_vault_door_locked';
  if (spriteKey.startsWith('prop_vault_door_')) return 'prop_vault_door';
  if (spriteKey.startsWith('prop_crate_cover_')) return 'prop_crate_cover';
  if (spriteKey.startsWith('wall_')) return 'wall';
  if (spriteKey.startsWith('door_')) return 'door';
  return undefined;
}

/**
 * Resolves a PixiJS Texture for a given sprite key from the active themed atlas,
 * default tileset atlas, or global cache. Supports fallback frame keys.
 */
export function getTextureForSpriteKey(spriteKey: string, explicitFallbackKey?: string): Texture {
  const activeTheme = getActiveThemeId?.() ?? 'default';

  const hasAssets = typeof Assets !== 'undefined' && typeof Assets?.get === 'function';

  // 1. Check active themed atlas if present
  if (hasAssets && activeTheme !== 'default') {
    const themedAsset = Assets.get(`tileset_${activeTheme}`);
    if (themedAsset && themedAsset.textures && themedAsset.textures[spriteKey]) {
      return themedAsset.textures[spriteKey];
    }
  }

  // 2. Check base tileset atlas
  const baseAsset = hasAssets ? Assets.get('tileset') : null;
  if (baseAsset && baseAsset.textures && baseAsset.textures[spriteKey]) {
    return baseAsset.textures[spriteKey];
  }

  // 3. Check fallback key if provided or derived
  const fallbackKey = explicitFallbackKey ?? resolveFallbackSpriteKey(spriteKey);
  if (fallbackKey && fallbackKey !== spriteKey) {
    if (hasAssets && activeTheme !== 'default') {
      const themedAsset = Assets.get(`tileset_${activeTheme}`);
      if (themedAsset && themedAsset.textures && themedAsset.textures[fallbackKey]) {
        return themedAsset.textures[fallbackKey];
      }
    }
    if (baseAsset && baseAsset.textures && baseAsset.textures[fallbackKey]) {
      return baseAsset.textures[fallbackKey];
    }
    try {
      const fbTex = Texture.from(fallbackKey);
      if (fbTex && fbTex !== Texture.EMPTY && (fbTex.width ?? 0) > 1) {
        return fbTex;
      }
    } catch {
      // Fallback to Texture.from(spriteKey) below
    }
  }

  return Texture.from(spriteKey);
}

/**
 * Updates an entity sprite's pivot and rotation based on angle in degrees.
 */
export function updateEntitySpriteOrientation(sprite: Sprite, angleDegrees: number = 0): void {
  if (angleDegrees !== 0) {
    if (sprite.pivot?.set) {
      sprite.pivot.set(TILE_SIZE / 2, TILE_SIZE / 2);
    }
    sprite.rotation = (angleDegrees * Math.PI) / 180;
  } else {
    if (sprite.pivot?.set) {
      sprite.pivot.set(0, 0);
    }
    sprite.rotation = 0;
  }
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
