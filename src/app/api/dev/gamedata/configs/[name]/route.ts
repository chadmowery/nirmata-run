import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { atomicWrite, errorResponse } from '../../utils';
import {
  EconomyConfigSchema,
  DepthConfigSchema,
  LootDistributionSchema,
} from '../../schemas';

const CONFIG_PATHS: Record<string, string> = {
  economy: path.join(process.cwd(), 'src/game/entities/templates/economy.json'),
  'depth-config': path.join(process.cwd(), 'src/game/generation/depth-config.json'),
  'loot-distribution': path.join(process.cwd(), 'src/game/generation/loot-distribution.json'),
};

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
    }

    await atomicWrite(filePath, body);
    return NextResponse.json({ success: true, name });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
