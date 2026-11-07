import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { atomicWrite, errorResponse } from '../../utils';
import {
  EconomyConfigSchema,
  DepthConfigSchema,
  LootDistributionSchema,
  AmbianceConfigSchema,
} from '../../schemas';
import { setAmbianceConfig } from '@/game/config/ambiance';
import { registerSoundCue } from '@/game/audio/cue-registry';
import { SoundCueDef } from '@engine/audio';
import { z } from 'zod';

const CONFIG_PATHS: Record<string, string> = {
  economy: path.join(process.cwd(), 'src/game/entities/templates/economy.json'),
  'depth-config': path.join(process.cwd(), 'src/game/generation/depth-config.json'),
  'loot-distribution': path.join(process.cwd(), 'src/game/generation/loot-distribution.json'),
  ambiance: path.join(process.cwd(), 'src/game/config/ambiance.json'),
};

const CUES_FILE_PATH = path.join(process.cwd(), 'src/game/audio/sound-cues.json');

async function syncSoundCues(ambiance: z.infer<typeof AmbianceConfigSchema>) {
  try {
    const content = await readFile(CUES_FILE_PATH, 'utf-8');
    const cuesData = JSON.parse(content) as { cues: Array<Record<string, unknown>> };
    let dirty = false;

    const cueRefs: Array<{ cueId: string; samplePath?: string; baseVolume?: number }> = [];

    if (ambiance.scenes) {
      for (const scene of Object.values(ambiance.scenes)) {
        if (scene.cueId) {
          cueRefs.push({ cueId: scene.cueId, samplePath: scene.samplePath });
        }
      }
    }

    if (Array.isArray(ambiance.depthBands)) {
      for (const band of ambiance.depthBands) {
        if (band.cueId) {
          cueRefs.push({
            cueId: band.cueId,
            samplePath: band.samplePath,
            baseVolume: band.baseVolume,
          });
        }
      }
    }

    if (Array.isArray(ambiance.sectorConditions)) {
      for (const cond of ambiance.sectorConditions) {
        if (cond.cueId) {
          cueRefs.push({
            cueId: cond.cueId,
            samplePath: cond.samplePath,
          });
        }
      }
    }

    for (const ref of cueRefs) {
      const existing = cuesData.cues.find((c) => c.id === ref.cueId);
      if (existing) {
        if (ref.samplePath && existing.samplePath !== ref.samplePath) {
          existing.samplePath = ref.samplePath;
          existing.mode = 'sample';
          dirty = true;
        }
        if (typeof ref.baseVolume === 'number' && existing.baseVolume !== ref.baseVolume) {
          existing.baseVolume = ref.baseVolume;
          dirty = true;
        }
        registerSoundCue(existing as unknown as SoundCueDef);
      } else {
        const newCue: Record<string, unknown> = {
          id: ref.cueId,
          bus: 'ambiance',
          mode: ref.samplePath ? 'sample' : 'synth',
          baseVolume: ref.baseVolume ?? 0.6,
          cooldownMs: 0,
          pitchVariance: 0,
          loop: true,
          ...(ref.samplePath
            ? { samplePath: ref.samplePath }
            : {
                synth: {
                  waveform: 'triangle',
                  freqStart: 55,
                  subWaveform: 'triangle',
                  subDetuneCents: 702,
                  subMix: 0.35,
                  filterType: 'lowpass',
                  filterCutoffStart: 600,
                  filterQ: 1.5,
                  attack: 1.5,
                  decay: 0.5,
                  sustain: 1,
                  hold: 10,
                  release: 2,
                  lfoFreq: 0.15,
                  lfoFilterDepth: 120,
                },
              }),
        };
        cuesData.cues.push(newCue);
        registerSoundCue(newCue as unknown as SoundCueDef);
        dirty = true;
      }
    }

    if (dirty) {
      await atomicWrite(CUES_FILE_PATH, cuesData);
    }
  } catch (err) {
    console.error('Failed to sync sound cues for ambiance:', err);
  }
}

export async function GET(_req: Request, props: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await props.params;
  const filePath = CONFIG_PATHS[name];
  if (!filePath) {
    return errorResponse(`Unknown config '${name}'`, 404);
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to read config', 500);
  }
}

export async function PUT(req: Request, props: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await props.params;
  const filePath = CONFIG_PATHS[name];
  if (!filePath) {
    return errorResponse(`Unknown config '${name}'`, 404);
  }

  try {
    const body = await req.json();

    if (name === 'economy') {
      const parsed = EconomyConfigSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(`Invalid economy config: ${parsed.error.message}`, 400);
      }
    } else if (name === 'depth-config') {
      const parsed = DepthConfigSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(`Invalid depth-config: ${parsed.error.message}`, 400);
      }
    } else if (name === 'loot-distribution') {
      const parsed = LootDistributionSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(`Invalid loot-distribution: ${parsed.error.message}`, 400);
      }
    } else if (name === 'ambiance') {
      const parsed = AmbianceConfigSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(`Invalid ambiance config: ${parsed.error.message}`, 400);
      }
      setAmbianceConfig(parsed.data);
      await syncSoundCues(parsed.data);
    }

    await atomicWrite(filePath, body);
    return NextResponse.json({ success: true, name });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
