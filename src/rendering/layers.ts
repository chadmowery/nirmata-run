import { Container } from 'pixi.js';

export interface WorldLayers {
  worldContainer: Container;
  terrainLayer: Container;
  itemLayer: Container;
  entityLayer: Container;
  effectsLayer: Container;
}

/**
 * Creates the world container and its ordered child layers.
 * Render order: terrain -> items -> entities -> effects
 */
export function createWorldContainer(): WorldLayers {
  const worldContainer = new Container();

  const terrainLayer = new Container();
  const itemLayer = new Container();
  const entityLayer = new Container();
  const effectsLayer = new Container();

  // Enforce ordering by addChild order
  worldContainer.addChild(terrainLayer);
  worldContainer.addChild(itemLayer);
  worldContainer.addChild(entityLayer);
  worldContainer.addChild(effectsLayer);

  return {
    worldContainer,
    terrainLayer,
    itemLayer,
    entityLayer,
    effectsLayer,
  };
}
