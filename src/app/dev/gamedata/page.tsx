import fs from 'fs/promises';
import path from 'path';
import { GamedataTool } from './GamedataTool';

const ENTITY_DIR = path.join(process.cwd(), 'src/game/entities/templates');
const MIXIN_DIR = path.join(process.cwd(), 'src/game/entities/templates/mixins');
const SPAWN_DIR = path.join(process.cwd(), 'src/game/entities/templates/spawn-tables');
const SHELL_DIR = path.join(process.cwd(), 'src/game/shells/shared/templates');

async function listJson(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export default async function GamedataPage() {
  const [entities, mixins, spawnTables, shells] = await Promise.all([
    listJson(ENTITY_DIR),
    listJson(MIXIN_DIR),
    listJson(SPAWN_DIR),
    listJson(SHELL_DIR),
  ]);

  return (
    <GamedataTool
      initialData={{
        entities,
        mixins,
        spawnTables,
        shells,
      }}
    />
  );
}
