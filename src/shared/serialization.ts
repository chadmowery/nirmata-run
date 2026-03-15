import { World } from '../engine/ecs/World';
import { Grid } from '../engine/grid/Grid';
import { EventBus } from '../engine/events/event-bus';
import { SerializedWorld, SerializedGrid } from './types';

/**
 * Serializes the ECS World to a JSON-compatible object.
 */
export function serializeWorld(world: World): SerializedWorld {
  const state = world.getSerializableState();
  // We MUST deep clone to ensure this snapshot is independent
  return JSON.parse(JSON.stringify(state)) as SerializedWorld;
}

/**
 * Deserializes a JSON-compatible object into an ECS World instance.
 */
export function deserializeWorld(data: SerializedWorld, eventBus: EventBus<any>): World {
  const world = new World(eventBus);
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
