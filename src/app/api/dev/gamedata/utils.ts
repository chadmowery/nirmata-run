import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function sanitizeName(name: string): string | null {
  if (!name || name.length < 2 || name.length > 64) return null;
  if (!NAME_PATTERN.test(name)) return null;
  return name;
}

export async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function resolveFilePath(dir: string, name: string): string | null {
  const safe = sanitizeName(name);
  if (!safe) return null;
  const filePath = path.join(dir, `${safe}.json`);
  // Double-check resolved path is within the expected directory
  if (!filePath.startsWith(path.resolve(dir))) return null;
  return filePath;
}

function toIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

async function writeIfChanged(filePath: string, nextContent: string): Promise<boolean> {
  try {
    const existing = await fs.readFile(filePath, 'utf-8');
    if (existing === nextContent) {
      return false;
    }
  } catch {
    // File does not exist yet
  }
  await fs.writeFile(filePath, nextContent, 'utf-8');
  return true;
}

export async function regenerateShellTemplateIndex(): Promise<void> {
  const root = process.cwd();
  const shellDir = path.join(root, 'src/game/shells/shared/templates');
  const shellIndexPath = path.join(root, 'src/game/shells/client/index.ts');
  const shellFiles = (await listJsonFiles(shellDir)).sort();

  const shellImports: string[] = [
    `import { ShellRegistry } from '../server/shell-registry';`,
  ];
  for (const s of shellFiles) {
    shellImports.push(`import ${toIdentifier(s)} from '../shared/templates/${s}.json';`);
  }
  shellImports.push('');
  shellImports.push(`export const globalShellRegistry = new ShellRegistry();`);
  for (const s of shellFiles) {
    shellImports.push(`globalShellRegistry.register(${toIdentifier(s)});`);
  }
  shellImports.push('');

  await writeIfChanged(shellIndexPath, shellImports.join('\n'));
}

export async function buildEntityIndexContent(root: string = process.cwd()): Promise<string> {
  const entityDir = path.join(root, 'src/game/entities/templates');
  const mixinDir = path.join(root, 'src/game/entities/templates/mixins');

  const mixinFiles = (await listJsonFiles(mixinDir)).sort();
  const entityFiles = (await listJsonFiles(entityDir)).filter((f) => f !== 'economy').sort();

  const lines: string[] = [
    `import { EntityRegistry } from '../../engine/entity/registry';`,
    `import { RawTemplate } from '../../engine/entity/types';`,
    '',
  ];

  for (const m of mixinFiles) {
    lines.push(`import ${toIdentifier(m)} from './templates/mixins/${m}.json';`);
  }
  for (const e of entityFiles) {
    lines.push(`import ${toIdentifier(e)} from './templates/${e}.json';`);
  }

  lines.push('');
  lines.push(`/**`);
  lines.push(` * Registers all game entity templates and mixins.`);
  lines.push(` */`);
  lines.push(`export function registerGameTemplates(registry: EntityRegistry): void {`);

  for (const m of mixinFiles) {
    lines.push(`  registry.registerMixin('${m}', ${toIdentifier(m)} as unknown as RawTemplate);`);
  }
  for (const e of entityFiles) {
    const ident = toIdentifier(e);
    lines.push(`  registry.register(${ident} as unknown as RawTemplate);`);
    if (['phased-overdrive', 'neural-recursion', 'static-collapse', 'void-echo'].includes(e)) {
      lines.push(`  registry.register({ ...(${ident} as unknown as RawTemplate), name: '${ident.toUpperCase()}' });`);
    }
  }

  lines.push(`}`);
  lines.push('');
  lines.push(`let defaultEntityRegistry: EntityRegistry | null = null;`);
  lines.push('');
  lines.push(`/**`);
  lines.push(` * Returns a shared singleton EntityRegistry populated with all default templates.`);
  lines.push(` */`);
  lines.push(`export function getDefaultEntityRegistry(): EntityRegistry {`);
  lines.push(`  if (!defaultEntityRegistry) {`);
  lines.push(`    defaultEntityRegistry = new EntityRegistry();`);
  lines.push(`    registerGameTemplates(defaultEntityRegistry);`);
  lines.push(`  }`);
  lines.push(`  return defaultEntityRegistry;`);
  lines.push(`}`);
  lines.push('');
  lines.push(`/**`);
  lines.push(` * Resolves the authoritative sprite key for an entity template, with directional variant support.`);
  lines.push(` */`);
  lines.push(`export function getTemplateSpriteKey(templateName: string, orientation?: string): string | null {`);
  lines.push(`  const reg = getDefaultEntityRegistry();`);
  lines.push(`  if (orientation) {`);
  lines.push(`    const o = orientation.toLowerCase()[0];`);
  lines.push(`    const directionalName = \`\${templateName}-\${o}\`;`);
  lines.push(`    const dirTmpl = reg.get(directionalName);`);
  lines.push(`    if (dirTmpl) {`);
  lines.push(`      const spriteKey =`);
  lines.push(`        (dirTmpl.components?.sprite as { key?: string } | undefined)?.key ||`);
  lines.push(`        (dirTmpl.overrides?.sprite as { key?: string } | undefined)?.key;`);
  lines.push(`      if (spriteKey) return spriteKey;`);
  lines.push(`    }`);
  lines.push(`    const hvName = \`\${templateName}-\${o === 'n' || o === 's' ? 'h' : 'v'}\`;`);
  lines.push(`    const hvTmpl = reg.get(hvName);`);
  lines.push(`    if (hvTmpl) {`);
  lines.push(`      const spriteKey =`);
  lines.push(`        (hvTmpl.components?.sprite as { key?: string } | undefined)?.key ||`);
  lines.push(`        (hvTmpl.overrides?.sprite as { key?: string } | undefined)?.key;`);
  lines.push(`      if (spriteKey) return spriteKey;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push('');
  lines.push(`  const tmpl = reg.get(templateName);`);
  lines.push(`  if (tmpl) {`);
  lines.push(`    const spriteKey =`);
  lines.push(`      (tmpl.components?.sprite as { key?: string } | undefined)?.key ||`);
  lines.push(`      (tmpl.overrides?.sprite as { key?: string } | undefined)?.key;`);
  lines.push(`    if (spriteKey) return spriteKey;`);
  lines.push(`  }`);
  lines.push('');
  lines.push(`  return null;`);
  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}

export async function regenerateEntityTemplateIndex(root: string = process.cwd()): Promise<void> {
  const entityIndexPath = path.join(root, 'src/game/entities/index.ts');
  const nextEntityIndex = await buildEntityIndexContent(root);
  await writeIfChanged(entityIndexPath, nextEntityIndex);
}

export async function regeneratePrefabTemplateIndex(root: string = process.cwd()): Promise<void> {
  const prefabDir = path.join(root, 'src/game/generation/prefabs');
  const prefabIndexPath = path.join(root, 'src/game/generation/prefabs/index.ts');
  const prefabFiles = (await listJsonFiles(prefabDir)).sort();

  const prefabImports: string[] = [
    `import { RoomPrefabTemplate } from './types';`,
    `import { FactionTheme } from '@shared/components/environment';`,
  ];
  for (const p of prefabFiles) {
    prefabImports.push(`import ${toIdentifier(p)} from './${p}.json';`);
  }
  prefabImports.push('');
  prefabImports.push(`export * from './types';`);
  prefabImports.push('');
  prefabImports.push(`export const ALL_PREFABS: RoomPrefabTemplate[] = [`);
  for (const p of prefabFiles) {
    prefabImports.push(`  ${toIdentifier(p)} as RoomPrefabTemplate,`);
  }
  prefabImports.push(`];`);
  prefabImports.push('');
  prefabImports.push(`/**`);
  prefabImports.push(` * Get qualifying prefabs for a given floor depth and optional faction.`);
  prefabImports.push(` */`);
  prefabImports.push(`export function getPrefabsForFloor(`);
  prefabImports.push(`  depth: number,`);
  prefabImports.push(`  faction?: FactionTheme,`);
  prefabImports.push(`): RoomPrefabTemplate[] {`);
  prefabImports.push(`  const matching = ALL_PREFABS.filter((p) => {`);
  prefabImports.push(`    const floorMatch = depth >= p.minFloor && depth <= p.maxFloor;`);
  prefabImports.push(`    if (!floorMatch) return false;`);
  prefabImports.push(`    if (p.isVaultRoom) return true;`);
  prefabImports.push(`    if (!faction || faction === 'system') return true;`);
  prefabImports.push(`    return p.faction === faction;`);
  prefabImports.push(`  });`);
  prefabImports.push('');
  prefabImports.push(`  if (matching.length > 0) return matching;`);
  prefabImports.push(`  return ALL_PREFABS.filter((p) => depth >= p.minFloor && depth <= p.maxFloor);`);
  prefabImports.push(`}`);
  prefabImports.push('');
  prefabImports.push(`export function upsertPrefab(prefab: RoomPrefabTemplate): void {`);
  prefabImports.push(`  const idx = ALL_PREFABS.findIndex((p) => p.id === prefab.id);`);
  prefabImports.push(`  if (idx >= 0) {`);
  prefabImports.push(`    ALL_PREFABS[idx] = prefab;`);
  prefabImports.push(`  } else {`);
  prefabImports.push(`    ALL_PREFABS.push(prefab);`);
  prefabImports.push(`  }`);
  prefabImports.push(`}`);
  prefabImports.push('');
  prefabImports.push(`export function removePrefab(id: string): void {`);
  prefabImports.push(`  const idx = ALL_PREFABS.findIndex((p) => p.id === id);`);
  prefabImports.push(`  if (idx >= 0) {`);
  prefabImports.push(`    ALL_PREFABS.splice(idx, 1);`);
  prefabImports.push(`  }`);
  prefabImports.push(`}`);
  prefabImports.push('');

  await writeIfChanged(prefabIndexPath, prefabImports.join('\n'));
}

export async function regenerateTemplateIndex(): Promise<void> {
  const root = process.cwd();
  await regenerateEntityTemplateIndex(root);
  await regenerateShellTemplateIndex();
  await regeneratePrefabTemplateIndex(root);
}
