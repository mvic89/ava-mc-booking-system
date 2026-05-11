'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getInvoices, updateInvoicePaymentMethod, markInvoicePaidById, type Invoice } from '@/lib/invoices';
import { useAutoRefresh } from '@/lib/realtime';
import { getDealerInfo } from '@/lib/dealer';
import { Tip } from '@/components/Tip';

// ─── Print helper ─────────────────────────────────────────────────────────────

function openInvoicePrintWindow(inv: Invoice, labels: Record<string, string>) {
  const dealer = getDealerInfo();
  const fmt = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Determine purchase type ──────────────────────────────────────────────────
  const isService  = inv.id.startsWith('SRV-');
  const hasParts   = (inv.parts?.length ?? 0) > 0;
  const rawVehicle = inv.vehicle ?? '';
  const isAccOnly  = rawVehicle.startsWith('Tillbehör:') || rawVehicle.startsWith('Accessories:');
  const hasVehicle = rawVehicle && rawVehicle !== '—' && !isAccOnly;

  // Meta label for the "what was bought" block
  let purchaseTypeLabel: string;
  if (isService)               purchaseTypeLabel = labels.typeService;
  else if (isAccOnly)          purchaseTypeLabel = labels.typeAccessories;
  else if (!hasVehicle && hasParts) purchaseTypeLabel = labels.typeSpareParts;
  else if (hasVehicle && hasParts)  purchaseTypeLabel = labels.typeVehicleExtras;
  else                              purchaseTypeLabel = labels.typeVehicle;

  // The display value for the meta "what" block
  const purchaseDisplay = hasVehicle
    ? rawVehicle
    : hasParts
      ? (inv.parts ?? []).map(p => `${p.name} ×${p.quantity}`).join(', ')
      : rawVehicle || '—';

  // ── Build line items ─────────────────────────────────────────────────────────
  let itemRows = '';

  if (hasVehicle) {
    // Vehicle row — cost is the net minus any parts costs
    const partsCost = (inv.parts ?? []).reduce((s, p) => s + p.total_cost, 0);
    const vehicleCost = inv.netAmount - partsCost;
    itemRows += `
      <tr>
        <td>
          <strong>${labels.typeVehicle}</strong> — ${rawVehicle}
          ${inv.agreementRef ? `<br><span style="font-size:11px;color:#64748b">${inv.agreementRef}</span>` : ''}
        </td>
        <td style="text-align:right">${fmt(vehicleCost > 0 ? vehicleCost : inv.netAmount)} kr</td>
      </tr>`;
  }

  if (isService && !hasParts && !hasVehicle) {
    itemRows += `
      <tr>
        <td><strong>${labels.typeService}</strong>${inv.agreementRef ? ` — ${inv.agreementRef}` : ''}</td>
        <td style="text-align:right">${fmt(inv.netAmount)} kr</td>
      </tr>`;
  }

  if (hasParts) {
    for (const part of (inv.parts ?? [])) {
      itemRows += `
        <tr>
          <td>
            <span style="font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;margin-right:6px">×${part.quantity}</span>
            ${part.name}
            ${part.part_number ? `<span style="font-size:10px;color:#94a3b8;margin-left:6px">(${part.part_number})</span>` : ''}
          </td>
          <td style="text-align:right">${fmt(part.total_cost)} kr</td>
        </tr>`;
    }
  }

  if (!itemRows) {
    itemRows = `
      <tr>
        <td>${purchaseTypeLabel}${inv.agreementRef ? ` — ${inv.agreementRef}` : ''}</td>
        <td style="text-align:right">${fmt(inv.netAmount)} kr</td>
      </tr>`;
  }

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
      <div class="logo">${dealer.name}</div>
      <p style="font-size:12px;color:#64748b;margin-top:4px">${dealer.name} • Org.nr ${dealer.orgNr}<br>${dealer.city} • ${dealer.email}</p>
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
      <p>${inv.agreementRef || '—'}</p>
    </div>
    <div class="meta-block">
      <h3>${purchaseTypeLabel}</h3>
      <p>${purchaseDisplay}</p>
    </div>
    <div class="meta-block">
      <h3>${labels.method}</h3>
      <p>${inv.paymentMethod || '—'}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:65%">${purchaseTypeLabel}</th>
        <th style="text-align:right">${labels.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      ${inv.vatScheme === 'margin'
        ? `<tr class="grand"><td>${labels.total}</td><td>${fmt(inv.totalAmount)} kr</td></tr>
           <tr><td colspan="2" style="font-size:10px;color:#666;padding-top:4px">Marginalbeskattning — moms specificeras ej (9a kap ML)</td></tr>`
        : inv.vatScheme === 'exempt'
          ? `<tr><td>${labels.net}</td><td>${fmt(inv.totalAmount)} kr</td></tr>
             <tr><td>Moms</td><td>0 kr (momsfri)</td></tr>
             <tr class="grand"><td>${labels.total}</td><td>${fmt(inv.totalAmount)} kr</td></tr>`
          : `<tr><td>${labels.net}</td><td>${fmt(inv.netAmount)} kr</td></tr>
             <tr><td>${labels.vat} 25 %</td><td>${fmt(inv.vatAmount)} kr</td></tr>
             <tr class="grand"><td>${labels.total}</td><td>${fmt(inv.totalAmount)} kr</td></tr>`
      }
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

// ─── Purchase type classifier ─────────────────────────────────────────────────

interface PurchaseClass {
  label:    string;
  icon:     string;
  badgeCls: string;
}

function classifyInvoice(inv: Invoice): PurchaseClass {
  const isService  = inv.id.startsWith('SRV-');
  const hasParts   = (inv.parts?.length ?? 0) > 0;
  const rawVehicle = inv.vehicle ?? '';
  const isAccOnly  = rawVehicle.startsWith('Tillbehör:') || rawVehicle.startsWith('Accessories:');
  const hasVehicle = rawVehicle && rawVehicle !== '—' && !isAccOnly;

  if (isService && hasParts && hasVehicle)
    return { label: 'Service + reservdelar', icon: '🛠️', badgeCls: 'bg-teal-100 text-teal-700' };
  if (isService)
    return { label: 'Service',               icon: '🛠️', badgeCls: 'bg-teal-100 text-teal-700' };
  if (isAccOnly && hasParts)
    return { label: 'Tillbehör',             icon: '🧰', badgeCls: 'bg-orange-100 text-orange-700' };
  if (isAccOnly)
    return { label: 'Tillbehör',             icon: '🧰', badgeCls: 'bg-orange-100 text-orange-700' };
  if (!hasVehicle && hasParts)
    return { label: 'Reservdelar/Tillbehör', icon: '🔧', badgeCls: 'bg-blue-100 text-blue-700' };
  if (hasVehicle && hasParts)
    return { label: 'Motorcykel + tillbehör',icon: '🏍️', badgeCls: 'bg-slate-100 text-slate-600' };
  if (hasVehicle)
    return { label: 'Motorcykel',            icon: '🏍️', badgeCls: 'bg-slate-100 text-slate-600' };
  return   { label: '—',                     icon: '',    badgeCls: '' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'paid' | 'pending';

export default function InvoicesPage() {
  const router = useRouter();
  const t = useTranslations('invoices');

  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [filter, setFilter]           = useState<FilterTab>('all');
  const [search, setSearch]           = useState('');
  const [editingPmId, setEditingPmId] = useState<string | null>(null);
  const [editingPmVal, setEditingPmVal] = useState('');
  const pmInputRef = useRef<HTMLSelectElement>(null);

  // Pay-now inline state
  const [payingId,  setPayingId]  = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('Kort');
  const [paying,    setPaying]    = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    getInvoices().then(setInvoices);
  }, [router]);

  useAutoRefresh(() => { getInvoices().then(setInvoices); });

  async function savePaymentMethod(invoiceId: string) {
    const val = editingPmVal.trim();
    if (!val) { setEditingPmId(null); return; }
    await updateInvoicePaymentMethod(invoiceId, val);
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, paymentMethod: val } : i));
    setEditingPmId(null);
    toast.success('Betalmetod uppdaterad');
  }

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

  const _d = getDealerInfo();
  const printLabels = {
    title:             t('printTitle'),
    issued:            t('printIssued'),
    paid:              t('printPaid'),
    method:            t('printMethod'),
    customer:          t('printCustomer'),
    vehicle:           t('printVehicle'),
    agreement:         t('printAgreement'),
    desc:              t('printDesc'),
    net:               t('printNet'),
    vat:               t('printVat'),
    total:             t('printTotal'),
    amount:            t('colAmount'),
    badgePaid:         t('badgePaid'),
    badgePending:      t('badgePending'),
    footer:            t('printFooter', { dealerName: _d.name, orgNr: _d.orgNr, city: _d.city, email: _d.email }),
    typeVehicle:       t('typeVehicle'),
    typeService:       t('typeService'),
    typeAccessories:   t('typeAccessories'),
    typeSpareParts:    t('typeSpareParts'),
    typeVehicleExtras: t('typeVehicleExtras'),
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{t('breadcrumb')}</p>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                📄 {t('title')}
              </h1>
              <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
            </div>
            <button
              onClick={() => {
                const csv = [
                  ['Faktura', 'Datum', 'Kund', 'Fordon', 'Metod', 'Belopp', 'Status'].join(','),
                  ...visible.map(i => [
                    i.id, i.issueDate.slice(0, 10), i.customerName, i.vehicle,
                    i.paymentMethod, i.totalAmount, i.status,
                  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
                ].join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url; a.download = `fakturor-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4 4m0 0l4-4m-4 4V4" />
              </svg>
              Exportera CSV
            </button>
          </div>
        </div>

        <div className="flex-1 px-5 md:px-8 py-6 space-y-5">

          {/* ── Stats bar ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('statTotal'),   value: fmtAmount(stats.revenue), icon: '💰', color: 'text-[#FF6B2C]',  tip: 'Total value of all invoices in the current view.' },
              { label: t('statCount'),   value: String(stats.total),       icon: '📄', color: 'text-slate-700',  tip: 'Number of invoices currently displayed.' },
              { label: t('statPaid'),    value: String(stats.paid),         icon: '✅', color: 'text-green-600',  tip: 'Total value of invoices marked as paid.' },
              { label: t('statPending'), value: String(stats.pending),      icon: '⏳', color: 'text-amber-600',  tip: 'Total value of invoices not yet paid.' },
            ].map(s => (
              <Tip key={s.label} text={s.tip}>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                </div>
              </Tip>
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

                        {/* Purchase type + items */}
                        {(() => {
                          const cls = classifyInvoice(inv);
                          const hasParts   = (inv.parts?.length ?? 0) > 0;
                          const isAccOnly  = (inv.vehicle ?? '').startsWith('Tillbehör:') || (inv.vehicle ?? '').startsWith('Accessories:');
                          const showVehicle = inv.vehicle && inv.vehicle !== '—' && !isAccOnly && !inv.id.startsWith('SRV-');
                          const first = inv.parts?.[0];
                          const rest  = (inv.parts?.length ?? 0) - 1;
                          return (
                            <td className="px-4 py-3 max-w-52">
                              {cls.label !== '—' && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded text-[9px] font-bold mb-1 ${cls.badgeCls}`}>
                                  {cls.icon} {cls.label}
                                </span>
                              )}
                              {showVehicle && (
                                <p className="truncate text-slate-700 font-medium text-xs">{inv.vehicle}</p>
                              )}
                              {hasParts && first && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="inline-block px-1.5 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700 shrink-0">
                                    ×{first.quantity}
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate max-w-28">{first.name}</span>
                                  {rest > 0 && (
                                    <span className="inline-block px-1.5 py-px rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0 whitespace-nowrap">
                                      +{rest} fler
                                    </span>
                                  )}
                                </div>
                              )}
                              {cls.label === '—' && (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          );
                        })()}

                        {/* Payment method */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {editingPmId === inv.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                ref={pmInputRef}
                                autoFocus
                                value={editingPmVal}
                                onChange={e => setEditingPmVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') savePaymentMethod(inv.id);
                                  if (e.key === 'Escape') setEditingPmId(null);
                                }}
                                className="text-xs border border-[#FF6B2C]/60 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#FF6B2C]/40"
                              >
                                <option value="">-- välj --</option>
                                {['Kort', 'Swish', 'Kontant', 'Klarna', 'Svea', 'Resurs', 'Santander', 'BankID Pay', 'Walley', 'Qliro', 'Nets', 'Adyen', 'Bambora', 'Trustly', 'Stripe'].map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <button onClick={() => savePaymentMethod(inv.id)} className="text-[10px] px-1.5 py-0.5 bg-[#FF6B2C] text-white rounded font-semibold hover:bg-[#e55a1f]">✓</button>
                              <button onClick={() => setEditingPmId(null)} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingPmId(inv.id); setEditingPmVal(inv.paymentMethod); }}
                              className={`group flex items-center gap-1 text-sm ${inv.paymentMethod ? 'text-slate-500' : 'text-slate-300 italic'} hover:text-[#FF6B2C] transition-colors`}
                              title="Klicka för att redigera"
                            >
                              {inv.paymentMethod || '—'}
                              <svg className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.94l-3.828.94.94-3.828a4 4 0 01.94-1.414z" />
                              </svg>
                            </button>
                          )}
                        </td>

                        {/* Amount + VAT scheme */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{fmtAmount(inv.totalAmount)}</span>
                          <div className="mt-0.5">
                            {inv.vatScheme === 'margin' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                                ⚖️ Marginalmoms
                              </span>
                            ) : inv.vatScheme === 'exempt' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                                Momsfri
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">
                                Moms {inv.vatAmount > 0 ? fmtAmount(inv.vatAmount) : '—'}
                              </span>
                            )}
                          </div>
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

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Mark as paid — pending invoices only */}
                            {inv.status === 'pending' && (
                              payingId === inv.id ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={payMethod}
                                    onChange={e => setPayMethod(e.target.value)}
                                    className="text-xs border border-[#FF6B2C]/60 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:outline-none"
                                  >
                                    {['Kort','Swish','Kontant','Faktura','Klarna','Svea','Resurs','Santander','BankID Pay','Walley','Stripe'].map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                  <button
                                    disabled={paying}
                                    onClick={async () => {
                                      setPaying(true);
                                      await markInvoicePaidById(inv.id, payMethod);
                                      setInvoices(prev => prev.map(i => i.id === inv.id
                                        ? { ...i, status: 'paid', paymentMethod: payMethod, paidDate: new Date().toISOString() }
                                        : i
                                      ));
                                      setPayingId(null);
                                      setPaying(false);
                                      toast.success(`${inv.id} markerad som betald`);
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {paying ? '...' : '✓'}
                                  </button>
                                  <button onClick={() => setPayingId(null)} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200">✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setPayingId(inv.id); setPayMethod(inv.paymentMethod || 'Kort'); }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-all"
                                >
                                  ✓ Markera betald
                                </button>
                              )
                            )}
                            <button
                              onClick={() => openInvoicePrintWindow(inv, printLabels)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-[#FF6B2C]/40 hover:text-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-all"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              {t('printBtn')}
                            </button>
                          </div>
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
