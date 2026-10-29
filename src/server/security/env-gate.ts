import { NextResponse } from 'next/server';

/**
 * Checks if the request is permitted in the current environment.
 * Rejects administrative and debugging routes in production environments.
 */
export function checkNonProductionOnly(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden: Endpoint disabled in production' },
      { status: 403 },
    );
  }
  return null;
}
