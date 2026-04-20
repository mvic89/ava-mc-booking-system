'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface Commission {
  id:                number;
  lead_id:           number | null;
  salesperson:       string;
  customer_name:     string;
  vehicle_name:      string;
  deal_amount:       number;
  commission_rate:   number;
  commission_amount: number;
  status:            string;
  paid_at:           string | null;
  approved_by:       string | null;
  closed_at:         string;
  notes:             string;
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  paid:     'bg-emerald-100 text-emerald-700',
  voided:   'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending:  'Väntar',
  approved: 'Godkänd',
  paid:     'Utbetald',
  voided:   'Ogiltig',
};

function fmtKr(n: number) {
  return n > 0 ? `${Math.round(n).toLocaleString('sv-SE')} kr` : '—';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

// ─── New Commission Modal ──────────────────────────────────────────────────────
interface NewCommissionModalProps {
  dealershipId: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewCommissionModal({ dealershipId, onClose, onCreated }: NewCommissionModalProps) {
  const [form, setForm] = useState({
    salesperson: '', customerName: '', vehicleName: '',
    dealAmount: '', commissionRate: '3', leadId: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw) as { name?: string; givenName?: string };
      setForm(f => ({ ...f, salesperson: u.givenName ?? u.name ?? '' }));
    }
  }, []);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const dealAmount  = parseFloat(form.dealAmount) || 0;
  const rate        = parseFloat(form.commissionRate) || 0;
  const commAmount  = Math.round(dealAmount * rate / 100);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.salesperson || !form.dealAmount) return;
    setSaving(true);
    const res = await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        leadId:           form.leadId ? parseInt(form.leadId) : undefined,
        salesperson:      form.salesperson,
        customerName:     form.customerName,
        vehicleName:      form.vehicleName,
        dealAmount,
        commissionRate:   rate,
        commissionAmount: commAmount,
        notes:            form.notes,
      }),
    });
    if (res.ok) {
      toast.success('Provision registrerad');
      onCreated();
      onClose();
    } else {
      const j = await res.json() as { error?: string };
      toast.error(j.error ?? 'Misslyckades');
    }
    setSaving(false);
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
        <h2 className="text-lg font-extrabold text-slate-900 mb-5">Registrera provision</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Säljare *</label>
            <input required className={inputCls} value={form.salesperson} onChange={e => set('salesperson', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Kund</label>
              <input className={inputCls} value={form.customerName} onChange={e => set('customerName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Lead ID</label>
              <input type="number" className={inputCls} value={form.leadId} onChange={e => set('leadId', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fordon</label>
            <input className={inputCls} value={form.vehicleName} onChange={e => set('vehicleName', e.target.value)} placeholder="Yamaha MT-07 2024" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Affärsvärde (kr) *</label>
              <input required type="number" className={inputCls} value={form.dealAmount} onChange={e => set('dealAmount', e.target.value)} placeholder="89000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Provision (%)</label>
              <input type="number" step="0.1" className={inputCls} value={form.commissionRate} onChange={e => set('commissionRate', e.target.value)} />
            </div>
          </div>
          {commAmount > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-700">Beräknad provision:</span>
              <span className="text-lg font-extrabold text-emerald-700">{fmtKr(commAmount)}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Anteckningar</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Avbryt
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] disabled:opacity-40">
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const router  = useRouter();
  const now     = new Date();
  const [commissions,  setCommissions]  = useState<Commission[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [year,         setYear]         = useState(now.getFullYear());
  const [month,        setMonth]        = useState(now.getMonth() + 1);
  const [showModal,    setShowModal]    = useState(false);
  const [user,         setUser]         = useState<{ dealershipId?: string; name?: string } | null>(null);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const load = useCallback(async (did: string, sf: string, y: number, m: number) => {
    setLoading(true);
    const url = new URL('/api/commissions', window.location.origin);
    url.searchParams.set('dealershipId', did);
    url.searchParams.set('year', String(y));
    url.searchParams.set('month', String(m));
    if (sf !== 'all') url.searchParams.set('status', sf);
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json() as { commissions: Commission[] };
      setCommissions(j.commissions);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { dealershipId?: string; name?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) load(did, statusFilter, year, month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (dealershipId) load(dealershipId, statusFilter, year, month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, year, month]);

  async function updateStatus(id: number, status: string) {
    const res = await fetch(`/api/commissions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, approvedBy: user?.name }),
    });
    if (res.ok) {
      toast.success('Status uppdaterad');
      load(dealershipId, statusFilter, year, month);
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalCommission = commissions.filter(c => c.status !== 'voided').reduce((s, c) => s + c.commission_amount, 0);
  const pendingPay      = commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.commission_amount, 0);
  const totalDeals      = commissions.filter(c => c.status !== 'voided').reduce((s, c) => s + c.deal_amount, 0);

  // Per-salesperson summary
  const byPerson = commissions
    .filter(c => c.status !== 'voided')
    .reduce<Record<string, { units: number; commission: number }>>((acc, c) => {
      if (!acc[c.salesperson]) acc[c.salesperson] = { units: 0, commission: 0 };
      acc[c.salesperson].units      += 1;
      acc[c.salesperson].commission += c.commission_amount;
      return acc;
    }, {});

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      {showModal && dealershipId && (
        <NewCommissionModal dealershipId={dealershipId} onClose={() => setShowModal(false)} onCreated={() => load(dealershipId, statusFilter, year, month)} />
      )}

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Provisionsreskontra</h1>
            <p className="text-sm text-slate-500 mt-0.5">Säljarprovisioner per affär</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] shadow transition-colors whitespace-nowrap">
            + Provision
          </button>
        </div>

        {/* Period selector + KPIs */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
          {/* Month/year nav */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => {
              const d = new Date(year, month - 2, 1);
              setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
            }} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm hover:bg-slate-50">←</button>
            <span className="font-bold text-slate-900 min-w-[120px] text-center">
              {months[month - 1]} {year}
            </span>
            <button onClick={() => {
              const d = new Date(year, month, 1);
              setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
            }} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm hover:bg-slate-50">→</button>
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50">
              Idag
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total provision', value: fmtKr(totalCommission), icon: '💰' },
              { label: 'Affärsvärde', value: fmtKr(totalDeals), icon: '📊' },
              { label: 'Godkänd, ej utbetald', value: fmtKr(pendingPay), icon: '⏳', alert: pendingPay > 0 },
              { label: 'Antal affärer', value: commissions.filter(c => c.status !== 'voided').length, icon: '🤝' },
            ].map(k => (
              <div key={k.label} className={`rounded-2xl border p-4 ${k.alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{k.icon} {k.label}</p>
                <p className={`text-xl font-extrabold ${k.alert ? 'text-amber-700' : 'text-slate-900'}`}>{String(k.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Per-salesperson summary */}
        {Object.keys(byPerson).length > 0 && (
          <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Per säljare</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(byPerson).sort((a, b) => b[1].commission - a[1].commission).map(([name, data]) => (
                <div key={name} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FF6B2C] flex items-center justify-center text-white text-xs font-bold">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{name}</p>
                    <p className="text-xs text-slate-500">{data.units} affär{data.units !== 1 ? 'er' : ''} · {fmtKr(data.commission)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="px-6 md:px-8 py-3 bg-white border-b border-slate-100">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit flex-wrap">
            {(['all', 'pending', 'approved', 'paid', 'voided'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {s === 'all' ? 'Alla' : STATUS_LABEL[s] ?? s}
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
          ) : commissions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">💰</p>
              <p className="font-bold text-slate-700 text-lg">Inga provisioner denna period</p>
              <p className="text-sm text-slate-400 mt-1">Provisioner registreras automatiskt vid stängda affärer.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Säljare', 'Kund / Fordon', 'Affärsvärde', 'Sats', 'Provision', 'Status', 'Datum', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{c.salesperson}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{c.customer_name || '—'}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">{c.vehicle_name}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{fmtKr(c.deal_amount)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{c.commission_rate}%</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{fmtKr(c.commission_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(c.closed_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.status === 'pending' && (
                            <button onClick={() => updateStatus(c.id, 'approved')}
                              className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap">
                              Godkänn
                            </button>
                          )}
                          {c.status === 'approved' && (
                            <button onClick={() => updateStatus(c.id, 'paid')}
                              className="text-xs text-emerald-600 hover:underline font-medium whitespace-nowrap">
                              Markera betald
                            </button>
                          )}
                          {c.lead_id && (
                            <Link href={`/sales/leads/${c.lead_id}`}
                              className="text-xs text-[#FF6B2C] hover:underline font-medium">
                              Lead →
                            </Link>
                          )}
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
  );
}
