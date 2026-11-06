import { NextResponse } from 'next/server';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { errorResponse } from '../../utils';
import {
  generateRoomPrefab,
  RoomGeneratorConfigSchema,
} from '@/game/generation/prefabs/room-generator';
import { validatePrefabRules } from '../../prefab-validator';

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const body = await req.json();
    const parseResult = RoomGeneratorConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid generator config: ${parseResult.error.message}`, 400);
    }

    const prefab = generateRoomPrefab(parseResult.data);
    const audit = validatePrefabRules(prefab);

    return NextResponse.json({
      success: true,
      prefab,
      audit,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
