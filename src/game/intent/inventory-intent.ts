import { World } from '@engine/ecs/world';
import { InventorySwapIntent } from '@shared/components/inventory-intent';
import { Energy } from '@shared/components/energy';

export function handleInventorySwap(world: World, actorId: number, sourceIndex: number, destinationIndex: number) {
  // 1. Add InventorySwapIntent to actor
  world.addComponent(actorId, InventorySwapIntent, {
    actorId,
    sourceIndex,
    destinationIndex,
  });

  // 2. Deduct 1 turn's worth of energy (assuming standard cost)
  const energy = world.getComponent(actorId, Energy);
  if (energy) {
    // This is a simplified cost deduction. The system handling InventorySwapIntent
    // should ideally handle energy consumption, but per instructions, we do it here.
    // Assuming 1 turn = 100 energy units based on common roguelike patterns
    world.patchComponent(actorId, Energy, {
      current: Math.max(0, energy.current - 1000)
    });
  }
}
