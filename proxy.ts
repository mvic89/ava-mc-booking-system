import {NextRequest, NextResponse} from 'next/server';

export function proxy(_request: NextRequest) {
  // Just pass through - locale is handled via cookies
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
