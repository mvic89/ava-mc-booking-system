import { NextRequest } from 'next/server';
import { insertWebhookEvent } from '@/lib/webhookStore';

/**
 * General-purpose inbound webhook receiver.
 * Any external system (Zapier, n8n, Make, custom scripts) can POST here.
 *
 * POST /api/webhooks/inbound?provider=zapier
 * Body: { event_type: string, payload?: object }
 */
export async function POST(req: NextRequest) {
  try {
    const provider   = req.nextUrl.searchParams.get('provider') ?? 'custom';
    const body       = await req.json() as { event_type?: string; payload?: object; [k: string]: unknown };
    const event_type = (body.event_type as string | undefined) ?? 'custom.event';
    const payload    = (body.payload as object | undefined) ?? body;

    await insertWebhookEvent(provider, event_type, payload);

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[webhooks/inbound] error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Allow cross-origin POSTs from Zapier / n8n / etc.
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
