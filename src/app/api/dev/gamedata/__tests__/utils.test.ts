import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { buildEntityIndexContent, regenerateEntityTemplateIndex } from '../utils';

describe('Gamedata Index Generation Utils', () => {
  it('buildEntityIndexContent matches committed src/game/entities/index.ts identically', async () => {
    const root = process.cwd();
    const committedPath = path.join(root, 'src/game/entities/index.ts');
    const committedContent = await fs.readFile(committedPath, 'utf-8');
    const generatedContent = await buildEntityIndexContent(root);

    expect(generatedContent).toBe(committedContent);
    expect(generatedContent).toContain('export function registerGameTemplates(');
    expect(generatedContent).toContain('export function getDefaultEntityRegistry(');
    expect(generatedContent).toContain('export function getTemplateSpriteKey(');
    expect(generatedContent).not.toContain('registerBaseTemplates');
  });

  it('regenerateEntityTemplateIndex is idempotent when no templates are added or removed', async () => {
    const root = process.cwd();
    const committedPath = path.join(root, 'src/game/entities/index.ts');
    const before = await fs.readFile(committedPath, 'utf-8');

    await regenerateEntityTemplateIndex(root);

    const after = await fs.readFile(committedPath, 'utf-8');
    expect(after).toBe(before);
  });
});
