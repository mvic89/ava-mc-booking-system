'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface Reservation {
  id:              number;
  lead_id:         number;
  vehicle_name:    string;
  vin:             string;
  deposit_amount:  number;
  deposit_paid:    boolean;
  deposit_paid_at: string | null;
  payment_method:  string;
  reserved_until:  string;
  status:          string;
  reserved_by:     string;
  customer_name:   string;
  customer_email:  string;
  customer_phone:  string;
  notes:           string;
  created_at:      string;
}

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  converted: 'bg-blue-100 text-blue-700',
  expired:   'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
  refunded:  'bg-amber-100 text-amber-700',
};

const STATUS_LABEL: Record<string, string> = {
  active:    'Aktiv',
  converted: 'Konverterad',
  expired:   'Utgått',
  cancelled: 'Avbokad',
  refunded:  'Återbetald',
};

function fmtKr(n: number) {
  return n > 0 ? `${Math.round(n).toLocaleString('sv-SE')} kr` : '—';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpiringSoon(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 48 * 60 * 60 * 1000; // < 48 hours
}

function isExpired(iso: string) {
  return new Date(iso) < new Date();
}

// ─── New Reservation Modal ─────────────────────────────────────────────────────
interface NewModalProps {
  dealershipId: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewReservationModal({ dealershipId, onClose, onCreated }: NewModalProps) {
  const [form, setForm] = useState({
    leadId: '', vehicleName: '', vin: '', depositAmount: '',
    depositPaid: false, paymentMethod: '', reservedUntil: '',
    customerName: '', customerEmail: '', customerPhone: '',
    reservedBy: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.leadId || !form.vehicleName) return;
    setSaving(true);
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        leadId:         parseInt(form.leadId),
        vehicleName:    form.vehicleName,
        vin:            form.vin,
        depositAmount:  parseFloat(form.depositAmount) || 0,
        depositPaid:    form.depositPaid,
        depositPaidAt:  form.depositPaid ? new Date().toISOString() : null,
        paymentMethod:  form.paymentMethod,
        reservedUntil:  form.reservedUntil || new Date(Date.now() + 7 * 86400000).toISOString(),
        customerName:   form.customerName,
        customerEmail:  form.customerEmail,
        customerPhone:  form.customerPhone,
        reservedBy:     form.reservedBy,
        notes:          form.notes,
      }),
    });
    if (res.ok) {
      toast.success('Reservation skapad');
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg my-8 p-6">
        <h2 className="text-lg font-extrabold text-slate-900 mb-5">Ny reservation</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Lead ID *</label>
              <input required type="number" className={inputCls} value={form.leadId} onChange={e => set('leadId', e.target.value)} placeholder="123" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Reserverat av</label>
              <input className={inputCls} value={form.reservedBy} onChange={e => set('reservedBy', e.target.value)} placeholder="Säljare" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fordon *</label>
            <input required className={inputCls} value={form.vehicleName} onChange={e => set('vehicleName', e.target.value)} placeholder="Yamaha MT-07 2024" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">VIN / Regnr</label>
            <input className={inputCls} value={form.vin} onChange={e => set('vin', e.target.value)} placeholder="VIN eller registreringsnummer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Handpenning (kr)</label>
              <input type="number" className={inputCls} value={form.depositAmount} onChange={e => set('depositAmount', e.target.value)} placeholder="2000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Betalningssätt</label>
              <input className={inputCls} value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} placeholder="Swish / Kort" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="depositPaid" checked={form.depositPaid}
              onChange={e => set('depositPaid', e.target.checked)}
              className="w-4 h-4 accent-[#FF6B2C]" />
            <label htmlFor="depositPaid" className="text-sm text-slate-700 font-medium">Handpenning betald</label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Giltig till</label>
            <input type="datetime-local" className={inputCls} value={form.reservedUntil} onChange={e => set('reservedUntil', e.target.value)} />
          </div>
          <div className="pt-1 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Kundinformation</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Namn</label>
                <input className={inputCls} value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Anna Lindqvist" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Telefon</label>
                <input className={inputCls} value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} placeholder="070 000 00 00" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-400 mb-1">E-post</label>
              <input type="email" className={inputCls} value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)} placeholder="kund@example.com" />
            </div>
          </div>
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
              {saving ? 'Sparar...' : 'Spara reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal,    setShowModal]    = useState(false);
  const [user,         setUser]         = useState<{ dealershipId?: string } | null>(null);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const load = useCallback(async (did: string, sf: string) => {
    setLoading(true);
    const url = new URL('/api/reservations', window.location.origin);
    url.searchParams.set('dealershipId', did);
    if (sf !== 'all') url.searchParams.set('status', sf);
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json() as { reservations: Reservation[] };
      setReservations(j.reservations);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { dealershipId?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) load(did, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (dealershipId) load(dealershipId, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function updateStatus(id: number, status: string) {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success('Status uppdaterad');
      load(dealershipId, statusFilter);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const active       = reservations.filter(r => r.status === 'active').length;
  const totalDeposit = reservations.filter(r => r.deposit_paid).reduce((s, r) => s + r.deposit_amount, 0);
  const expiringSoon = reservations.filter(r => r.status === 'active' && isExpiringSoon(r.reserved_until)).length;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      {showModal && dealershipId && (
        <NewReservationModal dealershipId={dealershipId} onClose={() => setShowModal(false)} onCreated={() => load(dealershipId, statusFilter)} />
      )}

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Reservationer & Handpenning</h1>
            <p className="text-sm text-slate-500 mt-0.5">Spåra fordonsreservationer och inbetalda handpenningar</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] shadow transition-colors whitespace-nowrap">
            + Ny reservation
          </button>
        </div>

        {/* KPIs */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Aktiva reservationer', value: active, icon: '🔒' },
              { label: 'Inbetald handpenning', value: fmtKr(totalDeposit), icon: '💰' },
              { label: 'Utgår snart (< 48h)', value: expiringSoon, icon: '⚠️', alert: expiringSoon > 0 },
              { label: 'Totalt', value: reservations.length, icon: '📋' },
            ].map(k => (
              <div key={k.label} className={`rounded-2xl border p-4 ${k.alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{k.icon} {k.label}</p>
                <p className={`text-xl font-extrabold ${k.alert ? 'text-amber-700' : 'text-slate-900'}`}>{String(k.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div className="px-6 md:px-8 py-3 bg-white border-b border-slate-100">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1 w-fit flex-wrap">
            {(['all', 'active', 'converted', 'expired', 'cancelled'] as const).map(s => (
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
          ) : reservations.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">🔒</p>
              <p className="font-bold text-slate-700 text-lg">Inga reservationer</p>
              <p className="text-sm text-slate-400 mt-1">Reserverade fordon och handpenningar visas här.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Kund', 'Fordon', 'Handpenning', 'Giltig till', 'Status', 'Reserverat av', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(r => {
                    const expiring = r.status === 'active' && isExpiringSoon(r.reserved_until);
                    const exp      = r.status === 'active' && isExpired(r.reserved_until);
                    return (
                      <tr key={r.id} className={`border-b border-slate-50 transition-colors ${expiring || exp ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{r.customer_name || '—'}</p>
                          <p className="text-xs text-slate-400">{r.customer_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700 font-medium">{r.vehicle_name || '—'}</p>
                          {r.vin && <p className="text-xs text-slate-400 truncate max-w-[140px]">{r.vin}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{fmtKr(r.deposit_amount)}</p>
                          {r.deposit_paid ? (
                            <span className="text-xs text-emerald-600 font-medium">Betald</span>
                          ) : r.deposit_amount > 0 ? (
                            <span className="text-xs text-amber-600 font-medium">Ej betald</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className={`text-sm font-medium ${exp ? 'text-red-600' : expiring ? 'text-amber-600' : 'text-slate-600'}`}>
                            {fmtDate(r.reserved_until)}
                          </p>
                          {expiring && <p className="text-xs text-amber-500">Utgår snart!</p>}
                          {exp && <p className="text-xs text-red-500">Utgått</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{r.reserved_by || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {r.status === 'active' && (
                              <>
                                <button onClick={() => updateStatus(r.id, 'converted')}
                                  className="text-xs text-blue-600 hover:underline font-medium">Konvertera</button>
                                <button onClick={() => updateStatus(r.id, 'cancelled')}
                                  className="text-xs text-red-500 hover:underline">Avboka</button>
                              </>
                            )}
                            {r.lead_id && (
                              <Link href={`/sales/leads/${r.lead_id}`}
                                className="text-xs text-[#FF6B2C] hover:underline font-medium">
                                Lead →
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
