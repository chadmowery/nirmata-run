import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection proxy for Nirmata Runner.
 * Completely disables dev-tool, administrative, and debugging endpoints in production builds.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const pathname = request.nextUrl.pathname;
    if (
      pathname.startsWith('/dev') ||
      pathname.startsWith('/api/dev') ||
      pathname.startsWith('/api/admin') ||
      pathname.startsWith('/api/debug')
    ) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dev/:path*', '/api/dev/:path*', '/api/admin/:path*', '/api/debug/:path*'],
};
