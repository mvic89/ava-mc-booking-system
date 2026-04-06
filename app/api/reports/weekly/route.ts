// ─── Weekly Sales Summary Report ──────────────────────────────────────────────
// Two entry-points:
//   POST /api/reports/weekly          — manual trigger (admin UI "Send test report")
//                                       body: { dealershipId, email }
//   GET  /api/reports/weekly?secret=… — Vercel Cron (every Monday 08:00 UTC)
//                                       Reads all dealerships and sends to each admin.

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeadRow    { stage: string; value: number; cost_price?: number; salesperson_name?: string; created_at: string }
interface InvoiceRow { status: string; total_amount: number; paid_date?: string; issue_date: string }
interface CustomerRow { id: number; created_at: string }
interface SettingsRow { smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass: string; admin_email: string; name?: string }

// ── Date helpers ───────────────────────────────────────────────────────────────

function startOf7DaysAgo(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function kr(n: number) { return `${Math.round(n).toLocaleString('sv-SE')} kr`; }
function pct(n: number, d: number) { return d > 0 ? `${Math.round((n / d) * 100)} %` : '—'; }

// ── Build report data ──────────────────────────────────────────────────────────

async function buildReport(dealershipId: string) {
  const sb    = getSupabaseAdmin();
  const since = startOf7DaysAgo().toISOString();

  const [leadsRes, invoicesRes, customersRes] = await Promise.all([
    sb.from('leads').select('stage,value,cost_price,salesperson_name,created_at').eq('dealership_id', dealershipId),
    sb.from('invoices').select('status,total_amount,paid_date,issue_date').eq('dealership_id', dealershipId),
    sb.from('customers').select('id,created_at').eq('dealership_id', dealershipId),
  ]);

  const leads     = (leadsRes.data     ?? []) as LeadRow[];
  const invoices  = (invoicesRes.data  ?? []) as InvoiceRow[];
  const customers = (customersRes.data ?? []) as CustomerRow[];

  // ── This week slices ─────────────────────────────────────────────────────────
  const weekLeads     = leads.filter(l => l.created_at >= since);
  const weekInvoices  = invoices.filter(i => (i.paid_date ?? i.issue_date) >= since);
  const weekCustomers = customers.filter(c => (c as any).created_at >= since);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const paidThisWeek   = weekInvoices.filter(i => i.status === 'paid');
  const weekRevenue    = paidThisWeek.reduce((s, i) => s + Number(i.total_amount), 0);
  const closedThisWeek = weekLeads.filter(l => l.stage === 'closed');

  // All-time gross profit from closed leads with cost
  const closedAll        = leads.filter(l => l.stage === 'closed' && (l.cost_price ?? 0) > 0);
  const totalGrossProfit = closedAll.reduce((s, l) => s + (Number(l.value) - Number(l.cost_price ?? 0)), 0);
  const avgMarginPct     = closedAll.length
    ? Math.round(closedAll.reduce((s, l) => {
        const margin = l.value > 0 ? (Number(l.value) - Number(l.cost_price ?? 0)) / Number(l.value) * 100 : 0;
        return s + margin;
      }, 0) / closedAll.length)
    : 0;

  // All-time lead conversion
  const closedTotal  = leads.filter(l => l.stage === 'closed').length;
  const convRateAll  = pct(closedTotal, leads.length);

  // ── Salesperson leaderboard (all-time, top 5) ─────────────────────────────
  const sellerMap: Record<string, { closed: number; revenue: number }> = {};
  leads.filter(l => l.stage === 'closed').forEach(l => {
    const name = l.salesperson_name || 'Okänd';
    if (!sellerMap[name]) sellerMap[name] = { closed: 0, revenue: 0 };
    sellerMap[name].closed++;
    sellerMap[name].revenue += Number(l.value);
  });
  const leaderboard = Object.entries(sellerMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // ── Pending invoices ──────────────────────────────────────────────────────
  const pendingAmount = invoices
    .filter(i => i.status === 'pending')
    .reduce((s, i) => s + Number(i.total_amount), 0);
  const pendingCount = invoices.filter(i => i.status === 'pending').length;

  return {
    weekRevenue, weekLeadsCount: weekLeads.length, closedThisWeek: closedThisWeek.length,
    newCustomers: weekCustomers.length, paidInvoicesThisWeek: paidThisWeek.length,
    totalGrossProfit, avgMarginPct, convRateAll,
    pendingAmount, pendingCount,
    leaderboard,
    totalLeads: leads.length, totalCustomers: customers.length,
  };
}

// ── Build HTML email ───────────────────────────────────────────────────────────

function buildEmailHtml(data: Awaited<ReturnType<typeof buildReport>>, dealershipName: string): string {
  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const leaderRows = data.leaderboard.map(([name, s], i) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${['🥇','🥈','🥉','4.','5.'][i] ?? `${i+1}.`} ${name}</td>
      <td style="padding:8px 12px;text-align:right;font-size:13px;font-weight:600;color:#111827;">${kr(s.revenue)}</td>
      <td style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280;">${s.closed} avslut</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e2a3f 0%,#235971 100%);padding:28px 32px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">BikeMeNow · ${dealershipName}</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">📊 Veckoresumé</h1>
      <p style="margin:6px 0 0;color:#64748b;font-size:13px;">${today}</p>
    </div>

    <!-- This week -->
    <div style="padding:24px 32px 16px;">
      <p style="margin:0 0 16px;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;font-weight:600;">SENASTE 7 DAGARNA</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${[
          { label: 'Intäkt',             value: kr(data.weekRevenue),               color: '#FF6B2C' },
          { label: 'Betalda fakturor',   value: String(data.paidInvoicesThisWeek),  color: '#10b981' },
          { label: 'Nya leads',          value: String(data.weekLeadsCount),        color: '#8b5cf6' },
          { label: 'Avslutade affärer',  value: String(data.closedThisWeek),        color: '#235971' },
          { label: 'Nya kunder',         value: String(data.newCustomers),          color: '#f59e0b' },
          { label: 'Väntande fakturor',  value: `${data.pendingCount} (${kr(data.pendingAmount)})`, color: '#ef4444' },
        ].map(k => `
          <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #f1f5f9;">
            <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${k.label}</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:${k.color};">${k.value}</p>
          </div>`).join('')}
      </div>
    </div>

    <!-- All-time KPIs -->
    <div style="padding:8px 32px 16px;">
      <p style="margin:0 0 16px;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;font-weight:600;">TOTALT (ALLA TIDER)</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        ${[
          { label: 'Total bruttovinst', value: kr(data.totalGrossProfit), color: '#10b981' },
          { label: 'Snittmarginal',     value: `${data.avgMarginPct} %`,  color: data.avgMarginPct >= 15 ? '#10b981' : '#f59e0b' },
          { label: 'Konvertering',      value: data.convRateAll,          color: '#8b5cf6' },
        ].map(k => `
          <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;border:1px solid #f1f5f9;text-align:center;">
            <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;">${k.label}</p>
            <p style="margin:0;font-size:18px;font-weight:800;color:${k.color};">${k.value}</p>
          </div>`).join('')}
      </div>
    </div>

    <!-- Leaderboard -->
    ${leaderRows ? `
    <div style="padding:8px 32px 24px;">
      <p style="margin:0 0 12px;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;font-weight:600;">🏆 TOPPSÄLJARE (ALLA TIDER)</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;border:1px solid #f1f5f9;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Säljare</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;">Intäkt</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;">Avslut</th>
          </tr>
        </thead>
        <tbody>${leaderRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Automatisk rapport från BikeMeNow · Skickas varje måndag kl 08:00</p>
      <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1;">${dealershipName} · ${data.totalLeads} leads · ${data.totalCustomers} kunder totalt</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Send via SMTP ──────────────────────────────────────────────────────────────

async function sendWeeklyReport(dealershipId: string, overrideEmail?: string): Promise<void> {
  const sb = getSupabaseAdmin();

  // Fetch SMTP settings and admin email from dealerships
  const { data: settingsRow, error: settingsErr } = await sb
    .from('dealerships')
    .select('smtp_host,smtp_port,smtp_user,smtp_pass,admin_email,name')
    .eq('id', dealershipId)
    .maybeSingle();

  if (settingsErr || !settingsRow) throw new Error('No dealership settings found for ' + dealershipId);

  const settings = settingsRow as SettingsRow;
  if (!settings.smtp_user || !settings.smtp_pass) throw new Error('SMTP not configured — set it under Settings → Integrations');

  const toEmail       = overrideEmail ?? settings.admin_email ?? settings.smtp_user;
  const dealerName    = settings.name ?? 'Dealership';
  const reportData    = await buildReport(dealershipId);
  const html          = buildEmailHtml(reportData, dealerName);
  const weekStart     = startOf7DaysAgo().toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  const weekEnd       = new Date().toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });

  const isGmail   = (settings.smtp_host ?? '').includes('gmail');
  const transport = nodemailer.createTransport(
    isGmail
      ? { service: 'gmail', auth: { user: settings.smtp_user, pass: settings.smtp_pass } }
      : {
          host:   settings.smtp_host ?? 'smtp.gmail.com',
          port:   settings.smtp_port ?? 587,
          secure: (settings.smtp_port ?? 587) === 465,
          auth:   { user: settings.smtp_user, pass: settings.smtp_pass },
        },
  );

  await transport.sendMail({
    from:    `"BikeMeNow Analytics" <${settings.smtp_user}>`,
    to:      toEmail,
    subject: `📊 Veckoresumé ${weekStart}–${weekEnd} · ${dealerName}`,
    html,
  });
}

// ── POST /api/reports/weekly  (manual trigger from admin UI) ──────────────────

export async function POST(req: NextRequest) {
  try {
    const { dealershipId, email } = await req.json() as { dealershipId?: string; email?: string };
    if (!dealershipId) return NextResponse.json({ error: 'Missing dealershipId' }, { status: 400 });
    await sendWeeklyReport(dealershipId, email);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reports/weekly] POST error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── GET /api/reports/weekly  (Vercel Cron — every Monday 08:00 UTC) ───────────

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = getSupabaseAdmin();
    // Fetch all dealerships that have SMTP configured
    const { data: settings } = await sb
      .from('dealerships')
      .select('id,admin_email,smtp_user,smtp_pass')
      .not('smtp_user', 'is', null)
      .not('smtp_pass', 'is', null);

    if (!settings?.length) return NextResponse.json({ ok: true, sent: 0, message: 'No dealerships with SMTP configured' });

    const results = await Promise.allSettled(
      (settings as { id: string; admin_email: string }[]).map(s =>
        sendWeeklyReport(s.id),
      ),
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason?.message ?? 'Unknown');

    console.log(`[reports/weekly] Cron: ${succeeded}/${settings.length} sent. Failures: ${failed.join(', ') || 'none'}`);
    return NextResponse.json({ ok: true, sent: succeeded, total: settings.length, errors: failed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reports/weekly] GET cron error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
