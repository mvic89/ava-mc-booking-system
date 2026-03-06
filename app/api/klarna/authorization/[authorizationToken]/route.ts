import { NextRequest, NextResponse } from 'next/server';
import { cancelKlarnaAuthorization } from '@/lib/klarna/client';

/**
 * DELETE /api/klarna/authorization/[authorizationToken]
 *
 * Cancel a Klarna authorization token.
 * Call this if the customer closes the checkout widget without completing payment,
 * or if you need to abort a pending authorization.
 *
 * Returns 204 No Content on success.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ authorizationToken: string }> },
) {
  try {
    const { authorizationToken } = await params;
    await cancelKlarnaAuthorization(authorizationToken);
    console.log(`[Klarna] Authorization cancelled — token: ${authorizationToken.slice(0, 12)}…`);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('[Klarna DELETE authorization]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
