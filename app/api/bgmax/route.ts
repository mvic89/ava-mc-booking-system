import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/bgmax
 *
 * Parses a Bankgiro MAX (BGMAX) file uploaded by the dealer and matches
 * transactions to pending invoices. On match, the invoice is marked paid
 * and a payment_notification row is inserted.
 *
 * BGMAX format (ISO-8859-1 / UTF-8 compatible for ASCII ranges):
 *   TK01 — header (file info)
 *   TK05 — opening balance
 *   TK20 — payment (debit) row  ← we care about these
 *   TK21/22 — extra references
 *   TK25 — return transaction
 *   TK26 — extra reference for return
 *   TK29 — deduction
 *   TK15 — closing balance
 *   TK70 — footer
 *
 * Each TK20 row:
 *   pos 1-2:   trans code "20"
 *   pos 3-12:  bankgiro number (10 chars)
 *   pos 13-37: reference (25 chars, left-justified, padded spaces)
 *   pos 38-52: amount in öre (15 digits, right-justified)
 *   pos 53:    payment channel (1 char)
 *   pos 54:    sign (space = positive/credit, + = credit, - = debit/return)
 *   pos 55-62: BGC serial number (8 digits)
 *   pos 63-70: payment date YYYYMMDD
 *   pos 71:    image flag
 *
 * Body: multipart/form-data with field "file" (the .txt BGMAX file)
 *        OR JSON { content: string (file text), dealershipId: string }
 */

// ── Parser ─────────────────────────────────────────────────────────────────────

export interface BgmaxTransaction {
  bgiroNumber:  string;   // payee bankgiro
  reference:    string;   // OCR / reference number (trimmed)
  amountOere:   number;   // raw amount in öre
  amountSEK:    number;   // converted to SEK
  isReturn:     boolean;
  serialNumber: string;
  paymentDate:  string;   // YYYY-MM-DD
}

export function parseBgmax(content: string): BgmaxTransaction[] {
  const lines       = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const transactions: BgmaxTransaction[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.length < 2) continue;
    const tk = line.slice(0, 2);

    // TK20 — incoming payment
    if (tk === '20' && line.length >= 70) {
      const bgiroNumber  = line.slice(2, 12).trim();
      const reference    = line.slice(12, 37).trim();
      const amountStr    = line.slice(37, 52).trim();
      const signChar     = line.slice(53, 54);
      const serialNumber = line.slice(54, 62).trim();
      const dateRaw      = line.slice(62, 70);

      const amountOere = parseInt(amountStr, 10) || 0;
      const isReturn   = signChar === '-';

      const yyyy = dateRaw.slice(0, 4);
      const mm   = dateRaw.slice(4, 6);
      const dd   = dateRaw.slice(6, 8);
      const paymentDate = `${yyyy}-${mm}-${dd}`;

      transactions.push({
        bgiroNumber,
        reference,
        amountOere,
        amountSEK: amountOere / 100,
        isReturn,
        serialNumber,
        paymentDate,
      });
    }
  }

  return transactions;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let content      = '';
    let dealershipId = '';

    const ct = req.headers.get('content-type') ?? '';

    if (ct.includes('multipart/form-data')) {
      const formData    = await req.formData();
      const file        = formData.get('file') as File | null;
      dealershipId      = String(formData.get('dealershipId') ?? '');
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      content = await file.text();
    } else {
      const body   = await req.json() as { content: string; dealershipId: string };
      content      = body.content;
      dealershipId = body.dealershipId;
    }

    if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
    if (!content)      return NextResponse.json({ error: 'Empty BGMAX content' }, { status: 400 });

    const transactions = parseBgmax(content);
    if (transactions.length === 0) {
      return NextResponse.json({ matched: 0, unmatched: 0, transactions: [] });
    }

    const supabase = getSupabaseAdmin();

    // Load pending invoices for this dealership
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, reference_number, total_amount, lead_id, customer_name, vehicle')
      .eq('dealership_id', dealershipId)
      .eq('status', 'pending');

    const pending = invoices ?? [];

    const results: Array<{
      transaction: BgmaxTransaction;
      invoiceId: string | null;
      matched: boolean;
      error?: string;
    }> = [];

    for (const tx of transactions) {
      if (tx.isReturn) {
        results.push({ transaction: tx, invoiceId: null, matched: false });
        continue;
      }

      // Match by reference number or amount
      const matched = pending.find(inv =>
        inv.reference_number && (
          // Exact reference match (OCR)
          inv.reference_number.replace(/\s/g, '') === tx.reference.replace(/\s/g, '') ||
          // Amount match as fallback (within 1 SEK tolerance)
          Math.abs(Number(inv.total_amount) - tx.amountSEK) < 1
        )
      );

      if (matched) {
        // Mark invoice as paid
        const { error: updateErr } = await supabase
          .from('invoices')
          .update({
            status:     'paid',
            paid_at:    tx.paymentDate,
          })
          .eq('id', matched.id)
          .eq('dealership_id', dealershipId);

        // Insert payment notification
        const { error: notifErr } = await supabase
          .from('payment_notifications')
          .insert({
            dealership_id:     dealershipId,
            lead_id:           matched.lead_id ?? null,
            invoice_id:        matched.id,
            notification_type: 'bgmax_matched',
            amount:            tx.amountSEK,
            currency:          'SEK',
            reference:         tx.reference,
            customer_name:     matched.customer_name ?? null,
            vehicle:           matched.vehicle       ?? null,
            read:              false,
          });

        if (updateErr || notifErr) {
          results.push({ transaction: tx, invoiceId: matched.id, matched: true, error: updateErr?.message ?? notifErr?.message });
        } else {
          results.push({ transaction: tx, invoiceId: matched.id, matched: true });
        }
      } else {
        results.push({ transaction: tx, invoiceId: null, matched: false });
      }
    }

    const matchedCount   = results.filter(r => r.matched).length;
    const unmatchedCount = results.filter(r => !r.matched && !r.transaction.isReturn).length;

    return NextResponse.json({
      matched:   matchedCount,
      unmatched: unmatchedCount,
      returns:   results.filter(r => r.transaction.isReturn).length,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[bgmax]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
