import { NextResponse } from 'next/server';
import { globalShellRegistry } from '@/game/shells';

import { logger } from '@engine/utils/logger';

export async function GET() {
  try {
    const templates = globalShellRegistry.getTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('[Shells] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
