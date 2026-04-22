'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';

interface Warranty {
  id:              number;
  lead_id:         number | null;
  vehicle_name:    string;
  vin:             string;
  registration_nr: string;
  type:            string;
  provider:        string;
  policy_number:   string;
  start_date:      string;
  end_date:        string;
  coverage_amount: number;
  status:          string;
  claim_date:      string | null;
  claim_amount:    number | null;
  claim_notes:     string | null;
  notes:           string;
  created_by:      string;
  created_at:      string;
}

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  expired:   'bg-slate-100 text-slate-500',
  claimed:   'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  voided:    'bg-red-100 text-red-700',
};

function fmtKr(n: number) {
  return n > 0 ? `${Math.round(n).toLocaleString('sv-SE')} kr` : '—';
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ─── New Warranty Modal ────────────────────────────────────────────────────────
interface NewWarrantyModalProps {
  dealershipId: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewWarrantyModal({ dealershipId, onClose, onCreated }: NewWarrantyModalProps) {
  const t = useTranslations('warranties');
  const [form, setForm] = useState({
    leadId: '', vehicleName: '', vin: '', registrationNr: '',
    type: 'standard', provider: '', policyNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    coverageAmount: '', notes: '', createdBy: '',
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw) as { name?: string; givenName?: string };
      setForm(f => ({ ...f, createdBy: u.givenName ?? u.name ?? '' }));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleName || !form.endDate) return;
    setSaving(true);
    const res = await fetch('/api/warranties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        leadId:         form.leadId ? parseInt(form.leadId) : undefined,
        vehicleName:    form.vehicleName,
        vin:            form.vin,
        registrationNr: form.registrationNr,
        type:           form.type,
        provider:       form.provider,
        policyNumber:   form.policyNumber,
        startDate:      form.startDate,
        endDate:        form.endDate,
        coverageAmount: parseFloat(form.coverageAmount) || 0,
        notes:          form.notes,
        createdBy:      form.createdBy,
      }),
    });
    if (res.ok) {
      toast.success(t('toast.created'));
      onCreated();
      onClose();
    } else {
      const j = await res.json() as { error?: string };
      toast.error(j.error ?? t('toast.error'));
    }
    setSaving(false);
  }

  const typeKeys = ['standard', 'extended', 'manufacturer', 'third_party'] as const;
  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg my-8 p-6">
        <h2 className="text-lg font-extrabold text-slate-900 mb-5">{t('modal.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.vehicle')}</label>
            <input required className={inputCls} value={form.vehicleName} onChange={e => set('vehicleName', e.target.value)} placeholder="Yamaha MT-07 2024" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.vin')}</label>
              <input className={inputCls} value={form.vin} onChange={e => set('vin', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.regNr')}</label>
              <input className={inputCls} value={form.registrationNr} onChange={e => set('registrationNr', e.target.value)} placeholder="ABC 123" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.type')}</label>
              <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
                {typeKeys.map(v => <option key={v} value={v}>{t(`types.${v}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.provider')}</label>
              <input className={inputCls} value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="Yamaha Motor SE" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.policyNumber')}</label>
            <input className={inputCls} value={form.policyNumber} onChange={e => set('policyNumber', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.startDate')}</label>
              <input type="date" required className={inputCls} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.endDate')}</label>
              <input type="date" required className={inputCls} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.maxCoverage')}</label>
              <input type="number" className={inputCls} value={form.coverageAmount} onChange={e => set('coverageAmount', e.target.value)} placeholder="50000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.leadId')}</label>
              <input type="number" className={inputCls} value={form.leadId} onChange={e => set('leadId', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('modal.notes')}</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              {t('modal.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] disabled:opacity-40">
              {saving ? t('modal.saving') : t('modal.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Claim Modal ───────────────────────────────────────────────────────────────
interface ClaimModalProps {
  warranty: Warranty;
  onClose: () => void;
  onSaved: () => void;
}

function ClaimModal({ warranty, onClose, onSaved }: ClaimModalProps) {
  const t = useTranslations('warranties');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNotes,  setClaimNotes]  = useState('');
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/warranties/${warranty.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status:      'claimed',
        claimDate:   new Date().toISOString().split('T')[0],
        claimAmount: parseFloat(claimAmount) || 0,
        claimNotes,
      }),
    });
    if (res.ok) {
      toast.success(t('toast.claim'));
      onSaved();
      onClose();
    } else {
      toast.error(t('toast.error'));
    }
    setSaving(false);
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
        <h2 className="text-lg font-extrabold text-slate-900 mb-1">
          {t('claimModal.title', { vehicle: warranty.vehicle_name })}
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          {t('claimModal.policyNr', { nr: warranty.policy_number || '—' })}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('claimModal.amount')}</label>
            <input type="number" className={inputCls} value={claimAmount} onChange={e => setClaimAmount(e.target.value)} placeholder="15000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('claimModal.details')}</label>
            <textarea required className={inputCls + ' resize-none'} rows={3} value={claimNotes} onChange={e => setClaimNotes(e.target.value)} placeholder={t('claimModal.detailsPlaceholder')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              {t('claimModal.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-40">
              {saving ? t('claimModal.saving') : t('claimModal.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function WarrantiesPage() {
  const router  = useRouter();
  const t       = useTranslations('warranties');
  const locale  = useLocale();
  const [warranties,   setWarranties]   = useState<Warranty[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showNew,      setShowNew]      = useState(false);
  const [claimTarget,  setClaimTarget]  = useState<Warranty | null>(null);
  const [user,         setUser]         = useState<{ dealershipId?: string } | null>(null);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  const statusLabels: Record<string, string> = {
    all:       t('statuses.all'),
    active:    t('statuses.active'),
    expired:   t('statuses.expired'),
    claimed:   t('statuses.claimed'),
    cancelled: t('statuses.cancelled'),
    voided:    t('statuses.voided'),
  };

  const typeLabels: Record<string, string> = {
    standard:     t('types.standard'),
    extended:     t('types.extended'),
    manufacturer: t('types.manufacturer'),
    third_party:  t('types.third_party'),
  };

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const load = useCallback(async (did: string, sf: string) => {
    setLoading(true);
    const url = new URL('/api/warranties', window.location.origin);
    url.searchParams.set('dealershipId', did);
    if (sf !== 'all') url.searchParams.set('status', sf);
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json() as { warranties: Warranty[] };
      setWarranties(j.warranties);
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

  const active        = warranties.filter(w => w.status === 'active');
  const expiring30    = active.filter(w => daysUntil(w.end_date) <= 30).length;
  const totalCoverage = active.reduce((s, w) => s + w.coverage_amount, 0);
  const claimed       = warranties.filter(w => w.status === 'claimed').length;

  const kpis = [
    { label: t('kpi.active'),   value: active.length,   icon: '🛡️', alert: false },
    { label: t('kpi.coverage'), value: fmtKr(totalCoverage), icon: '💰', alert: false },
    { label: t('kpi.expiring'), value: expiring30,       icon: '⚠️', alert: expiring30 > 0 },
    { label: t('kpi.claims'),   value: claimed,          icon: '📋', alert: claimed > 0 },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      {showNew && dealershipId && (
        <NewWarrantyModal dealershipId={dealershipId} onClose={() => setShowNew(false)} onCreated={() => load(dealershipId, statusFilter)} />
      )}
      {claimTarget && (
        <ClaimModal warranty={claimTarget} onClose={() => setClaimTarget(null)} onSaved={() => load(dealershipId, statusFilter)} />
      )}

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{t('title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('subtitle')}</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55d22] shadow transition-colors whitespace-nowrap">
            {t('addButton')}
          </button>
        </div>

        {/* KPIs */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map(k => (
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
            {(['active', 'expired', 'claimed', 'all'] as const).map(s => (
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
          ) : warranties.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">🛡️</p>
              <p className="font-bold text-slate-700 text-lg">{t('empty.title')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('empty.desc')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {[t('table.vehicle'), t('table.type'), t('table.provider'), t('table.period'), t('table.coverage'), t('table.status'), ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {warranties.map(w => {
                    const days    = daysUntil(w.end_date);
                    const nearExp = w.status === 'active' && days <= 30 && days > 0;
                    return (
                      <tr key={w.id} className={`border-b border-slate-50 transition-colors ${nearExp ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{w.vehicle_name || '—'}</p>
                          {(w.vin || w.registration_nr) && (
                            <p className="text-xs text-slate-400">{w.registration_nr || w.vin}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{typeLabels[w.type] ?? w.type}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{w.provider || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs text-slate-600">{fmtDate(w.start_date)} – {fmtDate(w.end_date)}</p>
                          {nearExp && <p className="text-xs text-amber-600 font-medium">{t('expiresIn', { days })}</p>}
                          {w.status === 'active' && days <= 0 && <p className="text-xs text-red-500 font-medium">{t('expired')}</p>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{fmtKr(w.coverage_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[w.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {statusLabels[w.status] ?? w.status}
                          </span>
                          {w.claim_amount && w.claim_amount > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">{fmtKr(w.claim_amount)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {w.status === 'active' && (
                              <button onClick={() => setClaimTarget(w)}
                                className="text-xs text-red-500 hover:underline font-medium">
                                {t('actions.claim')}
                              </button>
                            )}
                            {w.lead_id && (
                              <Link href={`/sales/leads/${w.lead_id}`}
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
