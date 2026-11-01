import { RawTemplate } from './types';
import { logger } from '../utils/logger';

/**
 * Registry for storing and retrieving entity templates.
 */
export class EntityRegistry {
  private templates: Map<string, RawTemplate> = new Map();
  private normalizedIndex: Map<string, RawTemplate> = new Map();

  private normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .replace(/\.(sh|exe|sys|arc)$/i, '')
      .replace(/[\s_\-.]/g, '');
  }

  /**
   * Register a new template.
   * @throws Error if a template with the same name is already registered.
   */
  register(template: RawTemplate): void {
    if (this.templates.has(template.name)) {
      throw new Error(`Template '${template.name}' is already registered`);
    }
    if (template.overrides && typeof window === 'undefined') {
      logger.debug(
        `Registered ${template.name} with overrides: ${Object.keys(template.overrides).join(', ')}`,
        'Registry',
      );
    }
    this.templates.set(template.name, template);
    const norm = this.normalizeKey(template.name);
    if (!this.normalizedIndex.has(norm)) {
      this.normalizedIndex.set(norm, template);
    }
  }

  /**
   * Get a template by name.
   */
  get(name: string): RawTemplate | undefined {
    return this.templates.get(name) || this.normalizedIndex.get(this.normalizeKey(name));
  }

  /**
   * Check if a template name is registered.
   */
  has(name: string): boolean {
    return this.templates.has(name) || this.normalizedIndex.has(this.normalizeKey(name));
  }

  /**
   * Return all registered templates.
   */
  getAll(): RawTemplate[] {
    return Array.from(this.templates.values());
  }
}
