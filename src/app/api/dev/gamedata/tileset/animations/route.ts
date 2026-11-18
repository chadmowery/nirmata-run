import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { atomicWrite, errorResponse } from '../../utils';
import {
  AnimationManifestEntrySchema,
  resolveThemeAssetPaths,
  THEME_MANIFEST_MAP,
  type AnimationClipDef,
  type AnimationManifestEntry,
  type ThemedTilesetManifest,
} from '@shared/tileset-types';
import { hotloadBus } from '@/server/dev/hotload-bus';
import { assetWatcher } from '@/server/dev/asset-watcher';

const UpdateAnimationsRequestSchema = z.object({
  themeId: z.string().min(1).default('default'),
  animSetKey: z.string().min(1),
  entry: AnimationManifestEntrySchema.nullable(),
  propagateToThemes: z.boolean().optional(),
});

function resolveManifestFilePath(themeId: string): { filePath: string; fileName: string } {
  const rel = resolveThemeAssetPaths(themeId).json;
  const normalized = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(process.cwd(), 'public', normalized);
  return { filePath, fileName: path.basename(filePath) };
}

function collectEntryFrameKeys(entry: AnimationManifestEntry): string[] {
  if ('frames' in entry && Array.isArray((entry as AnimationClipDef).frames)) {
    return (entry as AnimationClipDef).frames;
  }
  const keys: string[] = [];
  for (const clip of Object.values(entry as Record<string, AnimationClipDef | undefined>)) {
    if (clip && Array.isArray(clip.frames)) {
      keys.push(...clip.frames);
    }
  }
  return keys;
}

export async function GET(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const url = new URL(req.url);
    const themeId = url.searchParams.get('theme') || 'default';
    const { filePath } = resolveManifestFilePath(themeId);
    const raw = await fs.readFile(filePath, 'utf-8');
    const manifest = JSON.parse(raw) as ThemedTilesetManifest;

    return NextResponse.json({
      themeId,
      animations: manifest.animations ?? {},
      frameKeys: Object.keys(manifest.frames ?? {}),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to load tileset animations',
      500,
    );
  }
}

export async function PUT(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const rawBody = await req.json();
    const parsed = UpdateAnimationsRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(`Invalid animation payload: ${parsed.error.message}`, 400);
    }

    const { themeId, animSetKey, entry, propagateToThemes } = parsed.data;
    const { filePath, fileName } = resolveManifestFilePath(themeId);
    const raw = await fs.readFile(filePath, 'utf-8');
    const manifest = JSON.parse(raw) as ThemedTilesetManifest;

    if (entry) {
      const referencedFrames = collectEntryFrameKeys(entry);
      const missingFrames = referencedFrames.filter((fk) => !manifest.frames?.[fk]);
      if (missingFrames.length > 0) {
        return errorResponse(
          `Unknown frame key(s) in manifest '${themeId}': ${missingFrames.join(', ')}`,
          400,
        );
      }
    }

    if (!manifest.animations) {
      manifest.animations = {};
    }

    if (entry === null) {
      delete manifest.animations[animSetKey];
    } else {
      manifest.animations[animSetKey] = entry;
    }

    assetWatcher.markSelfWrite(fileName);
    await atomicWrite(filePath, manifest);

    const envelope = hotloadBus.publishCommit('tileset:animations', animSetKey, {
      themeId,
      animSetKey,
      animations: manifest.animations,
      propagateToThemes: Boolean(propagateToThemes),
    });

    const updatedThemes: string[] = [themeId];

    // Optional propagation from 'default' to dedicated theme manifests sharing the frame keys
    if (themeId === 'default' && propagateToThemes) {
      const seenFiles = new Set<string>([filePath]);
      for (const [candidateTheme, paths] of Object.entries(THEME_MANIFEST_MAP)) {
        const candidatePath = path.join(process.cwd(), 'public', paths.json);
        if (seenFiles.has(candidatePath)) continue;
        seenFiles.add(candidatePath);

        try {
          const candidateRaw = await fs.readFile(candidatePath, 'utf-8');
          const candidateManifest = JSON.parse(candidateRaw) as ThemedTilesetManifest;

          if (entry) {
            const referencedFrames = collectEntryFrameKeys(entry);
            const allExist = referencedFrames.every((fk) => Boolean(candidateManifest.frames?.[fk]));
            if (!allExist) continue;
          }

          if (!candidateManifest.animations) {
            candidateManifest.animations = {};
          }
          if (entry === null) {
            delete candidateManifest.animations[animSetKey];
          } else {
            candidateManifest.animations[animSetKey] = entry;
          }

          assetWatcher.markSelfWrite(path.basename(candidatePath));
          await atomicWrite(candidatePath, candidateManifest);
          updatedThemes.push(candidateTheme);

          hotloadBus.publishCommit('tileset:animations', animSetKey, {
            themeId: candidateTheme,
            animSetKey,
            animations: candidateManifest.animations,
          });
        } catch {
          // Skip missing or unreadable theme manifests
        }
      }
    }

    return NextResponse.json({
      success: true,
      themeId,
      animSetKey,
      updatedThemes,
      animations: manifest.animations,
      envelope,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to update tileset animations',
      500,
    );
  }
}
