import { ComponentDef } from '../ecs/types';

/**
 * Raw entity template as defined in JSON or code.
 */
export interface RawTemplate {
  /**
   * Unique name of the template.
   */
  name: string;

  /**
   * Component data map: { componentKey: data }.
   */
  components?: Record<string, unknown>;

  /**
   * Optional mixin names to inherit components from.
   */
  mixins?: string[];

  /**
   * Optional overrides to apply on top of resolved mixin components.
   * Format: { componentKey: { field: value } }.
   */
  overrides?: Record<string, Record<string, unknown>>;
}

/**
 * Registry of component definitions, used for validation and creation.
 */
export interface ComponentRegistry {
  /**
   * Get a component definition by its key.
   */
  get(key: string): ComponentDef<unknown> | undefined;

  /**
   * Check if a component key exists in the registry.
   */
  has(key: string): boolean;
}
