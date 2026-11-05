import { describe, it, expect } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../../src/game/events/types';
import { resolveTileInspection } from '../../src/rendering/tile-inspector';
import { Grid } from '@engine/grid/grid';

describe('M12: Type-Safety & Event Typing Invariants', () => {
  it('types STATE_RECONCILED in GameplayEvents and emits without type casts', () => {
    const bus = new EventBus<GameplayEvents>();
    let receivedPayload: GameplayEvents['STATE_RECONCILED'] | null = null;

    bus.on('STATE_RECONCILED', (event) => {
      receivedPayload = event;
    });

    bus.emit('STATE_RECONCILED', {
      turnNumber: 42,
      playerId: 101,
    });
    bus.flush();

    expect(receivedPayload).toEqual({
      turnNumber: 42,
      playerId: 101,
    });
  });

  it('GameEvents strictly extends GameplayEvents and preserves subtype compatibility', () => {
    const bus = new EventBus<GameEvents>();
    let clientReceived: GameEvents['STATE_RECONCILED'] | null = null;

    bus.on('STATE_RECONCILED', (event) => {
      clientReceived = event;
    });

    bus.emit('STATE_RECONCILED', {
      turnNumber: 15,
      playerId: 7,
    });
    bus.flush();

    expect(clientReceived).toEqual({
      turnNumber: 15,
      playerId: 7,
    });
  });

  it('tile inspector resolves with strictly typed World<GameEvents>', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World<GameEvents>(bus);
    const grid = new Grid(10, 10);
    const playerEntity = world.createEntity();

    const info = resolveTileInspection({
      world,
      grid,
      gx: 0,
      gy: 0,
      screenX: 0,
      screenY: 0,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: true,
    });

    // Valid call on grid tile returns tile info without exceptions
    expect(info?.name).toBe('SUB-DECK CONDUIT FLOORING');
  });
});
