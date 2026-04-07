import { NextResponse } from 'next/server';
import { globalShellRegistry } from '@/game/shells';

export async function GET() {
  try {
    const templates = globalShellRegistry.getTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[Shells] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
