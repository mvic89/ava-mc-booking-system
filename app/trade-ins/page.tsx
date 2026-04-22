'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface TradeIn {
  id:                  number;
  lead_id:             number;
  dealership_id:       string;
  description:         string;
  registration_number: string;
  vin:                 string;
  brand:               string;
  model:               string;
  year:                number | null;
  color:               string;
  mileage:             number | null;
  credit_value:        number;
  status:              string;
  notes:               string;
  created_at:          string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const CONDITION_PCTS: Record<string, number> = {
  excellent: 0.85,
  good:      0.72,
  fair:      0.58,
  poor:      0.42,
};

function fmtKr(n: number) {
  return n > 0 ? `${Math.round(n).toLocaleString('sv-SE')} kr` : '—';
}

// ─── Valuation Calculator ──────────────────────────────────────────────────────
interface ValuationPanelProps {
  dealershipId: string;
  onCreated: () => void;
}

function ValuationPanel({ dealershipId, onCreated }: ValuationPanelProps) {
  const t = useTranslations('tradeIns');
  const [brand,     setBrand]     = useState('');
  const [model,     setModel]     = useState('');
  const [year,      setYear]      = useState('');
  const [mileage,   setMileage]   = useState('');
  const [condition, setCondition] = useState<string>('good');
  const [marketVal, setMarketVal] = useState('');
  const [regNr,     setRegNr]     = useState('');
  const [vin,       setVin]       = useState('');
  const [color,     setColor]     = useState('');
  const [leadId,    setLeadId]    = useState('');
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  const conditionKeys = ['excellent', 'good', 'fair', 'poor'] as const;
  const conditionPct  = CONDITION_PCTS[condition] ?? 0.72;
  const baseMarket    = parseFloat(marketVal) || 0;
  const yearsOld      = year ? new Date().getFullYear() - parseInt(year) : 0;
  const ageDiscount   = Math.min(yearsOld * 0.03, 0.30);
  const mileageDisc   = Math.min((parseInt(mileage) || 0) / 1000 * 0.004, 0.25);
  const estimated     = Math.round(baseMarket * conditionPct * (1 - ageDiscount) * (1 - mileageDisc));

  async function handleSave() {
    if (!leadId || !brand || !model) { toast.error(t('toast.required')); return; }
    setSaving(true);
    const res = await fetch('/api/trade-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        leadId:             parseInt(leadId),
        brand,
        model,
        year:               year ? parseInt(year) : null,
        mileage:            mileage ? parseInt(mileage) : null,
        color,
        vin,
        registrationNumber: regNr,
        description:        `${brand} ${model} ${year}`.trim(),
        creditValue:        estimated,
        notes,
        status:             'pending',
      }),
    });
    if (res.ok) {
      toast.success(t('toast.saved'));
      onCreated();
      setBrand(''); setModel(''); setYear(''); setMileage('');
      setMarketVal(''); setRegNr(''); setVin(''); setColor(''); setLeadId(''); setNotes('');
    } else {
      const j = await res.json() as { error?: string };
      toast.error(j.error ?? t('toast.error'));
    }
    setSaving(false);
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h2 className="text-base font-extrabold text-slate-900 mb-4">{t('valuation.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Input */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.brand')}</label>
              <input className={inputCls} value={brand} onChange={e => setBrand(e.target.value)} placeholder="Honda" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.model')}</label>
              <input className={inputCls} value={model} onChange={e => setModel(e.target.value)} placeholder="CB500F" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.year')}</label>
              <input type="number" className={inputCls} value={year} onChange={e => setYear(e.target.value)} placeholder="2020" min="1980" max={new Date().getFullYear()} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.mileageKm')}</label>
              <input type="number" className={inputCls} value={mileage} onChange={e => setMileage(e.target.value)} placeholder="15000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.regNr')}</label>
              <input className={inputCls} value={regNr} onChange={e => setRegNr(e.target.value)} placeholder="ABC 123" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.color')}</label>
              <input className={inputCls} value={color} onChange={e => setColor(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.marketValue')}</label>
            <input type="number" className={inputCls} value={marketVal} onChange={e => setMarketVal(e.target.value)} placeholder="45000" />
            <p className="text-xs text-slate-400 mt-1">{t('valuation.marketHint')}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.condition')}</label>
            <div className="grid grid-cols-2 gap-2">
              {conditionKeys.map(c => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all ${condition === c ? 'bg-[#FF6B2C] text-white border-[#FF6B2C]' : 'bg-white text-slate-700 border-slate-200 hover:border-[#FF6B2C]'}`}>
                  {t(`conditions.${c}`)} <span className="text-xs opacity-70">({Math.round(CONDITION_PCTS[c] * 100)}%)</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Result */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#FF6B2C] to-[#e55d22] p-5 text-white">
            <p className="text-xs font-semibold uppercase opacity-75 mb-1">{t('valuation.estimatedValue')}</p>
            <p className="text-4xl font-extrabold">{baseMarket > 0 ? fmtKr(estimated) : '—'}</p>
            {baseMarket > 0 && (
              <div className="mt-3 space-y-1 text-xs opacity-80">
                <p>{t('valuation.marketLabel')} {fmtKr(baseMarket)}</p>
                <p>{t('valuation.conditionAdj')} –{Math.round((1 - conditionPct) * 100)}%</p>
                {yearsOld > 0 && <p>{t('valuation.ageDiscount')} –{Math.round(ageDiscount * 100)}%</p>}
                {parseInt(mileage) > 0 && <p>{t('valuation.mileageDiscount')} –{Math.round(mileageDisc * 100)}%</p>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.leadId')}</label>
              <input type="number" className={inputCls} value={leadId} onChange={e => setLeadId(e.target.value)} placeholder={t('valuation.leadIdPlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.vin')}</label>
              <input className={inputCls} value={vin} onChange={e => setVin(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('valuation.notes')}</label>
              <textarea className={inputCls + ' resize-none'} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('valuation.notesPlaceholder')} />
            </div>
            <button onClick={handleSave} disabled={saving || !brand || !model}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-700 disabled:opacity-40 transition-colors">
              {saving ? t('valuation.saving') : t('valuation.saveButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TradeInsPage() {
  const router  = useRouter();
  const t       = useTranslations('tradeIns');
  const locale  = useLocale();
  const [tradeIns,     setTradeIns]     = useState<TradeIn[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [user,         setUser]         = useState<{ dealershipId?: string } | null>(null);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const statusLabels: Record<string, string> = {
    all:       t('statuses.all'),
    pending:   t('statuses.pending'),
    completed: t('statuses.completed'),
    cancelled: t('statuses.cancelled'),
  };

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const load = useCallback(async (did: string) => {
    setLoading(true);
    const url = new URL('/api/trade-ins', window.location.origin);
    url.searchParams.set('dealershipId', did);
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json() as { tradeIns: TradeIn[] };
      setTradeIns(j.tradeIns);
    } else {
      setTradeIns([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { dealershipId?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) load(did);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filtered     = statusFilter === 'all' ? tradeIns : tradeIns.filter(ti => ti.status === statusFilter);
  const totalValue   = tradeIns.filter(ti => ti.status !== 'cancelled').reduce((s, ti) => s + ti.credit_value, 0);
  const pendingCount = tradeIns.filter(ti => ti.status === 'pending').length;

  const kpis = [
    { label: t('kpi.total'),   value: tradeIns.length,                                                  icon: '🔄', alert: false },
    { label: t('kpi.value'),   value: fmtKr(totalValue),                                                icon: '💰', alert: false },
    { label: t('kpi.pending'), value: pendingCount,                                                      icon: '⏳', alert: pendingCount > 0 },
    { label: t('kpi.received'),value: tradeIns.filter(ti => ti.status === 'completed').length,           icon: '✅', alert: false },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100">
          <h1 className="text-2xl font-extrabold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('subtitle')}</p>
        </div>

        {/* Valuation calculator */}
        <div className="px-6 md:px-8 py-5">
          {dealershipId && (
            <ValuationPanel dealershipId={dealershipId} onCreated={() => load(dealershipId)} />
          )}
        </div>

        {/* KPIs */}
        <div className="px-6 md:px-8 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map(k => (
              <div key={k.label} className={`rounded-2xl border p-4 bg-white ${k.alert ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{k.icon} {k.label}</p>
                <p className={`text-xl font-extrabold ${k.alert ? 'text-amber-700' : 'text-slate-900'}`}>{String(k.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div className="px-6 md:px-8 py-3 bg-white border-y border-slate-100">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit">
            {(['all', 'pending', 'completed', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 px-6 md:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">🔄</p>
              <p className="font-bold text-slate-700 text-lg">{t('empty.title')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('empty.desc')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {[t('table.vehicle'), t('table.regVin'), t('table.mileage'), t('table.value'), t('table.status'), t('table.lead'), t('table.date')].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ti => (
                    <tr key={ti.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{ti.brand} {ti.model} {ti.year ?? ''}</p>
                        {ti.color && <p className="text-xs text-slate-400">{ti.color}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {ti.registration_number || ti.vin || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {ti.mileage ? `${ti.mileage.toLocaleString(locale)} km` : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{fmtKr(ti.credit_value)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[ti.status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {statusLabels[ti.status] ?? ti.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/sales/leads/${ti.lead_id}`}
                          className="text-xs text-[#FF6B2C] hover:underline font-medium">
                          #{ti.lead_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(ti.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
