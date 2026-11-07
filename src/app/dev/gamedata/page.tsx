import fs from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import { GamedataTool } from '@dev-tool/studio/GamedataTool';

const ENTITY_DIR = path.join(process.cwd(), 'src/game/entities/templates');
const MIXIN_DIR = path.join(process.cwd(), 'src/game/entities/templates/mixins');
const SPAWN_DIR = path.join(process.cwd(), 'src/game/entities/templates/spawn-tables');
const SHELL_DIR = path.join(process.cwd(), 'src/game/shells/shared/templates');
const PREFAB_DIR = path.join(process.cwd(), 'src/game/generation/prefabs');
const SOUND_CUES_FILE = path.join(process.cwd(), 'src/game/audio/sound-cues.json');

async function listJson(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export default async function GamedataPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [rawEntities, mixins, spawnTables, shells, prefabs, rawAudioCues] = await Promise.all([
    listJson(ENTITY_DIR),
    listJson(MIXIN_DIR),
    listJson(SPAWN_DIR),
    listJson(SHELL_DIR),
    listJson(PREFAB_DIR),
    fs
      .readFile(SOUND_CUES_FILE, 'utf-8')
      .then((content) => {
        const data = JSON.parse(content);
        return Array.isArray(data.cues) ? data.cues.map((c: { id: string }) => c.id) : [];
      })
      .catch(() => []),
  ]);

  const entities = rawEntities.filter((name) => name !== 'economy');
  const configs = ['economy', 'depth-config', 'loot-distribution'];
  const audioCues = rawAudioCues;

  return (
    <GamedataTool
      initialData={{
        entities,
        mixins,
        spawnTables,
        shells,
        prefabs,
        configs,
        audioCues,
      }}
    />
  );
}
