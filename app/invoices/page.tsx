'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { getInvoices, type Invoice } from '@/lib/invoices';
import { useAutoRefresh } from '@/lib/realtime';

// ─── Print helper ─────────────────────────────────────────────────────────────

function openInvoicePrintWindow(inv: Invoice, labels: Record<string, string>) {
  const fmt = (n: number) => n.toLocaleString('sv-SE');
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <title>${labels.title} ${inv.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a2a42;background:#fff;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF6B2C;padding-bottom:24px;margin-bottom:32px}
    .logo{font-size:24px;font-weight:900;color:#FF6B2C;letter-spacing:-0.5px}
    .logo span{color:#0b1524}
    .inv-num{text-align:right}
    .inv-num h1{font-size:18px;font-weight:800;color:#0b1524}
    .inv-num p{font-size:13px;color:#64748b;margin-top:4px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
    .meta-block h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:6px}
    .meta-block p{font-size:13px;color:#1e293b;line-height:1.6}
    table{width:100%;border-collapse:collapse;margin-bottom:32px}
    thead th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0}
    tbody td{padding:12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9}
    .totals{max-width:300px;margin-left:auto}
    .totals tr td{padding:6px 12px;font-size:13px}
    .totals tr td:last-child{text-align:right;font-weight:600}
    .totals .grand td{font-size:15px;font-weight:800;color:#FF6B2C;border-top:2px solid #FF6B2C;padding-top:10px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .paid{background:#dcfce7;color:#166534}
    .pending{background:#fef9c3;color:#854d0e}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
    @media print{body{padding:20px} button{display:none}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">AVA <span>MC</span></div>
      <p style="font-size:12px;color:#64748b;margin-top:4px">AVA MC AB • Org.nr 556123-4567<br>Kista, Stockholm • info@avamc.se</p>
    </div>
    <div class="inv-num">
      <h1>${labels.title} ${inv.id}</h1>
      <p>${labels.issued}: ${fmtDate(inv.issueDate)}</p>
      ${inv.paidDate ? `<p>${labels.paid}: ${fmtDate(inv.paidDate)}</p>` : ''}
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <h3>${labels.customer}</h3>
      <p>${inv.customerName}</p>
    </div>
    <div class="meta-block">
      <h3>${labels.agreement}</h3>
      <p>${inv.agreementRef}</p>
    </div>
    <div class="meta-block">
      <h3>${labels.vehicle}</h3>
      <p>${inv.vehicle}</p>
    </div>
    <div class="meta-block">
      <h3>${labels.method}</h3>
      <p>${inv.paymentMethod}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:60%">${labels.desc}</th>
        <th style="text-align:right">${labels.amount}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${labels.desc} — ${inv.vehicle}<br><span style="font-size:11px;color:#64748b">${inv.agreementRef}</span></td>
        <td style="text-align:right">${fmt(inv.netAmount)} kr</td>
      </tr>
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr><td>${labels.net}</td><td>${fmt(inv.netAmount)} kr</td></tr>
      <tr><td>${labels.vat}</td><td>${fmt(inv.vatAmount)} kr</td></tr>
      <tr class="grand"><td>${labels.total}</td><td>${fmt(inv.totalAmount)} kr</td></tr>
    </tbody>
  </table>

  <div style="text-align:center;margin-top:16px">
    <span class="badge ${inv.status}">${inv.status === 'paid' ? labels.badgePaid : labels.badgePending}</span>
  </div>

  <div class="footer">${labels.footer}</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'paid' | 'pending';

export default function InvoicesPage() {
  const router = useRouter();
  const t = useTranslations('invoices');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter]     = useState<FilterTab>('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    setInvoices(getInvoices());
  }, [router]);

  useAutoRefresh(() => setInvoices(getInvoices()));

  // ── Computed stats ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const paid    = invoices.filter(i => i.status === 'paid');
    const pending = invoices.filter(i => i.status === 'pending');
    const revenue = paid.reduce((s, i) => s + i.totalAmount, 0);
    return { total: invoices.length, paid: paid.length, pending: pending.length, revenue };
  }, [invoices]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter(i => {
        if (filter === 'paid'    && i.status !== 'paid')    return false;
        if (filter === 'pending' && i.status !== 'pending') return false;
        if (q && !(
          i.customerName.toLowerCase().includes(q) ||
          i.vehicle.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          i.agreementRef.toLowerCase().includes(q)
        )) return false;
        return true;
      });
  }, [invoices, filter, search]);

  // ── Print labels passed to popup ──────────────────────────────────────────

  const printLabels = {
    title:      t('printTitle'),
    issued:     t('printIssued'),
    paid:       t('printPaid'),
    method:     t('printMethod'),
    customer:   t('printCustomer'),
    vehicle:    t('printVehicle'),
    agreement:  t('printAgreement'),
    desc:       t('printDesc'),
    net:        t('printNet'),
    vat:        t('printVat'),
    total:      t('printTotal'),
    amount:     t('colAmount'),
    badgePaid:  t('badgePaid'),
    badgePending: t('badgePending'),
    footer:     t('printFooter'),
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtAmount = (n: number) => `${n.toLocaleString('sv-SE')} kr`;

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all',     label: t('filterAll'),     count: stats.total   },
    { id: 'paid',    label: t('filterPaid'),    count: stats.paid    },
    { id: 'pending', label: t('filterPending'), count: stats.pending },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{t('breadcrumb')}</p>
          <h1 className="text-2xl font-black text-[#0b1524]">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>

        <div className="flex-1 px-5 md:px-8 py-6 space-y-5">

          {/* ── Stats bar ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('statTotal'),   value: fmtAmount(stats.revenue), icon: '💰', color: 'text-[#FF6B2C]' },
              { label: t('statCount'),   value: String(stats.total),       icon: '📄', color: 'text-slate-700' },
              { label: t('statPaid'),    value: String(stats.paid),         icon: '✅', color: 'text-green-600' },
              { label: t('statPending'), value: String(stats.pending),      icon: '⏳', color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filter tabs + search ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
              {/* Tabs */}
              <div className="flex items-center gap-1">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filter === tab.id
                        ? 'bg-[#FF6B2C] text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      filter === tab.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]/50"
                />
              </div>
            </div>

            {/* ── Table ──────────────────────────────────────────────────── */}
            {visible.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
                <span className="text-4xl">📄</span>
                <p className="text-sm font-semibold">{t('empty')}</p>
                <p className="text-xs text-slate-300">{t('emptyHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {[t('colInvoice'), t('colDate'), t('colCustomer'), t('colVehicle'), t('colMethod'), t('colAmount'), t('colStatus'), t('colActions')].map(col => (
                        <th key={col} className="px-4 py-3 text-left font-semibold text-slate-400 uppercase tracking-wide text-[10px] whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((inv, idx) => (
                      <tr
                        key={inv.id}
                        className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        {/* Invoice ID */}
                        <td className="px-4 py-3 font-mono font-bold text-[#0b1524] whitespace-nowrap">
                          {inv.id}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {fmtDate(inv.issueDate)}
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                          {inv.customerName}
                        </td>

                        {/* Vehicle */}
                        <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                          {inv.vehicle}
                        </td>

                        {/* Payment method */}
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {inv.paymentMethod}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                          {fmtAmount(inv.totalAmount)}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.status === 'paid' ? '✓' : '·'} {inv.status === 'paid' ? t('badgePaid') : t('badgePending')}
                          </span>
                        </td>

                        {/* Print button */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openInvoicePrintWindow(inv, printLabels)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-[#FF6B2C]/40 hover:text-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            {t('printBtn')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
