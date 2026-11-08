import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { atomicWrite, errorResponse } from '../utils';
import { SoundCueDefSchema, SoundCuesFileSchema } from '../schemas';

const CUES_FILE_PATH = path.join(process.cwd(), 'src/game/audio/sound-cues.json');

interface SoundCuesData {
  $schema?: string;
  version?: string;
  cues: Array<{ id: string; [key: string]: unknown }>;
}

async function readSoundCues(): Promise<SoundCuesData> {
  const content = await fs.readFile(CUES_FILE_PATH, 'utf-8');
  return JSON.parse(content) as SoundCuesData;
}

export async function GET() {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const data = await readSoundCues();
    const items = data.cues.map((c) => c.id);
    return NextResponse.json({ items, cues: data.cues });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to read sound cues', 500);
  }
}

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const body = await req.json();

    const parseResult = SoundCueDefSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid sound cue schema: ${parseResult.error.message}`, 400);
    }

    const data = await readSoundCues();
    const existingIndex = data.cues.findIndex((c) => c.id === body.id);
    if (existingIndex !== -1) {
      return errorResponse(`Sound cue '${body.id}' already exists`, 409);
    }

    data.cues.push(body);

    const fileParsed = SoundCuesFileSchema.safeParse(data);
    if (!fileParsed.success) {
      return errorResponse(`Corrupt sound-cues file structure: ${fileParsed.error.message}`, 500);
    }

    await atomicWrite(CUES_FILE_PATH, data);
    return NextResponse.json({ success: true, id: body.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
