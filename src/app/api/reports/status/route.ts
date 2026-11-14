import { NextResponse } from 'next/server';
import { getReportsStatus } from '@server/reports/config';

export async function GET() {
  const status = getReportsStatus();
  return NextResponse.json(status);
}
