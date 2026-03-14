import { ZodSchema } from 'zod';

/**
 * Unique identifier for an entity.
 */
export type EntityId = number;

/**
 * Definition of a component, including its unique key and schema.
 */
export interface ComponentDef<T> {
  readonly key: string;
  readonly schema: ZodSchema<T>;
}

/**
 * Inferred data type for a component definition.
 */
export type ComponentData<T extends ComponentDef<unknown>> = T extends ComponentDef<infer D> ? D : never;

/**
 * Factory function to create a typed component definition.
 */
export function defineComponent<T>(key: string, zodShape: ZodSchema<T>): ComponentDef<T> {
  return {
    key,
    schema: zodShape,
  };
}

/**
 * Internal type for World to avoid circular dependency.
 * Systems are functions that take the World and perform logic.
 */
export type SystemFn = (world: unknown) => void;

/**
 * Standard execution phases for systems.
 */
export enum Phase {
  PRE_TURN = 'pre-turn',
  ACTION = 'action',
  POST_TURN = 'post-turn',
  RENDER = 'render',
}
