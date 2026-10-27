import { GameplayEvents } from '@shared/events/types';
import { EntityId } from '@engine/ecs/types';

/**
 * Client-only, UI-bound, or rendering-specific events.
 * Never emitted or consumed by server-side code.
 */
export interface GameEvents extends GameplayEvents {
  /** Queued to flash a geometric shape for augment synergy feedback (D-04). */
  AUGMENT_FLASH: {
    entityId: EntityId;
    count: number;
    augmentNames: string[];
  };

  /** Request from UI to equip an item. */
  EQUIP_REQUESTED: {
    slotType: 'firmware' | 'augment' | 'software' | 'weapon' | 'armor';
    itemEntityId: number;
  };

  /** Request from UI to unequip a slot. */
  UNEQUIP_REQUESTED: {
    slotType: 'firmware' | 'augment' | 'software' | 'weapon' | 'armor';
    slotIndex: number;
  };

  /** Request from UI to burn software. */
  BURN_SOFTWARE_REQUESTED: {
    runInventoryIndex: number;
    targetSlot: 'weapon' | 'armor';
  };
}
