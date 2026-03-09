import { NextRequest, NextResponse } from 'next/server';
import {
  getKlarnaSession,
  updateKlarnaSession,
  type KlarnaSessionRequest,
} from '@/lib/klarna/client';

/**
 * GET /api/klarna/session/[sessionId]
 *
 * Read an existing Klarna payment session.
 * Useful for refreshing the client_token if the page reloads during checkout.
 * Sessions are valid for 48 hours.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const session = await getKlarnaSession(sessionId);
    console.log(`[Klarna] Session read — session_id: ${session.session_id}`);
    return NextResponse.json(session);
  } catch (error: any) {
    console.error('[Klarna GET session]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/klarna/session/[sessionId]
 *
 * Update an existing Klarna payment session (e.g. to change the order amount
 * or line items after the session was created). Returns 204 No Content.
 *
 * Body: Partial<KlarnaSessionRequest>
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await req.json() as Partial<KlarnaSessionRequest>;
    await updateKlarnaSession(sessionId, body);
    console.log(`[Klarna] Session updated — session_id: ${sessionId}`);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('[Klarna POST session update]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
