'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface Cancellation {
  id:               string;
  lead_id:          string;
  agreement_number: string | null;
  customer_name:    string | null;
  vehicle:          string | null;
  reason:           string;
  reason_detail:    string | null;
  refund_amount:    number;
  refund_status:    string;
  return_to_stock:  boolean;
  notes:            string | null;
  cancelled_by:     string | null;
  status:           string;
  created_at:       string;
}

const REASON_LABELS: Record<string, string> = {
  changed_mind:       'Ångrat sig',
  financial:          'Ekonomi',
  found_elsewhere:    'Hittade annanstans',
  financing_denied:   'Finansiering nekad',
  other:              'Annan anledning',
};

const REFUND_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  sent:      'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
};

function fmtKr(n: number) {
  return n > 0 ? `${Math.round(n).toLocaleString('sv-SE')} kr` : '—';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CancellationsPage() {
  const router = useRouter();

  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState<'all' | 'open' | 'closed'>('all');
  const [user,          setUser]          = useState<{ name?: string; dealershipId?: string } | null>(null);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const load = useCallback(async (did: string, sf: string) => {
    setLoading(true);
    const url = new URL('/api/cancellations', window.location.origin);
    url.searchParams.set('dealershipId', did);
    if (sf !== 'all') url.searchParams.set('status', sf);
    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json() as { cancellations: Cancellation[] };
      setCancellations(json.cancellations);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { name?: string; dealershipId?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) load(did, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (dealershipId) load(dealershipId, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRefunds    = cancellations.reduce((s, c) => s + (c.refund_amount ?? 0), 0);
  const pendingRefunds  = cancellations.filter(c => c.refund_status === 'pending' && c.refund_amount > 0).length;
  const reasonCounts    = cancellations.reduce<Record<string, number>>((acc, c) => {
    acc[c.reason] = (acc[c.reason] ?? 0) + 1; return acc;
  }, {});
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100">
          <h1 className="text-2xl font-extrabold text-slate-900">Avbokningar & Återbetalningar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Alla avbrutna affärer och refusioner</p>
        </div>

        {/* KPI strip */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Totalt avbokade', value: cancellations.length, icon: '❌' },
              { label: 'Totalt återbetalt', value: fmtKr(totalRefunds), icon: '💸' },
              { label: 'Väntande refusioner', value: pendingRefunds, icon: '⏳', alert: pendingRefunds > 0 },
              { label: 'Vanligaste orsak', value: topReason ? REASON_LABELS[topReason[0]] ?? topReason[0] : '—', icon: '📊' },
            ].map(k => (
              <div key={k.label} className={`rounded-2xl border p-4 ${k.alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{k.icon} {k.label}</p>
                <p className={`text-xl font-extrabold ${k.alert ? 'text-amber-700' : 'text-slate-900'}`}>{String(k.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div className="px-6 md:px-8 py-3 bg-white border-b border-slate-100 flex gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(['all', 'open', 'closed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {s === 'all' ? 'Alla' : s === 'open' ? 'Öppna' : 'Stängda'}
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
          ) : cancellations.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-bold text-slate-700 text-lg">Inga avbokningar att visa</p>
              <p className="text-sm text-slate-400 mt-1">Avbokade affärer registreras här automatiskt.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Datum', 'Kund', 'Fordon', 'Orsak', 'Återbetalning', 'Status återbetalt', 'Av', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cancellations.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{c.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{c.vehicle || '—'}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-slate-700 font-medium">{REASON_LABELS[c.reason] ?? c.reason}</span>
                          {c.reason_detail && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{c.reason_detail}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{fmtKr(c.refund_amount)}</td>
                      <td className="px-4 py-3">
                        {c.refund_amount > 0 ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${REFUND_STATUS_BADGE[c.refund_status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {c.refund_status === 'pending' ? 'Väntar' : c.refund_status === 'sent' ? 'Skickad' : 'Bekräftad'}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{c.cancelled_by || '—'}</td>
                      <td className="px-4 py-3">
                        {c.lead_id && (
                          <Link href={`/sales/leads/${c.lead_id}`}
                            className="text-xs text-[#FF6B2C] hover:underline font-medium whitespace-nowrap">
                            Lead →
                          </Link>
                        )}
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
  );
}
