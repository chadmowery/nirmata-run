import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { EngineEvents } from '../engine/events/types';
import { GameplayEvents } from './events/types';
import { SerializedWorld, SerializedGrid } from './types';

/**
 * Serializes the ECS World to a JSON-compatible object.
 */
export function serializeWorld<T extends EngineEvents>(world: World<T>): SerializedWorld {
  const state = world.getSerializableState();
  // We MUST deep clone to ensure this snapshot is independent
  return JSON.parse(JSON.stringify(state)) as SerializedWorld;
}

/**
 * Deserializes a JSON-compatible object into an ECS World instance.
 */
export function deserializeWorld<T extends GameplayEvents>(data: SerializedWorld, eventBus: EventBus<T>): World<T> {
  const world = new World(eventBus as unknown as EventBus<EngineEvents>) as unknown as World<T>;
  world.loadSerializableState(data);
  return world;
}

/**
 * Serializes the Grid to a JSON-compatible object.
 */
export function serializeGrid(grid: Grid): SerializedGrid {
  const state = {
    width: grid.width,
    height: grid.height,
    tiles: grid.getSerializableTiles(),
  };
  return JSON.parse(JSON.stringify(state)) as SerializedGrid;
}

/**
 * Deserializes a JSON-compatible object into a Grid instance.
 */
export function deserializeGrid(data: SerializedGrid): Grid {
  const grid = new Grid(data.width, data.height);
  grid.loadSerializableTiles(data.tiles);
  return grid;
}
