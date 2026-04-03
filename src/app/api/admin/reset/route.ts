import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executeWeeklyReset } from '../../../../game/systems/weekly-reset';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

const ResetRequestSchema = z.object({
  sessionId: z.string(),
  newWeekSeed: z.number(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = ResetRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: result.error 
      }, { status: 400 });
    }

    const { sessionId, newWeekSeed } = result.data;
    const resetResult = await executeWeeklyReset(profileRepository, sessionId, newWeekSeed);

    if (!resetResult.wasReset) {
      return NextResponse.json({
        success: true,
        message: 'Already reset for this week seed',
        winnersItem: resetResult.winnersItem,
      });
    }

    return NextResponse.json({
      success: true,
      ...resetResult,
    });

  } catch (error: any) {
    const message = error.message || 'Internal Server Error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
