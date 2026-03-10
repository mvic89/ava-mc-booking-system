import { NextRequest, NextResponse } from 'next/server';
import { deliverOrder } from '@/lib/svea/client';
import { insertWebhookEvent } from '@/lib/webhookStore';

/**
 * POST /api/svea/callback
 *
 * Svea calls this endpoint when an order status changes.
 * Registered via: POST /api/v2/callbacks/subscriptions (run once during setup).
 *
 * Events:
 *   CheckoutOrder.Created          → order created, waiting for customer
 *   CheckoutOrder.CreditSucceeded  → customer signed with BankID ✅ → auto-deliver
 *   CheckoutOrder.CreditFailed     → financing denied ❌
 *   CheckoutOrder.Delivered        → funds released to dealer
 *   CheckoutOrder.Closed           → order closed/cancelled
 *   CheckoutOrder.Updated          → order updated
 *
 * NOTE: In production, verify the request origin using your Svea HMAC secret
 * before trusting the payload.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('[Svea Callback] received:', JSON.stringify(body, null, 2));

    const eventName: string = body?.EventType ?? body?.eventType ?? '';
    const orderId: string   = body?.OrderId   ?? body?.orderId   ?? '';

    // Persist to Supabase so Realtime can push updates to the browser
    await insertWebhookEvent('svea', eventName || 'unknown', body);

    switch (eventName) {

      case 'CheckoutOrder.CreditSucceeded': {
        // ── Customer signed with BankID — financing approved ───────────
        console.log(`[Svea] ✅ CreditSucceeded — orderId: ${orderId}`);

        // Auto-deliver: tell Svea the order is delivered so funds are released.
        // In a full implementation you may want manual dealer confirmation instead.
        // Remove the auto-deliver below and use the /deliver button on the payment
        // page if your workflow requires explicit dealer sign-off before delivery.
        if (orderId) {
          try {
            await deliverOrder(orderId);
            console.log(`[Svea] ✅ deliverOrder called — orderId: ${orderId}`);
          } catch (deliverErr: any) {
            // Log but don't fail — the callback must still return 200
            console.error(`[Svea] deliverOrder failed for orderId ${orderId}:`, deliverErr.message);
          }
        }

        // TODO: persist to DB when ready:
        //   await db.payment.update({
        //     where:  { externalId: String(orderId) },
        //     data:   { status: 'CONFIRMED', confirmedAt: new Date() },
        //   });
        break;
      }

      case 'CheckoutOrder.CreditFailed': {
        // ── Financing denied — notify salesperson ──────────────────────
        console.log(`[Svea] ❌ CreditFailed — orderId: ${orderId}`);

        // TODO: persist to DB + notify salesperson via email/Slack:
        //   await db.payment.update({
        //     where: { externalId: String(orderId) },
        //     data:  { status: 'FAILED' },
        //   });
        break;
      }

      case 'CheckoutOrder.Created': {
        console.log(`[Svea] Order created — orderId: ${orderId}`);
        break;
      }

      case 'CheckoutOrder.Delivered': {
        // Fires after deliverOrder() succeeds — funds are now released to dealer
        console.log(`[Svea] ✅ Order delivered — funds released — orderId: ${orderId}`);

        // TODO: unlock delivery flow, notify logistics team:
        //   await unlockDelivery(agreementId);
        break;
      }

      case 'CheckoutOrder.Closed': {
        console.log(`[Svea] Order closed — orderId: ${orderId}`);
        break;
      }

      default: {
        console.log(`[Svea] Unknown event: ${eventName}`);
      }
    }

    // Svea expects 200 OK — any other status triggers retries
    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('[Svea Callback Error]', error.message);
    // Return 200 even on error so Svea doesn't keep retrying a malformed payload
    return new NextResponse(null, { status: 200 });
  }
}
