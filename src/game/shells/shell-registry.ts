import { ShellTemplate, ShellRecord } from './types';

/**
 * Registry for managing Shell archetypes and active Shell records.
 */
export class ShellRegistry {
  private templates: Map<string, ShellTemplate> = new Map();
  private records: Map<string, ShellRecord> = new Map();

  /**
   * Register a Shell archetype template.
   */
  register(template: ShellTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Shell archetype '${template.id}' is already registered`);
    }
    this.templates.set(template.id, template);
  }

  /**
   * Instantiate a new Shell record from a template.
   */
  createRecord(id: string, archetypeId: string): ShellRecord {
    const template = this.templates.get(archetypeId);
    if (!template) {
      throw new Error(`Shell archetype '${archetypeId}' not found`);
    }
    if (this.records.has(id)) {
      throw new Error(`Shell record '${id}' already exists`);
    }

    const record: ShellRecord = {
      id,
      archetypeId,
      level: 1,
      currentStats: { ...template.baseStats },
      portConfig: { ...template.basePorts },
    };

    this.records.set(id, record);
    return record;
  }

  /**
   * Get a Shell record by ID.
   */
  get(id: string): ShellRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Check if a Shell record exists.
   */
  has(id: string): boolean {
    return this.records.has(id);
  }

  /**
   * Return all registered Shell records.
   */
  getAll(): ShellRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Get all registered templates (archetypes).
   */
  getTemplates(): ShellTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Update a Shell record.
   */
  update(id: string, updates: Partial<ShellRecord>): void {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Shell record '${id}' not found`);
    }
    Object.assign(record, updates);
  }

  /**
   * Get shells available for use.
   * If weekSeed is provided, returns a deterministic subset (e.g. 2) of archetypes.
   * Otherwise returns all archetypes as new records.
   */
  getAvailableShells(weekSeed?: string): ShellRecord[] {
    const templates = this.getTemplates();
    if (!weekSeed) {
      return templates.map(t => ({
        id: `available-${t.id}`,
        archetypeId: t.id,
        level: 1,
        currentStats: { ...t.baseStats },
        portConfig: { ...t.basePorts }
      }));
    }

    // Deterministic selection based on seed hashing
    let hash = 0;
    for (let i = 0; i < weekSeed.length; i++) {
      hash = (hash << 5) - hash + weekSeed.charCodeAt(i);
      hash |= 0;
    }
    
    // Sort templates to ensure stability before slicing
    const sorted = [...templates].sort((a, b) => a.id.localeCompare(b.id));
    const offset = Math.abs(hash) % sorted.length;
    
    // Return a window of 2 archetypes
    const selected = [];
    for (let i = 0; i < 2 && i < sorted.length; i++) {
        const idx = (offset + i) % sorted.length;
        selected.push(sorted[idx]);
    }

    return selected.map(t => ({
        id: `available-${t.id}`,
        archetypeId: t.id,
        level: 1,
        currentStats: { ...t.baseStats },
        portConfig: { ...t.basePorts }
    }));
  }
}
