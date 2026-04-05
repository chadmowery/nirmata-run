import { World } from '../ecs/world';
import { RawTemplate, ComponentRegistry } from './types';
import { EntityRegistry } from './registry';
import { EntityId } from '../ecs/types';

/**
 * Resolves mixins for a template recursively.
 * @throws Error on circular references, depth limit exceeded, or conflicting components.
 */
export function resolveMixins(
  template: RawTemplate,
  templateRegistry: EntityRegistry,
  maxDepth = 3,
  seen: string[] = []
): Record<string, unknown> {
  if (seen.includes(template.name)) {
    throw new Error(`Circular mixin reference: ${seen.join(' → ')} → ${template.name}`);
  }

  if (seen.length >= maxDepth) {
     throw new Error(`Mixin depth exceeded (max ${maxDepth}) for template '${template.name}'`);
  }

  const resolvedComponents: Record<string, unknown> = {};
  const componentSources: Record<string, string[]> = {};

  // Resolve mixins first
  if (template.mixins && template.mixins.length > 0) {
    for (const mixinName of template.mixins) {
      const mixinTemplate = templateRegistry.get(mixinName);
      if (!mixinTemplate) {
        throw new Error(`Template '${template.name}' references unknown mixin: '${mixinName}'`);
      }

      const mixinComponents = resolveMixins(
        mixinTemplate,
        templateRegistry,
        maxDepth,
        [...seen, template.name]
      );

      for (const [key, data] of Object.entries(mixinComponents)) {
        if (resolvedComponents[key] !== undefined) {
          // Check if we have multiple sources for the same component
          const sources = componentSources[key] || [];
          if (!sources.includes(mixinName)) {
            sources.push(mixinName);
          }
          componentSources[key] = sources;
          
          // Conflict if components from different mixins collide
          // (They might collide if they inherit from same base, but resolveMixins currently 
          // doesn't track origins perfectly. Let's stick to the strictly simpler logic 
          // mentioned in the plan: "Conflicting component across two mixins throws")
          throw new Error(`Template '${template.name}': component '${key}' defined in multiple mixins [${sources.join(', ')}]. Use 'overrides' to resolve.`);
        }
        resolvedComponents[key] = data;
        componentSources[key] = [mixinName];
      }
    }
  }

  // Merge template's own components
  for (const [key, data] of Object.entries(template.components || {})) {
    resolvedComponents[key] = data;
  }

  // Apply overrides
  if (template.overrides) {
    for (const [key, overrideData] of Object.entries(template.overrides)) {
      if (resolvedComponents[key]) {
        // Deep merge for overrideData onto resolvedComponents[key]
        resolvedComponents[key] = {
          ...(resolvedComponents[key] as object),
          ...overrideData
        };
      } else {
        resolvedComponents[key] = overrideData;
      }
    }
  }
  return resolvedComponents;
}

import { EngineEvents } from '../events/types';

/**
 * Validates and stamps an entity into the world.
 * @throws Error if a component is unknown or validation fails.
 */
export function buildEntity<T extends EngineEvents>(
  world: World<T>,
  templateName: string,
  resolvedComponents: Record<string, unknown>,
  componentRegistry: ComponentRegistry
): EntityId {
  const entityId = world.createEntity();

  for (const [key, data] of Object.entries(resolvedComponents)) {
    const def = componentRegistry.get(key);
    if (!def) {
      throw new Error(`Template '${templateName}': unknown component '${key}'`);
    }

    const result = def.schema.safeParse(data);
    if (!result.success) {
      const errorMsg = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Template '${templateName}', component '${key}': ${errorMsg}`);
    }
    // Deep clone the data to prevent state pollution across entities 
    // sharing the same template/mixin object references.
    const deepClonedData = JSON.parse(JSON.stringify(result.data));
    world.addComponent(entityId, def, deepClonedData);
  }

  return entityId;
}
