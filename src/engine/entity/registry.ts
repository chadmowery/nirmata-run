import { RawTemplate } from './types';

/**
 * Registry for storing and retrieving entity templates.
 */
export class EntityRegistry {
  private templates: Map<string, RawTemplate> = new Map();

  /**
   * Register a new template.
   * @throws Error if a template with the same name is already registered.
   */
  register(template: RawTemplate): void {
    if (this.templates.has(template.name)) {
      throw new Error(`Template '${template.name}' is already registered`);
    }
    if (template.overrides && typeof window === 'undefined') {
      console.log(`[Registry] Registered ${template.name} with overrides:`, Object.keys(template.overrides).join(', '));
    }
    this.templates.set(template.name, template);
  }

  /**
   * Get a template by name.
   */
  get(name: string): RawTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Check if a template name is registered.
   */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Return all registered templates.
   */
  getAll(): RawTemplate[] {
    return Array.from(this.templates.values());
  }
}
