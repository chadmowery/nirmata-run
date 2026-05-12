export type Section = 'entities' | 'mixins' | 'spawnTables' | 'componentSchemas' | 'shells';

export interface SelectedItem {
  section: Section;
  name: string;
}

export interface SectionConfig {
  id: Section;
  label: string;
  apiPath: string;
}

export const SECTIONS: SectionConfig[] = [
  { id: 'entities', label: 'Entity Templates', apiPath: '/api/dev/gamedata/entities' },
  { id: 'mixins', label: 'Mixins', apiPath: '/api/dev/gamedata/mixins' },
  { id: 'spawnTables', label: 'Spawn Tables', apiPath: '/api/dev/gamedata/spawn-tables' },
  { id: 'componentSchemas', label: 'Component Schemas', apiPath: '/api/dev/gamedata/components' },
  { id: 'shells', label: 'Shells', apiPath: '/api/dev/gamedata/shells' },
];
