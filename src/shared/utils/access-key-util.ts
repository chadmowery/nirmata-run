import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { EngineEvents } from '@engine/events/types';
import { FloorState } from '../components/floor-state';
import { RunInventory } from '../components/run-inventory';

/**
 * Check if the player possesses an Access Key (either on FloorState or in RunInventory).
 */
export function playerHasAccessKey<T extends EngineEvents>(
  world: World<T>,
  playerId: EntityId,
): boolean {
  const floorState = world.getComponent(playerId, FloorState);
  if (floorState && (floorState.accessKeysHeld ?? 0) > 0) {
    return true;
  }
  const runInv = world.getComponent(playerId, RunInventory);
  if (runInv) {
    if (runInv.software?.some((s) => s.templateId.includes('access-key'))) {
      return true;
    }
    if (runInv.equipment?.some((e) => e.templateId.includes('access-key'))) {
      return true;
    }
  }
  return false;
}

/**
 * Consume an Access Key held by the player.
 */
export function consumeAccessKey<T extends EngineEvents>(
  world: World<T>,
  playerId: EntityId,
): boolean {
  const floorState = world.getComponent(playerId, FloorState);
  if (floorState && (floorState.accessKeysHeld ?? 0) > 0) {
    world.patchComponent(playerId, FloorState, {
      accessKeysHeld: (floorState.accessKeysHeld ?? 1) - 1,
    });
    return true;
  }

  const runInv = world.getComponent(playerId, RunInventory);
  if (runInv) {
    const swIdx = runInv.software.findIndex((s) => s.templateId.includes('access-key'));
    if (swIdx !== -1) {
      const sw = [...runInv.software];
      sw.splice(swIdx, 1);
      world.patchComponent(playerId, RunInventory, { software: sw });
      return true;
    }
    const eqIdx = runInv.equipment.findIndex((e) => e.templateId.includes('access-key'));
    if (eqIdx !== -1) {
      const eq = [...runInv.equipment];
      eq.splice(eqIdx, 1);
      world.patchComponent(playerId, RunInventory, { equipment: eq });
      return true;
    }
  }

  return false;
}
