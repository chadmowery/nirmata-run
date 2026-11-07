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

export async function regenerateTemplateIndex(): Promise<void> {
  const root = process.cwd();

  // 1. Entities & Mixins index
  const entityDir = path.join(root, 'src/game/entities/templates');
  const mixinDir = path.join(root, 'src/game/entities/templates/mixins');
  const entityIndexPath = path.join(root, 'src/game/entities/index.ts');

  const mixinFiles = (await listJsonFiles(mixinDir)).sort();
  const entityFiles = (await listJsonFiles(entityDir)).filter((f) => f !== 'economy').sort();

  const entityImports: string[] = [
    `import { EntityRegistry } from '../../engine/entity/registry';`,
    `import { RawTemplate } from '../../engine/entity/types';`,
    '',
  ];

  for (const m of mixinFiles) {
    entityImports.push(`import ${toIdentifier(m)} from './templates/mixins/${m}.json';`);
  }
  for (const e of entityFiles) {
    entityImports.push(`import ${toIdentifier(e)} from './templates/${e}.json';`);
  }

  entityImports.push('');
  entityImports.push(`export function registerBaseTemplates(registry: EntityRegistry): void {`);

  for (const m of mixinFiles) {
    entityImports.push(`  registry.registerMixin('${m}', ${toIdentifier(m)} as RawTemplate);`);
  }
  for (const e of entityFiles) {
    const ident = toIdentifier(e);
    entityImports.push(`  registry.register(${ident} as unknown as RawTemplate);`);
    if (['phased-overdrive', 'neural-recursion', 'static-collapse', 'void-echo'].includes(e)) {
      entityImports.push(`  registry.register({ ...(${ident} as unknown as RawTemplate), name: '${ident.toUpperCase()}' });`);
    }
  }

  entityImports.push(`}`);
  entityImports.push('');

  await fs.writeFile(entityIndexPath, entityImports.join('\n'), 'utf-8');

  // 2. Shells client index
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

  await fs.writeFile(shellIndexPath, shellImports.join('\n'), 'utf-8');

  // 3. Room Prefabs index
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

  await fs.writeFile(prefabIndexPath, prefabImports.join('\n'), 'utf-8');
}
