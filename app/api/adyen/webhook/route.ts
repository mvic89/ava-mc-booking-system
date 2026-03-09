import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/adyen/webhook — Adyen event notifications
 * In production: validate HMAC signature using ADYEN_WEBHOOK_HMAC_KEY
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const notifications = body?.notificationItems ?? [];

    for (const item of notifications) {
      const n = item?.NotificationRequestItem;
      if (!n) continue;

      const { eventCode, success, pspReference, merchantReference } = n;
      console.log(`[Adyen webhook] ${eventCode} — ref: ${pspReference} order: ${merchantReference} success: ${success}`);

      switch (eventCode) {
        case 'AUTHORISATION':
          if (success === 'true') {
            // TODO: mark order as authorised in DB
          }
          break;
        case 'CAPTURE':
          if (success === 'true') {
            // TODO: mark order as captured/paid
          }
          break;
        case 'REFUND':
          if (success === 'true') {
            // TODO: mark order as refunded
          }
          break;
        case 'CANCELLATION':
          // TODO: handle cancellation
          break;
        case 'CHARGEBACK':
          console.warn(`[Adyen] Chargeback received — ${pspReference}`);
          break;
      }
    }

    // Adyen expects "[accepted]" as response body
    return new NextResponse('[accepted]', { status: 200 });
  } catch (error: any) {
    console.error('[Adyen webhook error]', error.message);
    return new NextResponse('[accepted]', { status: 200 }); // always 200
  }
}
