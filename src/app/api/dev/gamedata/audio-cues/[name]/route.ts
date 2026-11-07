import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { atomicWrite, errorResponse } from '../../utils';
import { SoundCueDefSchema, SoundCuesFileSchema } from '../../schemas';

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

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await params;

  try {
    const data = await readSoundCues();
    const cue = data.cues.find((c) => c.id === name);
    if (!cue) {
      return errorResponse(`Sound cue '${name}' not found`, 404);
    }
    return NextResponse.json(cue);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await params;

  try {
    const body = await req.json();

    if (body.id && body.id !== name) {
      return errorResponse(`Cue id in body ('${body.id}') does not match route param ('${name}')`, 400);
    }

    const parseResult = SoundCueDefSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid sound cue schema: ${parseResult.error.message}`, 400);
    }

    const data = await readSoundCues();
    const index = data.cues.findIndex((c) => c.id === name);
    if (index === -1) {
      return errorResponse(`Sound cue '${name}' not found`, 404);
    }

    data.cues[index] = body;

    const fileParsed = SoundCuesFileSchema.safeParse(data);
    if (!fileParsed.success) {
      return errorResponse(`Corrupt sound-cues file structure: ${fileParsed.error.message}`, 500);
    }

    await atomicWrite(CUES_FILE_PATH, data);
    return NextResponse.json({ success: true, cue: body });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await params;

  try {
    const data = await readSoundCues();
    const index = data.cues.findIndex((c) => c.id === name);
    if (index === -1) {
      return errorResponse(`Sound cue '${name}' not found`, 404);
    }

    data.cues.splice(index, 1);

    await atomicWrite(CUES_FILE_PATH, data);
    return NextResponse.json({ success: true, id: name });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
