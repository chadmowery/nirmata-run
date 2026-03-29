import { World } from '../ecs/world';
import { EntityId } from '../ecs/types';
import { EntityRegistry } from './registry';
import { buildEntity, resolveMixins } from './builder';
import { ComponentRegistry } from './types';
import { EngineEvents } from '../events/types';

/**
 * High-level factory for creating entities from templates.
 */
export class EntityFactory {
  constructor(private registry: EntityRegistry) {}

  /**
   * Create an entity by template name.
   * @param world The World to create the entity in.
   * @param templateName Name of the template to use.
   * @param componentRegistry Component registry for validation.
   * @param runtimeOverrides Optional overrides to apply at creation time.
   */
  create<T extends EngineEvents>(
    world: World<T>,
    templateName: string,
    componentRegistry: ComponentRegistry,
    runtimeOverrides?: Record<string, Record<string, unknown>>
  ): EntityId {
    const template = this.registry.get(templateName);
    if (!template) {
      throw new Error(`Unknown template: '${templateName}'`);
    }

    // Clone template components to avoid mutation
    const templateCopy = {
      ...template,
      overrides: {
        ...template.overrides,
        ...runtimeOverrides
      }
    };

    const resolvedComponents = resolveMixins(templateCopy, this.registry);
    return buildEntity(world, templateName, resolvedComponents, componentRegistry);
  }
}
