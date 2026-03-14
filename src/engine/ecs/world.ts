import { EntityId, ComponentDef, SystemFn, Phase } from './types';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';

/**
 * The World class is the central coordinator of the ECS.
 * It manages entities, components, and systems.
 */
export class World {
  private nextId: EntityId = 1;
  private entities: Set<EntityId> = new Set();
  private stores: Map<string, Map<EntityId, unknown>> = new Map();
  private systems: Map<Phase, SystemFn[]> = new Map();
  private eventBus: EventBus<EngineEvents>;

  constructor(eventBus: EventBus<EngineEvents>) {
    this.eventBus = eventBus;
  }

  /**
   * Create a new entity with a unique ID.
   */
  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    this.eventBus.emit('ENTITY_CREATED', { entityId: id });
    return id;
  }

  /**
   * Destroy an entity and remove all its components.
   */
  destroyEntity(id: EntityId): void {
    if (!this.entities.has(id)) return;

    // Remove from all component stores
    for (const store of this.stores.values()) {
      store.delete(id);
    }

    this.entities.delete(id);
    this.eventBus.emit('ENTITY_DESTROYED', { entityId: id });
  }

  /**
   * Check if an entity exists.
   */
  entityExists(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /**
   * Add a component to an entity.
   */
  addComponent<T>(entityId: EntityId, def: ComponentDef<T>, data: T): void {
    if (!this.entities.has(entityId)) {
      throw new Error(`Cannot add component to non-existent entity: ${entityId}`);
    }

    let store = this.stores.get(def.key);
    if (!store) {
      store = new Map();
      this.stores.set(def.key, store);
    }

    store.set(entityId, data);
    this.eventBus.emit('COMPONENT_ADDED', { entityId, componentKey: def.key });
  }

  /**
   * Remove a component from an entity.
   */
  removeComponent<T>(entityId: EntityId, def: ComponentDef<T>): void {
    const store = this.stores.get(def.key);
    if (store && store.has(entityId)) {
      store.delete(entityId);
      this.eventBus.emit('COMPONENT_REMOVED', { entityId, componentKey: def.key });
    }
  }

  /**
   * Get component data for an entity.
   */
  getComponent<T>(entityId: EntityId, def: ComponentDef<T>): T | undefined {
    return this.stores.get(def.key)?.get(entityId) as T | undefined;
  }

  /**
   * Check if an entity has a component.
   */
  hasComponent<T>(entityId: EntityId, def: ComponentDef<T>): boolean {
    return !!this.stores.get(def.key)?.has(entityId);
  }

  /**
   * Query entities that have all of the specified components.
   */
  query(...defs: ComponentDef<unknown>[]): EntityId[] {
    if (defs.length === 0) return Array.from(this.entities);

    // Get all candidate stores
    const candidateStores = defs
      .map(def => ({ key: def.key, store: this.stores.get(def.key) }))
      .filter(entry => entry.store !== undefined);

    // If any component has no store, no entity can match all
    if (candidateStores.length < defs.length) return [];

    // Sort by store size for efficiency (start with smallest set)
    candidateStores.sort((a, b) => a.store!.size - b.store!.size);

    const firstStore = candidateStores[0].store!;
    const results: EntityId[] = [];

    for (const entityId of firstStore.keys()) {
      let match = true;
      for (let i = 1; i < candidateStores.length; i++) {
        if (!candidateStores[i].store!.has(entityId)) {
          match = false;
          break;
        }
      }
      if (match) {
        results.push(entityId);
      }
    }

    return results;
  }

  /**
   * Register a system to be executed in a specific phase.
   */
  registerSystem(phase: Phase, system: SystemFn): void {
    let phaseSystems = this.systems.get(phase);
    if (!phaseSystems) {
      phaseSystems = [];
      this.systems.set(phase, phaseSystems);
    }
    phaseSystems.push(system);
  }

  /**
   * Execute all systems registered for a phase.
   */
  executeSystems(phase: Phase): void {
    const phaseSystems = this.systems.get(phase);
    if (phaseSystems) {
      for (const system of phaseSystems) {
        system(this);
      }
    }
  }
}
