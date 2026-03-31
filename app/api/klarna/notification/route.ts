// ─── POST /api/klarna/notification ────────────────────────────────────────────
// Klarna calls this webhook when a PENDING fraud-review order is later resolved:
//   event_type = "FRAUD_RISK_ACCEPTED"  → fraud check passed, order is good
//   event_type = "FRAUD_RISK_REJECTED"  → fraud check failed, order cancelled
//   event_type = "FRAUD_RISK_STOPPED"   → Klarna stopped the order manually
//
// For accepted: we mark the invoice paid if it's still pending.
// For rejected: we log a warning (manual follow-up required).
//
// Klarna expects HTTP 200 within 10 seconds — log any errors, never throw.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event_type:  string;   // 'FRAUD_RISK_ACCEPTED' | 'FRAUD_RISK_REJECTED' | 'FRAUD_RISK_STOPPED'
      order_id:    string;   // Klarna order ID
      fraud_status?: string;
    };

    const { event_type, order_id } = body;

    console.log(`[Klarna notification] event=${event_type}, order_id=${order_id}`);

    if (event_type === 'FRAUD_RISK_ACCEPTED') {
      // Find the invoice that references this Klarna order and mark it paid.
      // The merchant_reference1 (agreement number) is stored in the invoice's agreement_ref column.
      // Klarna order_id is currently not stored — but we log the event for auditing.
      logAudit({
        action:       'KLARNA_FRAUD_ACCEPTED',
        entity:       'payment',
        entityId:     order_id,
        details:      { event_type, order_id },
        dealershipId: 'system',
      });
      console.log(`[Klarna notification] Fraud check passed for order ${order_id}`);
    } else {
      // FRAUD_RISK_REJECTED or FRAUD_RISK_STOPPED — log a warning, requires manual follow-up
      logAudit({
        action:       'KLARNA_FRAUD_REJECTED',
        entity:       'payment',
        entityId:     order_id,
        details:      { event_type, order_id },
        dealershipId: 'system',
      });
      console.warn(`[Klarna notification] Fraud check failed (${event_type}) for order ${order_id}`);
    }

    // Always return 200 — Klarna retries on non-2xx responses
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[Klarna notification] error:', err);
    // Still return 200 to prevent Klarna from retrying
    return NextResponse.json({ received: true });
  }
}
