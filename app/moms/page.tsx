'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { vatPeriods } from '@/lib/vat';
import type { VatScheme } from '@/lib/vat';

// ── Types ──────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id:             string;
  issue_date:     string;
  total_amount:   number;
  vat_amount:     number;
  net_amount:     number;
  purchase_price: number | null;
  margin_amount:  number | null;
  vat_scheme:     VatScheme;
  status:         string;
  customer_name:  string;
  vehicle:        string;
}

interface MomsSummary {
  // Skatteverket momsdeklaration boxes
  ruta05_normalVat25:    number;   // Utgående moms 25 %
  ruta06_normalVat12:    number;   // Utgående moms 12 % (if applicable)
  ruta07_normalVat6:     number;   // Utgående moms 6 %
  ruta10_marginVat:      number;   // Moms på marginalbeskattade försäljningar
  ruta48_inputVat:       number;   // Ingående moms (to be added manually — purchases)
  ruta49_vatToPay:       number;   // Moms att betala (05+06+07+10 − 48)
  // Revenue breakdown
  normalRevenue:         number;
  marginRevenue:         number;
  marginGrossProfit:     number;
  exemptRevenue:         number;
  totalRevenue:          number;
  invoiceCount:          number;
  marginCount:           number;
}

function fmtSEK(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

function computeSummary(invoices: InvoiceRow[]): MomsSummary {
  let ruta05 = 0, ruta10 = 0;
  let normalRevenue = 0, marginRevenue = 0, marginGrossProfit = 0, exemptRevenue = 0;
  let marginCount = 0;

  for (const inv of invoices) {
    const total    = inv.total_amount ?? 0;
    const vat      = inv.vat_amount   ?? 0;
    const net      = inv.net_amount   ?? 0;
    const margin   = inv.margin_amount ?? 0;
    const scheme   = inv.vat_scheme   ?? 'normal';

    if (scheme === 'normal') {
      ruta05        += vat;
      normalRevenue += net;
    } else if (scheme === 'margin') {
      ruta10          += vat;
      marginRevenue   += total;
      marginGrossProfit += margin;
      marginCount++;
    } else {
      exemptRevenue += total;
    }
  }

  const ruta49 = ruta05 + ruta10;   // ingående moms subtracted manually in the UI

  return {
    ruta05_normalVat25: ruta05,
    ruta06_normalVat12: 0,
    ruta07_normalVat6:  0,
    ruta10_marginVat:   ruta10,
    ruta48_inputVat:    0,
    ruta49_vatToPay:    ruta49,
    normalRevenue,
    marginRevenue,
    marginGrossProfit,
    exemptRevenue,
    totalRevenue:       normalRevenue + marginRevenue + exemptRevenue,
    invoiceCount:       invoices.length,
    marginCount,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MomsPage() {
  const router  = useRouter();
  const t       = useTranslations('vatReport');
  const [ready, setReady]           = useState(false);
  const [dealershipId, setDid]      = useState('');
  const [invoices, setInvoices]     = useState<InvoiceRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [interval, setInterval]     = useState<'monthly' | 'quarterly'>('quarterly');
  const [year, setYear]             = useState(new Date().getFullYear());
  const [periodIdx, setPeriodIdx]   = useState<number>(() => {
    const q = Math.floor(new Date().getMonth() / 3);
    return q;
  });
  const [inputVat, setInputVat]     = useState('');    // manually entered ingående moms

  const periods = useMemo(() => vatPeriods(year, interval), [year, interval]);
  const period  = periods[periodIdx] ?? periods[0];

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const user = JSON.parse(raw) as { dealershipId?: string };
    if (!user.dealershipId) { router.replace('/auth/login'); return; }
    setDid(user.dealershipId);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!dealershipId || !period) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    sb.from('invoices')
      .select('id,issue_date,total_amount,vat_amount,net_amount,purchase_price,margin_amount,vat_scheme,status,customer_name,vehicle')
      .eq('dealership_id', dealershipId)
      .eq('status', 'paid')
      .gte('issue_date', period.start.toISOString())
      .lte('issue_date', period.end.toISOString())
      .order('issue_date', { ascending: true })
      .then(({ data }: { data: InvoiceRow[] | null }) => {
        setInvoices(data ?? []);
        setLoading(false);
      });
  }, [dealershipId, period]);

  const summary = useMemo(() => computeSummary(invoices), [invoices]);
  const inputVatNum = parseFloat(inputVat.replace(',', '.')) || 0;
  const vatToPay    = summary.ruta49_vatToPay - inputVatNum;

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>

        <div className="flex-1 px-5 md:px-8 py-8 space-y-6">

          {/* Period selector */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">{t('interval')}</label>
                <select
                  value={interval}
                  onChange={e => { setInterval(e.target.value as 'monthly' | 'quarterly'); setPeriodIdx(0); }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/20"
                >
                  <option value="quarterly">{t('quarterly')}</option>
                  <option value="monthly">{t('monthly')}</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">{t('year')}</label>
                <select
                  value={year}
                  onChange={e => { setYear(Number(e.target.value)); setPeriodIdx(0); }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/20"
                >
                  {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">{t('period')}</label>
                <div className="flex gap-1 flex-wrap">
                  {periods.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => setPeriodIdx(i)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        i === periodIdx
                          ? 'bg-[#FF6B2C] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Revenue breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t('normal25'),     amount: summary.normalRevenue, sub: t('vatOf', { amount: fmtSEK(summary.ruta05_normalVat25) }), color: 'text-slate-900' },
                  { label: t('marginal'),     amount: summary.marginRevenue, sub: t('grossProfit', { amount: fmtSEK(summary.marginGrossProfit) }), color: 'text-purple-700' },
                  { label: t('exempt'),       amount: summary.exemptRevenue, sub: t('noVat'), color: 'text-slate-400' },
                  { label: t('totalRevenue'), amount: summary.totalRevenue,  sub: t('invoiceCount', { count: summary.invoiceCount }), color: 'text-[#FF6B2C]' },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl border border-slate-100 p-4">
                    <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                    <p className={`text-xl font-bold mt-1 ${card.color}`}>{fmtSEK(card.amount)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Skatteverket boxes */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <span className="text-lg">🏛️</span> {t('declarationTitle')}
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Utgående moms */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{t('outgoingVat')}</p>
                    <div className="space-y-2">
                      {[
                        { ruta: '05', label: t('vat25'),     value: summary.ruta05_normalVat25, highlight: summary.ruta05_normalVat25 > 0 },
                        { ruta: '06', label: t('vat12'),     value: summary.ruta06_normalVat12, highlight: false },
                        { ruta: '07', label: t('vat6'),      value: summary.ruta07_normalVat6,  highlight: false },
                        { ruta: '10', label: t('marginTax'), value: summary.ruta10_marginVat,   highlight: summary.ruta10_marginVat > 0 },
                      ].map(row => (
                        <div key={row.ruta} className={`flex items-center justify-between py-2 px-3 rounded-lg ${row.highlight ? 'bg-amber-50' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">{row.ruta}</span>
                            <span className="text-sm text-slate-600">{row.label}</span>
                          </div>
                          <span className={`font-bold text-sm ${row.highlight ? 'text-amber-700' : 'text-slate-400'}`}>
                            {fmtSEK(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ingående moms + total */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">{t('incomingVatSummary')}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-md bg-blue-200 text-blue-700 text-[10px] font-bold flex items-center justify-center">48</span>
                          <span className="text-sm text-slate-600">{t('incomingVat')}</span>
                        </div>
                        <input
                          type="text"
                          value={inputVat}
                          onChange={e => setInputVat(e.target.value)}
                          placeholder="0,00"
                          className="w-28 text-right text-sm font-bold text-blue-700 bg-white border border-blue-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300/40"
                        />
                      </div>
                      <p className="text-xs text-slate-400 px-3">{t('incomingVatHint')}</p>

                      <div className={`flex items-center justify-between py-3 px-3 rounded-lg mt-2 ${vatToPay > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center ${vatToPay > 0 ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>49</span>
                          <span className="text-sm font-bold text-slate-700">{t('vatToPay')}</span>
                        </div>
                        <span className={`font-bold text-lg ${vatToPay > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {fmtSEK(vatToPay)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-400 flex items-start gap-1.5">
                  <span>ℹ️</span>
                  <span>{t('disclaimer')}</span>
                </p>
              </div>

              {/* Invoice breakdown table */}
              {invoices.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700">{t('invoicesInPeriod', { count: invoices.length })}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold">
                        <tr>
                          <th className="px-4 py-2.5 text-left">{t('invoice')}</th>
                          <th className="px-4 py-2.5 text-left">{t('date')}</th>
                          <th className="px-4 py-2.5 text-left">{t('customerVehicle')}</th>
                          <th className="px-4 py-2.5 text-center">{t('scheme')}</th>
                          <th className="px-4 py-2.5 text-right">{t('amountIncl')}</th>
                          <th className="px-4 py-2.5 text-right">{t('vat')}</th>
                          <th className="px-4 py-2.5 text-right">{t('net')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {invoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{inv.id}</td>
                            <td className="px-4 py-2.5 text-slate-500">
                              {new Date(inv.issue_date).toLocaleDateString('sv-SE')}
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-700 truncate max-w-36">{inv.customer_name}</p>
                              <p className="text-slate-400 truncate max-w-36">{inv.vehicle}</p>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {inv.vat_scheme === 'margin' ? (
                                <span className="inline-flex px-1.5 py-px rounded text-[9px] font-bold bg-purple-100 text-purple-700">{t('schemeMarginal')}</span>
                              ) : inv.vat_scheme === 'exempt' ? (
                                <span className="inline-flex px-1.5 py-px rounded text-[9px] font-bold bg-slate-100 text-slate-500">{t('schemeExempt')}</span>
                              ) : (
                                <span className="inline-flex px-1.5 py-px rounded text-[9px] font-bold bg-green-100 text-green-700">{t('scheme25')}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                              {fmtSEK(inv.total_amount)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-500">
                              {inv.vat_scheme === 'margin'
                                ? <span className="text-purple-600">{fmtSEK(inv.vat_amount)} <span className="text-[9px]">{t('marginalSuffix')}</span></span>
                                : fmtSEK(inv.vat_amount)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-500">
                              {fmtSEK(inv.net_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invoices.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                  <p className="text-slate-400 text-sm">{t('noInvoices', { period: period.label })}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
